import { Component, OnInit, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { take } from 'rxjs/operators';
import { SignalRService } from '../signalr.service';
import { NotificationComponent } from '../notification.component/notification.component';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NotificationComponent],
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.css']
})
export class AdminPanel implements OnInit {
  form: FormGroup;
  message = '';
  messageType: 'success' | 'error' | '' = '';

  // Modal
  showNotificationDialog = false;
  notificationMessage = '';
  notificationType: 'success' | 'error' | 'warning' = 'success';

  currentGameId: number | null = null;
  totalPlayers: number = 0;
  playersPaidCount: number = 0;
  preco: number = 0.00;
  premio: string = '';
  jogoAtivo: boolean = false;

  auth = inject(AuthService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private signalRService = inject(SignalRService);

  constructor() {
    this.form = this.fb.group({
      minPlayers: [1000, [Validators.required, Validators.min(1)]],
      countdown: [5, [Validators.required, Validators.min(1)]],
      preco: [12.00, [Validators.required, Validators.min(0.01)]],
      premio: ['IPhone 13 Pro Max', [Validators.required, Validators.minLength(1)]]
    });
  }

  ngOnInit(): void {
    this.auth.isAdmin$.pipe(take(1)).subscribe((isAdmin: any) => {
      if (!isAdmin) {
        this.messageType = 'error';
        this.message = 'Acesso negado. Apenas administradores.';
        return;
      }

      this.signalRService.connect();

      this.loadCurrentGame();

      this.signalRService.playersCount$.subscribe(({ current }) => {
        this.totalPlayers = current;
      });

      // Aqui: usando o Observable público do SignalRService (sem acessar socket direto)
      this.signalRService.playersPaidCount$.subscribe(({ current }) => {
        this.playersPaidCount = current;
      });

      // Buscar configuração inicial do jogo (minPlayers)
      this.http.get('/api/game/admin/config', {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: (res: any) => {
          this.form.patchValue({ minPlayers: res.minPlayers, preco: res.preco, premio: res.premio });
          this.jogoAtivo = res.jogoAtivo;
        },
        error: (err: { error: { message: string; }; }) => {
          this.message = err.error?.message || 'Erro ao buscar configuração.';
          this.messageType = 'error';
        }
      });
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  loadCurrentGame() {
    this.http.get<{ id: number, playersPaidCount: number }>('/api/game/current-game', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (res: { id: number | null; playersPaidCount: number; }) => {
        this.currentGameId = res.id;
        this.playersPaidCount = res.playersPaidCount;
      },
      error: (err: any) => {
        console.error('Erro ao buscar jogo atual:', err);
      }
    });
  }

  updateConfigs() {
    if (this.form.invalid) return;

    const minPlayers = this.form.value.minPlayers;
    const preco = this.form.value.preco;
    const premio = this.form.value.premio;

    this.http.post('/api/game/admin/config', { minPlayers, preco, premio }, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (res: any) => {
        this.message = res.message;
        this.messageType = 'success';
      },
      error: (err: { error: { message: string; }; }) => {
        this.message = err.error?.message || 'Erro ao atualizar.';
        this.messageType = 'error';
      }
    });
  }

  releaseGame() {
    if (this.form.invalid) return;

    if(!this.jogoAtivo){
      this.showNotification('Jogo inativo', 'error');
      return;
    }

    const countdown = this.form.value.countdown;

    this.http.post('/api/game/admin/release', { countdown }, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (res: any) => {
        this.message = res.message;
        this.messageType = 'success';
      },
      error: (err: { error: { message: string; }; }) => {
        this.message = err.error?.message || 'Erro ao liberar o jogo.';
        this.messageType = 'error';
      }
    });
  }

  toggleAtivo() {
    this.jogoAtivo = !this.jogoAtivo;

    this.http.post('/api/game/admin/jogoativo', { jogoAtivo: this.jogoAtivo }, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.message = this.jogoAtivo ? 'Jogo ativado' : 'Jogo desativado';
        this.messageType = 'success';
      },
      error: () => {
        this.message = 'Erro ao atualizar status do jogo.';
        this.messageType = 'error';
      }
    });
  }

  resetGame() {
    this.http.post('/api/game/admin/reset', {}, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.message = 'Jogo resetado com sucesso!';
        this.messageType = 'success';
      },
      error: (err: any) => {
        this.message = 'Erro ao resetar o jogo.';
        this.messageType = 'error';
        console.error(err);
      }
    });
  }

  sendMessageToPlayers(){
    this.http.post('/api/game/admin/send-whatsapp', {}, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.message = 'Mensagens enviadas com sucesso!';
        this.messageType = 'success';
      },
      error: (err: any) => {
        this.message = 'Erro ao enviar mensagens.';
        this.messageType = 'error';
        console.error(err);
      }
    });
  }

  showNotification(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
    this.showNotificationDialog = false;

    setTimeout(() => {
      this.notificationMessage = msg;
      this.notificationType = type;
      this.showNotificationDialog = true;
    }, 50);
  }

  // Upload da imagem
  upload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const formData = new FormData();
    formData.append('imagem', file);
    const gameId = this.currentGameId;

    // Exemplo do endpoint da API que criamos
    this.http.post(`/api/game/${gameId}/upload-image`, formData, {
      headers: this.getAuthHeaders(), 
      reportProgress: true,
      observe: 'events'
    }).subscribe((event: { type: any; }) => {
      if (event.type === HttpEventType.Response) {
        this.showNotification('Imagem enviada com sucesso!', 'success')
      }
    }, (err: any) => {
      this.showNotification('Erro ao enviar imagem', 'error')
      console.error(err);
    });
  }
}
