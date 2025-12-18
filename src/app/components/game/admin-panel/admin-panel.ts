import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { take } from 'rxjs/operators';
import { SignalRService } from '../signalr.service';
import { NotificationComponent } from '../notification.component/notification.component';
import { Console } from 'console';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NotificationComponent],
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.css']
})
export class AdminPanel implements OnInit {
  configForm: FormGroup;
  startForm: FormGroup;
  message = '';
  messageType: 'success' | 'error' | '' = '';

  showNotificationDialog = false;
  notificationMessage = '';
  notificationType: 'success' | 'error' | 'warning' = 'success';

  currentGameId: number | null = null;
  gameActive = false;
  playersPaidCount = 0;
  minPlayers = 0;

  auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private signalRService = inject(SignalRService);

  constructor() {
    this.configForm = this.fb.group({
      minPlayers: [1000, [Validators.required, Validators.min(1)]],
      price: [12.00, [Validators.required, Validators.min(0.01)]],
      prizeDescription: ['IPhone 13 Pro Max', [Validators.required, Validators.minLength(1)]]
    });

    this.startForm = this.fb.group({
      numberOfButtons: [8, [Validators.required, Validators.min(2)]]
    });
  }

  async ngOnInit(): Promise<void> {
    this.auth.isAdmin$.pipe(take(1)).subscribe(async (isAdmin: any) => {
      if (!isAdmin) {
        this.messageType = 'error';
        this.message = 'Acesso negado. Apenas administradores.';
        return;
      }

      await this.signalRService.connect();

      try {
        const currentGame = await this.signalRService.getCurrentGame();
        this.currentGameId = currentGame.id;
        this.playersPaidCount = currentGame.playersPaidCount;
        this.minPlayers = currentGame.minPlayers;
      } catch (err) {
        console.error('Erro ao buscar jogo atual:', err);
      }

      try {
        const config = await this.signalRService.getAdminConfig();
        this.configForm.patchValue({
          minPlayers: config.minPlayers,
          price: config.price,
          prizeDescription: config.prizeDescription
        });
        this.gameActive = config.gameActive;
      } catch (err) {
        console.error('Erro ao buscar configuracao:', err);
      }

      this.signalRService.playersPaidCount$.subscribe(({ current, min }) => {
        this.playersPaidCount = current;
        this.minPlayers = min;
      });

      this.signalRService.gameStartError$.subscribe((message) => {
        this.message = message;
        this.messageType = 'error';
      });
    });
  }

  async startGame() {
    if (this.startForm.invalid) return;

    const numberOfButtons = Number(this.startForm.value.numberOfButtons);
    try {
      await this.signalRService.startGame(numberOfButtons);
      this.message = 'Jogo iniciado com sucesso.';
      this.messageType = 'success';
    } catch (err: any) {
      this.message = err?.message || 'Erro ao iniciar o jogo.';
      this.messageType = 'error';
    }
  }

  async updateConfigs() {
    if (this.configForm.invalid) return;

    const minPlayers = Number(this.configForm.value.minPlayers);
    const price = Number(this.configForm.value.price);
    const prizeDescription = String(this.configForm.value.prizeDescription);

    try {
      await this.signalRService.updateAdminConfig({ minPlayers, price, prizeDescription });
      this.message = 'Configuracoes atualizadas com sucesso.';
      this.messageType = 'success';
    } catch (err) {
      this.message = 'Erro ao atualizar configuracoes.';
      this.messageType = 'error';
    }
  }

  async toggleActive() {
    this.gameActive = !this.gameActive;
    try {
      await this.signalRService.setGameActive(this.gameActive);
      this.message = this.gameActive ? 'Jogo ativado' : 'Jogo desativado';
      this.messageType = 'success';
    } catch (err) {
      this.message = 'Erro ao atualizar status do jogo.';
      this.messageType = 'error';
    }
  }

  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.currentGameId) return;

    const file = input.files[0];
    const base64 = await this.fileToBase64(file);

    try {
      await this.signalRService.uploadPrizeImage(this.currentGameId, base64);
      this.showNotification('Imagem enviada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao enviar imagem:', err);
      this.showNotification('Erro ao enviar imagem', 'error');
    }
  }

  showNotification(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
    this.showNotificationDialog = false;

    setTimeout(() => {
      this.notificationMessage = msg;
      this.notificationType = type;
      this.showNotificationDialog = true;
    }, 50);
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }
}
