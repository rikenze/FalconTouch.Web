import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';

export interface GameStartedPayload {
  gameId: number;
  buttons: number;
}

export interface RankingItem {
  userId: number;
  email: string | null;
  reactionTimeMs: number;
}

export interface WinnerConfirmedPayload {
  gameId: number;
  winnerId: number;
}

export interface PrizeImageDto {
  id: number;
  image: string;
}

export interface PublicGameDto {
  prizeDescription: string;
  images: PrizeImageDto[];
}

export interface CurrentGameDto {
  id: number;
  isActive: boolean;
  price: number;
  minPlayers: number;
  playersPaidCount: number;
  numberOfButtons: number;
}

export interface GameStatusDto {
  gameStarted: boolean;
}

export interface DeliveryInfoDto {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface CouponValidationDto {
  isValid: boolean;
  message?: string | null;
  influencerId?: number | null;
  priceWithDiscount: number;
  discountPercent: number;
  commissionAmount: number;
}

export interface AdminConfigDto {
  minPlayers: number;
  price: number;
  prizeDescription: string;
  gameActive: boolean;
}

export interface AdminConfigInputDto {
  minPlayers: number;
  price: number;
  prizeDescription: string;
}

export interface InfluencerInputDto {
  name: string;
  code: string;
  discountPercent: number;
  commissionType: string;
  commissionValue: number;
  followerCount: number;
  minimumFollowerPercentage: number;
  active: boolean;
}

export interface InfluencerDto extends InfluencerInputDto {
  id: number;
  paidCount: number;
  conversionDisplay: string;
  conversionStatus: string;
  conversionPercent: number;
  conversionGoal: number;
}

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hub?: signalR.HubConnection;
  private listenersRegistered = false;

  public gameStarted$ = new Subject<GameStartedPayload>();
  public rankingUpdated$ = new BehaviorSubject<RankingItem[]>([]);
  public winnerConfirmed$ = new Subject<WinnerConfirmedPayload>();
  public clickRejected$ = new Subject<string>();
  public gameStartError$ = new Subject<string>();
  public playerConnected$ = new Subject<string>();
  public prizeDescription$ = new BehaviorSubject<string>('');
  public prizeImages$ = new BehaviorSubject<PrizeImageDto[]>([]);
  public price$ = new BehaviorSubject<number>(0);
  public gameStatus$ = new BehaviorSubject<GameStatusDto>({ gameStarted: false });
  public playersPaidCount$ = new BehaviorSubject<{ current: number; min: number }>({ current: 0, min: 0 });

  constructor(private ngZone: NgZone) {}

  async connect(): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) return;
    if (this.hub && this.hub.state === signalR.HubConnectionState.Connected) return;

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/game`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    this.listenersRegistered = false;
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
    if (!this.hub || this.listenersRegistered) return;
    this.listenersRegistered = true;

    this.hub.onclose((err) => {
      this.ngZone.run(() => console.warn('SignalR desconectado:', err));
    });

    this.hub.on('PlayerConnected', (userIdentifier: string) =>
      this.ngZone.run(() => this.playerConnected$.next(userIdentifier))
    );

    this.hub.on('GameStarted', (data: GameStartedPayload) =>
      this.ngZone.run(() => this.gameStarted$.next(data))
    );

    this.hub.on('GameStartError', (message: string) =>
      this.ngZone.run(() => this.gameStartError$.next(message))
    );

    this.hub.on('ClickRejected', (message: string) =>
      this.ngZone.run(() => this.clickRejected$.next(message))
    );

    this.hub.on('RankingUpdated', (data: RankingItem[]) =>
      this.ngZone.run(() => this.rankingUpdated$.next(data))
    );

    this.hub.on('WinnerConfirmed', (data: WinnerConfirmedPayload) =>
      this.ngZone.run(() => this.winnerConfirmed$.next(data))
    );

    this.hub.on('PrizeUpdated', (data: { description: string }) =>
      this.ngZone.run(() => this.prizeDescription$.next(data.description))
    );

    this.hub.on('PrizeImagesUpdated', (data: { images: PrizeImageDto[] }) =>
      this.ngZone.run(() => this.prizeImages$.next(data.images))
    );

    this.hub.on('PriceUpdated', (data: { price: number }) =>
      this.ngZone.run(() => this.price$.next(data.price))
    );

    this.hub.on('GameStatusUpdated', (data: GameStatusDto) =>
      this.ngZone.run(() => this.gameStatus$.next(data))
    );

    this.hub.on('PlayersPaidCountUpdated', (data: { current: number; min: number }) =>
      this.ngZone.run(() => this.playersPaidCount$.next(data))
    );
  }

  updateAuthToken(_token: string): void {
    this.disconnect();
    this.connect();
  }

  async startGame(numberOfButtons: number): Promise<void> {
    if (!this.hub || this.hub.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR nao conectado.');
    }
    await this.hub.invoke('StartGame', numberOfButtons);
  }

  async emitClick(index: number): Promise<void> {
    if (!this.hub || this.hub.state !== signalR.HubConnectionState.Connected) return;
    await this.hub.invoke('ClickButton', index);
  }

  async getPublicGame(): Promise<PublicGameDto> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('GetPublicGame');
  }

  async getCurrentGame(): Promise<CurrentGameDto> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('GetCurrentGame');
  }

  async getGameStatus(): Promise<GameStatusDto> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('GetGameStatus');
  }

  async getDeliveryInfo(): Promise<DeliveryInfoDto | null> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('GetDeliveryInfo');
  }

  async validateCoupon(code: string): Promise<CouponValidationDto> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('ValidateCoupon', code);
  }

  async getInfluencers(): Promise<InfluencerDto[]> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('GetInfluencers');
  }

  async createInfluencer(input: InfluencerInputDto): Promise<InfluencerDto> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('CreateInfluencer', input);
  }

  async updateInfluencer(id: number, input: InfluencerInputDto): Promise<InfluencerDto> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('UpdateInfluencer', id, input);
  }

  async deleteInfluencer(id: number): Promise<boolean> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('DeleteInfluencer', id);
  }

  async getAdminConfig(): Promise<AdminConfigDto> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('GetAdminConfig');
  }

  async updateAdminConfig(input: AdminConfigInputDto): Promise<AdminConfigDto> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('UpdateAdminConfig', input);
  }

  async setGameActive(isActive: boolean): Promise<boolean> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('SetGameActive', isActive);
  }

  async uploadPrizeImage(gameId: number, base64Image: string): Promise<PrizeImageDto> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('UploadPrizeImage', gameId, base64Image);
  }

  async deletePrizeImage(imageId: number, gameId: number): Promise<boolean> {
    if (!this.hub) throw new Error('SignalR nao conectado.');
    return this.hub.invoke('DeletePrizeImage', imageId, gameId);
  }

  disconnect(): void {
    this.hub?.stop();
    this.hub = undefined;
  }
}
