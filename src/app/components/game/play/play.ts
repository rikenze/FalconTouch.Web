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

  countdown: number = 0;
  gameReleased = false;
  started = false;
  winner: string | null = null;
  isWinner: boolean = false;
  winnerId: string | null = null;
  buttonIndex: string | null = null;
  playersPaidCount = 0;
  minPlayers = 0;
  buttons = new Array(8);
  winningButtonIndex: number = -1;
  countdownModalVisible = false;
  isAdmin = false;

  private isBrowser: boolean;
  private subscriptions: Subscription[] = [];
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  rankingVisible = false;
  rankingList: { email: string, time: number }[] = [];

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
    
    this.http.get<{ hasPaid: boolean }>('/api/game/check-payment').subscribe({
      next: (res) => {
        if (!res.hasPaid) {
          this.showNotification('Você precisa realizar o pagamento para participar do jogo.', 'warning');
          this.router.navigate(['/award']);
          return;
        }

        this.signalRService.connect();
        this.subscribeSocketEvents();
      },
      error: () => {
        this.showNotification('Erro ao verificar pagamento. Tente novamente.', 'error');
        this.router.navigate(['/award']);
      }
    });
  }

  private subscribeSocketEvents(): void {
    this.subscriptions.push(

      this.signalRService.playersPaidCount$.subscribe(({ current, min }) => {
        this.playersPaidCount = current;
        this.minPlayers = min;
      }),

      this.signalRService.countdown$.subscribe((value) => {
        this.countdown = value;
        if (value > 0 && !this.countdownInterval) {
          this.countdownModalVisible = true;
          this.startCountdown();
        }
        if (value === 0) {
          this.countdownModalVisible = false;
          this.clearCountdownInterval();
        }
      }),

      this.signalRService.gameReleased$.subscribe((released) => {
        this.gameReleased = released;
      }),

      this.signalRService.releaseButtons$.subscribe((index) => {
        this.winningButtonIndex = index;
      }),

      this.signalRService.winner$.subscribe((data) => {
        if (data) {
          this.winner = data.playerEmail;
          this.buttonIndex = data.buttonIndex;
          this.winnerId = data.winnerId;
          this.isWinner = (this.playerEmail === this.winner);
          this.started = false;
          this.clearCountdownInterval();
        }
      }),

      this.signalRService.ranking$.subscribe(ranking => {
        this.rankingList = ranking;
      }),

      this.signalRService.reset$.subscribe(() => {
        this.resetGame();
        this.rankingVisible = false;
      })
    );
  }

  private startCountdown(): void {
    this.clearCountdownInterval();

    this.countdownInterval = setInterval(() => {
      this.countdown--;

      if (this.countdown <= 0) {
        this.countdownModalVisible = false;
        this.countdown = 0;
        this.clearCountdownInterval();
        this.finishCountdown();
      }
    }, 1000);
  }

  private clearCountdownInterval(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private finishCountdown(): void {
    if (!this.winnerId) {
      this.started = true;
      if (this.winningButtonIndex === -1) {
        this.winningButtonIndex = Math.floor(Math.random() * 8);
      }
    }
  }

  clickButton(index: number): void {
    if (this.started && !this.winnerId && this.isBrowser) {
      this.signalRService.emitClick(index);
    }
  }

  resetGame(): void {
    this.gameReleased = false;
    this.started = false;
    this.winnerId = null;
    this.winner = null;
    this.buttonIndex = null;
    this.winningButtonIndex = -1;
    this.countdown = 0;
    this.countdownModalVisible = false;
    this.clearCountdownInterval();
  }

  showNotification(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
    this.notificationMessage = msg;
    this.notificationType = type;
    setTimeout(() => this.notificationMessage = '', 4000);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.clearCountdownInterval();
    if (this.isBrowser) {
      this.signalRService.disconnect();
    }
    this.rankingVisible = false;
    this.countdownModalVisible = false;
  }
}
