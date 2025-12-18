import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, Inject, PLATFORM_ID, ElementRef, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { AdminPanel } from '../admin-panel/admin-panel';
import { HttpClient } from '@angular/common/http';
import { SignalRService } from '../signalr.service';
import { Subscription } from 'rxjs';
import { NotificationComponent } from '../notification.component/notification.component';
import { Ranking } from '../ranking/ranking';
import { AuthService } from '../auth.service';

interface TokenPayload {
  email?: string;
  name?: string;
}

@Component({
  selector: 'app-play',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule, AdminPanel, NotificationComponent, Ranking],
  templateUrl: './play.html',
  styleUrls: ['./play.css']
})
export class Play implements OnInit, OnDestroy {
  @Input() playerEmail: string = '';

  notificationMessage = '';
  notificationType: 'success' | 'error' | 'warning' = 'success';

  gameStarted = false;
  winner: string | null = null;
  isWinner: boolean = false;
  winnerId: number | null = null;
  buttons: number[] = [];
  isAdmin = false;

  private isBrowser: boolean;
  private subscriptions: Subscription[] = [];

  rankingVisible = false;
  rankingList: { userId: number; email: string; time: number }[] = [];

  constructor(
    private router: Router,
    private http: HttpClient,
    private signalRService: SignalRService,
    private auth: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    const token = localStorage.getItem('token');
    if (!token) {
      this.showNotification('Você precisa estar logado para jogar!', 'warning');
      this.router.navigate(['/auth']);
      return;
    }

    try {
      const decoded = jwtDecode<TokenPayload>(token);
      this.playerEmail = decoded.name || decoded.email || 'Jogador';
    } catch (e) {
      console.warn('Token JWT inválido:', e);
    }

    this.isAdmin = this.auth.isAdmin();
    
    this.http.get<{ hasPaid: boolean }>('/api/payments/check-payment').subscribe({
      next: (res) => {
        if (!res.hasPaid) {
          this.showNotification('Você precisa realizar o pagamento para participar do jogo.', 'warning');
          this.router.navigate(['/award']);
          return;
        }

        this.signalRService.connect();
        this.subscribeSocketEvents();

        this.signalRService.getCurrentGame()
          .then((current) => {
            if (current.isActive) {
              this.gameStarted = true;
              this.buttons = Array.from({ length: current.numberOfButtons }, (_, i) => i);
            }
          })
          .catch((err) => {
            console.warn('Erro ao buscar estado do jogo:', err);
          });
      },
      error: () => {
        this.showNotification('Erro ao verificar pagamento. Tente novamente.', 'error');
        this.router.navigate(['/award']);
      }
    });
  }

  private subscribeSocketEvents(): void {
    this.subscriptions.push(
      this.signalRService.gameStarted$.subscribe((data) => {
        this.gameStarted = true;
        this.winner = null;
        this.isWinner = false;
        this.winnerId = null;
        this.buttons = Array.from({ length: data.buttons }, (_, i) => i);
      }),

      this.signalRService.rankingUpdated$.subscribe((ranking) => {
        this.rankingList = ranking.map(item => ({
          userId: item.userId,
          email: item.email ?? 'Jogador',
          time: item.reactionTimeMs
        }));
      }),

      this.signalRService.winnerConfirmed$.subscribe((data) => {
        this.winnerId = data.winnerId;
        const winnerEntry = this.rankingList.find(item => item.userId === data.winnerId);
        this.winner = winnerEntry?.email ?? `ID ${data.winnerId}`;
        this.isWinner = String(this.auth.getUserId()) === String(data.winnerId);
        this.gameStarted = false;
      }),

      this.signalRService.clickRejected$.subscribe((message) => {
        this.showNotification(message, 'warning');
      }),

      this.signalRService.gameStartError$.subscribe((message) => {
        this.showNotification(message, 'error');
      })
    );
  }

  clickButton(index: number): void {
    if (this.gameStarted && !this.winnerId && this.isBrowser) {
      this.signalRService.emitClick(index);
    }
  }

  resetGame(): void {
    this.gameStarted = false;
    this.winnerId = null;
    this.winner = null;
    this.buttons = [];
  }

  showNotification(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
    this.notificationMessage = msg;
    this.notificationType = type;
    setTimeout(() => this.notificationMessage = '', 4000);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.isBrowser) {
      this.signalRService.disconnect();
    }
    this.rankingVisible = false;
  }
}
