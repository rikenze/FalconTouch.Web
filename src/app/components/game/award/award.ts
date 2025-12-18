import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from '../auth.service';
import { NotificationComponent } from '../notification.component/notification.component';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { SignalRService } from '../signalr.service';

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
  currentGameId: number | null = null;

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
    name: 'IPhone 13 Pro max',
    imagens: [] as { id: number; imagem: string }[],
    description: 'Descricao do premio.'
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

    await this.signalR.connect();

    this.signalR.prizeDescription$
      .pipe(takeUntil(this.destroy$))
      .subscribe((description) => {
        if (description) this.product.name = description;
      });

    this.signalR.prizeImages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((images) => {
        this.product.imagens = images.map(img => ({
          id: img.id,
          imagem: img.image
        }));
        if (this.currentImageIndex >= this.product.imagens.length) {
          this.currentImageIndex = Math.max(this.product.imagens.length - 1, 0);
        }
      });

    try {
      const publicGame = await this.signalR.getPublicGame();
      this.product.name = publicGame.prizeDescription;
      this.product.imagens = publicGame.images.map(img => ({
        id: img.id,
        imagem: img.image
      }));
    } catch (err) {
      console.error('Erro ao buscar dados publicos do jogo:', err);
    }

    if (this.isLoggedIn) {
      try {
        const current = await this.signalR.getCurrentGame();
        this.currentGameId = current.id;
      } catch {
        this.currentGameId = null;
      }

      this.checkPaymentStatus();
    }

    this.authService.isAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => this.isAdmin = status);
  }

  checkPaymentStatus() {
    this.http.get<{ hasPaid: boolean }>('/api/payments/check-payment').subscribe({
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
      this.showNotification('Voce precisa estar logado para participar!', 'warning');
      this.router.navigate(['/auth']);
      return;
    }
    this.router.navigate(['/participar']);
  }

  startGame() {
    if (!this.isLoggedIn) {
      this.showNotification('Voce precisa estar logado para jogar!', 'warning');
      this.router.navigate(['/auth']);
      return;
    }

    this.http.get<{ hasPaid: boolean }>('/api/payments/check-payment').subscribe({
      next: (res) => {
        if (!res.hasPaid) {
          this.showNotification('Voce precisa realizar o pagamento para participar.', 'warning');
          this.router.navigate(['/participar']);
          return;
        }

        this.router.navigate(['/play']);
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
    if (!image?.id || !this.currentGameId) return;

    const confirmed = await this.askConfirm('Tem certeza que deseja excluir esta imagem?');
    if (!confirmed) return;

    try {
      await this.signalR.deletePrizeImage(image.id, this.currentGameId);
      this.showNotification('Imagem excluida com sucesso.', 'success');
    } catch (err) {
      console.error('Erro ao excluir imagem:', err);
      this.showNotification('Erro ao excluir imagem.', 'error');
    }
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
