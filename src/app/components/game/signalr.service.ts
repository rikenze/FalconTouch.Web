import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hub?: signalR.HubConnection;

  public playersCount$ = new BehaviorSubject<{ current: number }>({ current: 0 });
  public playersPaidCount$ = new BehaviorSubject<{ current: number; min: number }>({ current: 0, min: 0 });
  public winner$ = new BehaviorSubject<{ winnerId: string; playerEmail: string; buttonIndex: string } | null>(null);
  public gameReleased$ = new BehaviorSubject<boolean>(false);
  public countdown$ = new BehaviorSubject<number>(0);
  public releaseButtons$ = new BehaviorSubject<number>(-1);
  public reset$ = new BehaviorSubject<void>(undefined);
  public ranking$ = new BehaviorSubject<{ email: string; time: number }[]>([]);
  public premio$ = new BehaviorSubject<{ descricao: string } | null>(null);
  public premioImagens$ = new BehaviorSubject<{ imagens: { id: string; imagem: string }[] } | null>(null);
  public preco$ = new BehaviorSubject<{ preco: number } | null>(null);
  public pixPaidTrue$ = new BehaviorSubject<{ paid: boolean; txid: string; userId: string } | null>(null);

  constructor(private ngZone: NgZone) {}

  async connect(): Promise<void> {
    if (this.hub && this.hub.state === signalR.HubConnectionState.Connected) return;

    console.log('🔌 Conectando via SignalR');

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/game`, {
        accessTokenFactory: () => localStorage.getItem('token') ?? ''
      })
      .withAutomaticReconnect()
      .build();

    this.registerListeners();

    try {
      await this.hub.start();
    } catch (err: any) {
      this.ngZone.run(() => {
        console.error('Erro ao conectar no SignalR:', err);
        window?.alert?.(`Erro ao conectar ao servidor de jogo:\n${err?.message ?? err}`);
      });
    }
  }

  private registerListeners(): void {
    if (!this.hub) return;

    this.hub.onclose((err) => {
      this.ngZone.run(() => console.warn('SignalR desconectado:', err));
    });

    // ⚠️ Os nomes dos eventos aqui PRECISAM bater com o SendAsync("...") do seu Hub C#
    this.hub.on('PlayerCount', (data: { current: number }) =>
      this.ngZone.run(() => this.playersCount$.next(data))
    );

    this.hub.on('PlayersPaidCount', (data: { current: number; min: number }) =>
      this.ngZone.run(() => this.playersPaidCount$.next(data))
    );

    this.hub.on('StartCountdown', (data: { gameReleased: boolean; countdown: number }) =>
      this.ngZone.run(() => {
        this.gameReleased$.next(data.gameReleased);
        this.countdown$.next(data.countdown);
      })
    );

    this.hub.on('ReleaseButtons', (data: { winningIndex: number }) =>
      this.ngZone.run(() => this.releaseButtons$.next(data.winningIndex))
    );

    this.hub.on('Winner', (data: { winnerId: string; playerEmail: string; buttonIndex: string }) =>
      this.ngZone.run(() => this.winner$.next(data))
    );

    this.hub.on('Ranking', (data: { email: string; time: number }[]) =>
      this.ngZone.run(() => this.ranking$.next(data))
    );

    this.hub.on('PremioDescricaoAtualizado', (data: { descricao: string }) =>
      this.ngZone.run(() => this.premio$.next({ descricao: data.descricao }))
    );

    this.hub.on('PremioImagensAtualizado', (data: { imagens?: { id: string; imagem: string }[] }) =>
      this.ngZone.run(() => this.premioImagens$.next({ imagens: data.imagens ?? [] }))
    );

    this.hub.on('PrecoAtualizado', (data: { preco: number }) =>
      this.ngZone.run(() => this.preco$.next(data))
    );

    this.hub.on('Reset', () =>
      this.ngZone.run(() => this.reset$.next())
    );

    this.hub.on('PixConfirmado', (data: { paid: boolean; txid: string; userId: string }) =>
      this.ngZone.run(() => this.pixPaidTrue$.next(data))
    );

    this.hub.on('PlayerConnected', (userIdentifier: string) => {
      console.log('PlayerConnected', userIdentifier);
    });

    this.hub.on('GameStarted', (data: { gameId: number; buttons: number }) => {
      console.log('GameStarted', data);
    });

    this.hub.on('RankingUpdated', (data: any) => {
      console.log('RankingUpdated', data);
      // se data for lista, atualize ranking$ aqui
    });

    this.hub.on('WinnerConfirmed', (data: { gameId: number; winnerId: number }) => {
      console.log('WinnerConfirmed', data);
    });
  }

  updateAuthToken(_token: string): void {
    // No SignalR, você normalmente só reconecta e o accessTokenFactory pega o novo token do localStorage.
    // Então basta dar reconnect:
    this.disconnect();
    this.connect();
  }

  async emitClick(index: number): Promise<void> {
    if (!this.hub || this.hub.state !== signalR.HubConnectionState.Connected) return;

    // ⚠️ Esse nome precisa bater com um método público no Hub C# (ex: public Task Click(int buttonIndex))
    await this.hub.invoke('ClickButton', { buttonIndex: index });
  }

  disconnect(): void {
    this.hub?.stop();
    this.hub = undefined;
  }
}
