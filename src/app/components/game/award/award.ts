import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from '../auth.service';
import { NotificationComponent } from '../notification.component/notification.component';
import { SignalRService } from '../signalr.service';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-award',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule, NotificationComponent, ConfirmDialog],
  templateUrl: './award.html',
  styleUrls: ['./award.css']
})
export class Award implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  playerEmail = '';
  isLoggedIn = false;
  currentGameId: string | null = null;
  totalPlayers = 0;
  playersPaidCount = 0;

  showNotificationDialog = false;
  notificationMessage = '';
  notificationType: 'success' | 'error' | 'warning' = 'success';

  participando = false;
  isAdmin = false;

  currentImageIndex = 0;
  touchStartX = 0;
  touchEndX = 0;

  showConfirmDialog = false;
  confirmMessage = '';
  confirmCallback?: (confirmed: boolean) => void;

  product = {
    name: 'iPhone 13 Pro max',
    imagens: [] as { id: string; imagem: string }[],
    description: 'O mais novo iPhone com câmera poderosa e chip A17 Bionic.'
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient,
    private signalR: SignalRService
  ) {}

  async ngOnInit(): Promise<void> {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.playerEmail = this.authService.getUserEmail() || '';

    // 🔌 SignalR
    await this.signalR.connect();

    this.signalR.premio$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        if (data?.descricao) {
          this.product.name = data.descricao;
        }
      });

    this.signalR.premioImagens$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        if (Array.isArray(data?.imagens)) {
          this.product.imagens = data.imagens;
          if (this.currentImageIndex >= this.product.imagens.length) {
            this.currentImageIndex = Math.max(this.product.imagens.length - 1, 0);
          }
        }
      });

    this.loadPublicGameData();

    if (this.isLoggedIn) {
      this.loadPrivateGameData();
      this.checkPaymentStatus();
    }

    this.authService.isAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => this.isAdmin = status);
  }

  loadPublicGameData() {
    this.http.get<{ premio: string; imagens?: { id: string; imagem: string }[] }>(
      '/api/game/public-current-game'
    ).subscribe({
      next: (res) => {
        this.product.name = res.premio;
        this.product.imagens = res.imagens ?? [];
      },
      error: (err) => console.error('Erro ao buscar dados públicos do jogo:', err)
    });
  }

  loadPrivateGameData() {
    this.http.get<{ id: string; totalPlayers: number; playersPaidCount: number }>(
      '/api/game/current-game'
    ).subscribe({
      next: (res) => {
        this.currentGameId = res.id;
        this.totalPlayers = res.totalPlayers;
        this.playersPaidCount = res.playersPaidCount;
      },
      error: () => {
        this.currentGameId = null;
        this.totalPlayers = 0;
        this.playersPaidCount = 0;
      }
    });
  }

  checkPaymentStatus() {
    this.http.get<{ hasPaid: boolean }>('/api/game/check-payment').subscribe({
      next: (res) => this.participando = res.hasPaid,
      error: () => this.showNotification('Erro ao verificar pagamento.', 'error')
    });
  }

  login() {
    this.router.navigate(['/auth']);
  }

  logout() {
    this.authService.logout();
    this.isLoggedIn = false;
    this.playerEmail = '';
  }

  goToParticipar() {
    if (!this.isLoggedIn) {
      this.showNotification('Você precisa estar logado para participar!', 'warning');
      this.router.navigate(['/auth']);
      return;
    }
    this.router.navigate(['/participar']);
  }

  startGame() {
    if (!this.isLoggedIn) {
      this.showNotification('Você precisa estar logado para jogar!', 'warning');
      this.router.navigate(['/auth']);
      return;
    }

    this.http.get<{ hasPaid: boolean }>('/api/game/check-payment').subscribe({
      next: (res) => {
        if (!res.hasPaid) {
          this.showNotification('Você precisa realizar o pagamento para participar.', 'warning');
          this.router.navigate(['/participar']);
          return;
        }

        this.http.get<{ gameStarted: boolean }>('/api/game/status').subscribe({
          next: (res) => {
            if (res.gameStarted && !this.isAdmin) {
              this.showNotification('O jogo já foi iniciado.', 'warning');
              return;
            }
            this.router.navigate(['/play']);
          },
          error: () => this.showNotification('Erro ao verificar estado do jogo.', 'error')
        });
      },
      error: () => this.showNotification('Erro ao verificar pagamento.', 'error')
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

  nextImage() {
    if (this.product.imagens.length) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.product.imagens.length;
    }
  }

  prevImage() {
    if (this.product.imagens.length) {
      this.currentImageIndex =
        (this.currentImageIndex - 1 + this.product.imagens.length) % this.product.imagens.length;
    }
  }

  goToImage(index: number) {
    this.currentImageIndex = index;
  }

  async deleteImage(index: number) {
    const image = this.product.imagens[index];
    if (!image?.id) return;

    const confirmed = await this.askConfirm('Tem certeza que deseja excluir esta imagem?');
    if (!confirmed) return;

    this.http.delete(`/api/game/image/${image.id}?gameId=${this.currentGameId}`).subscribe({
      next: () => this.showNotification('🗑️ Imagem excluída com sucesso.', 'success'),
      error: () => this.showNotification('❌ Erro ao excluir imagem.', 'error')
    });
  }

  askConfirm(message: string): Promise<boolean> {
    this.confirmMessage = message;
    this.showConfirmDialog = true;
    return new Promise(resolve => {
      this.confirmCallback = (confirmed) => {
        this.showConfirmDialog = false;
        resolve(confirmed);
      };
    });
  }

  onTouchStart(event: TouchEvent) {
  this.touchStartX = event.changedTouches[0].screenX;
}

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    // this.handleSwipe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.signalR.disconnect();
  }
}
