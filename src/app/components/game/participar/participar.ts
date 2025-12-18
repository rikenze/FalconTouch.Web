import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { filter, firstValueFrom, Subject, takeUntil } from 'rxjs';
import { NgxMaskDirective } from 'ngx-mask';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '../../../../environments/environment';

import { NotificationComponent } from '../notification.component/notification.component';
import { AuthService } from '../auth.service';
import { SignalRService } from '../signalr.service';

interface PixResponse {
  imagemQrcode: string;
  qrcode: string;
  txid: string;
}

@Component({
  selector: 'app-participar',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule, NotificationComponent, NgxMaskDirective],
  templateUrl: './participar.html',
  styleUrl: './participar.css'
})
export class Participar implements OnInit, OnDestroy {
  product = {
    name: 'iPhone 13 Pro max',
    imagens: [] as { id: string; imagem: string }[],
    description: 'O mais novo iPhone com câmera poderosa e chip A17 Bionic.'
  };

  metodosPagamento: string[] = ['Pix', 'Cartão de Crédito'];
  preco = 0.0;

  formDadosEntrega!: FormGroup;

  pixQrCode: string | null = null;
  pixCode: string | null = null;
  txid: string | null = null;

  copiado = false;
  textBtnPay = 'Pagar';

  showNotificationDialog = false;
  notificationMessage = '';
  notificationType: 'success' | 'error' | 'warning' = 'success';

  loadingPagamento?: boolean;
  paid = false;

  private destroy$ = new Subject<void>();

  stripe!: Stripe | null;
  cardElement: any;
  stripeElements: any;

  influencerId: number | null = null;
  discount_percent = 0;
  couponCode = '';
  comission = 0;

  constructor(
    private router: Router,
    private auth: AuthService,
    private http: HttpClient,
    private fb: FormBuilder,
    private signalR: SignalRService
  ) {
    this.formDadosEntrega = this.fb.group({
      rua: ['', Validators.required],
      numero: ['', Validators.required],
      bairro: ['', Validators.required],
      cidade: ['', Validators.required],
      estado: ['', [Validators.required, Validators.maxLength(2)]],
      cep: ['', [Validators.required, Validators.pattern(/^\d{5}-?\d{3}$/)]],
      telefone: ['', [Validators.required, Validators.pattern(/^\(?\d{2}\)? ?\d{4,5}-?\d{4}$/)]],
      formaPagamento: ['', Validators.required],
      couponCode: ['']
    });
  }

  async ngOnInit() {
    // SPA: sempre browser, então pode usar localStorage sem PLATFORM_ID
    const token = localStorage.getItem('token');
    if (!token) {
      this.showNotification('Você precisa estar logado para jogar!', 'warning');
      this.router.navigate(['/auth']);
      return;
    }

    // Stripe
    this.stripe = await loadStripe(environment.stripePublicKey);
    if (this.stripe) this.stripeElements = this.stripe.elements();

    // Botão / montagem do card do Stripe (apenas 1 subscribe)
    this.formDadosEntrega
      .get('formaPagamento')
      ?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value: string) => {
        if (value === 'Pix') {
          this.textBtnPay = 'Gerar QR Code';
          return;
        }

        if (value === 'Cartão de Crédito') {
          this.textBtnPay = 'Pagar com Cartão';

          setTimeout(() => {
            const cardDiv = document.getElementById('card-element');
            if (cardDiv && !this.cardElement && this.stripeElements) {
              this.cardElement = this.stripeElements.create('card');
              this.cardElement.mount('#card-element');
            }
          }, 300);

          return;
        }

        this.textBtnPay = 'Confirmar Pagamento';
      });

    // Dados iniciais via API
    this.http.get<{ premio: string; imagens?: { id: string; imagem: string }[] }>(
      '/api/game/public-current-game'
    ).subscribe({
      next: (res) => {
        this.product.name = res.premio;
        this.product.imagens = res.imagens ?? [];
      },
      error: (err) => console.error('Erro ao buscar dados públicos do jogo:', err)
    });

    this.http.get<{ preco: number }>('/api/game/current-game').subscribe({
      next: (res) => (this.preco = res.preco),
      error: (err) => console.error('Erro ao buscar preço do jogo:', err)
    });

    this.http.get<{ rua: string; numero: string; bairro: string; cidade: string; estado: string; cep: string }>(
      '/api/game/delivery-infos'
    ).subscribe({
      next: (res) => this.formDadosEntrega.patchValue(res),
      error: (err) => console.error('Erro ao buscar dados de entrega:', err)
    });

    // SignalR (substitui Socket.IO)
    await this.signalR.connect();

    this.signalR.premio$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: any) => {
        if (data?.descricao) this.product.name = data.descricao;
      });

    this.signalR.premioImagens$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: any) => {
        if (Array.isArray(data?.imagens)) this.product.imagens = data.imagens;
      });

    this.signalR.preco$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: any) => {
        if (data?.preco != null) this.preco = data.preco;
      });

    this.signalR.pixPaidTrue$
      .pipe(
        takeUntil(this.destroy$),
        filter((data: any) => !!data && data.userId === this.auth.getUserId())
      )
      .subscribe((data: any) => {
        if (data?.paid) {
          this.paid = true;
          this.router.navigate(['/play']);
        }
      });
  }

  validarCupom(code: string) {
    if (!code || code.trim().length === 0) return;

    this.http.get(`/api/game/influencer/validar-cupom/${code}`).subscribe({
      next: (res: any) => {
        this.preco = res.precoComDesconto;
        this.influencerId = res.influencer_id;
        this.discount_percent = res.discount_percent;
        this.comission = res.comission;
        this.couponCode = code;
      },
      error: () => {
        this.influencerId = null;
        this.discount_percent = 0;
        this.couponCode = '';
        this.comission = 0;
        this.showNotification('Cupom inválido ou expirado.', 'error');
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

  private getAuthHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  async confirmarPagamento() {
    if (this.formDadosEntrega.invalid) {
      this.formDadosEntrega.markAllAsTouched();
      this.showNotification('Preencha todos os dados corretamente!', 'warning');
      return;
    }

    this.loadingPagamento = true;

    try {
      const res = await firstValueFrom(
        this.http.get<{ id: number; ativo: boolean; totalPlayers: number; playersPaidCount: number }>(
          '/api/game/current-game',
          { headers: this.getAuthHeaders() }
        )
      );

      if (!res.ativo) {
        this.showNotification('Nenhum jogo ativo no momento. Tente novamente mais tarde.', 'warning');
        return;
      }

      const formaPagamento = this.formDadosEntrega.value.formaPagamento;

      if (formaPagamento === 'Pix') {
        const pixRes = await firstValueFrom(
          this.http.post<PixResponse>(
            '/api/game/efi/gerar-pix',
            {
              valor: this.preco,
              formaPagamento,
              endereco: this.formDadosEntrega.value,
              coupon_code: this.couponCode,
              influencer_id: this.influencerId,
              discount_percent: this.discount_percent,
              comission: this.comission
            },
            { headers: this.getAuthHeaders() }
          )
        );

        this.pixQrCode = pixRes.imagemQrcode;
        this.pixCode = pixRes.qrcode;
        this.txid = pixRes.txid;
        return;
      }

      if (formaPagamento === 'Cartão de Crédito') {
        const response = await firstValueFrom(
          this.http.post<{ clientSecret: string }>(
            '/api/game/create-payment-intent',
            { amount: Math.round(this.preco * 100) },
            { headers: this.getAuthHeaders() }
          )
        );

        const result = await this.stripe!.confirmCardPayment(response.clientSecret, {
          payment_method: {
            card: this.cardElement,
            billing_details: {
              name: this.auth.getUserCpf(),
              phone: this.formDadosEntrega.value.telefone,
              address: {
                line1: this.formDadosEntrega.value.rua,
                postal_code: this.formDadosEntrega.value.cep.replace('-', ''),
                city: this.formDadosEntrega.value.cidade,
                state: this.formDadosEntrega.value.estado
              }
            }
          }
        });

        if (result.error) {
          this.showNotification(result.error.message || 'Erro no pagamento.', 'error');
          return;
        }

        if (result.paymentIntent?.status === 'succeeded') {
          await firstValueFrom(
            this.http.post(
              '/api/game/confirmar-pagamento-cartao',
              {
                valor: this.preco,
                endereco: this.formDadosEntrega.value,
                coupon_code: this.couponCode,
                influencer_id: this.influencerId,
                discount_percent: this.discount_percent,
                comission: this.comission
              },
              { headers: this.getAuthHeaders() }
            )
          );

          this.showNotification('Pagamento realizado com sucesso!', 'success');
          this.paid = true;
          this.router.navigate(['/play']);
        }
      }
    } catch (err: any) {
      console.error('Erro ao processar pagamento:', err);
      const msg = err?.error?.mensagem || err?.message || 'Erro ao processar pagamento. Tente novamente.';
      this.showNotification(msg, 'error');
    } finally {
      this.loadingPagamento = false;
    }
  }

  copiarPixCode() {
    if (!this.pixCode) return;

    navigator.clipboard
      .writeText(this.pixCode)
      .then(() => {
        this.copiado = true;
        setTimeout(() => (this.copiado = false), 2000);
      })
      .catch((err) => {
        console.error('Erro ao copiar código Pix:', err);
        this.showNotification('Erro ao copiar o código Pix.', 'error');
      });
  }

  voltar() {
    this.router.navigate(['/']);
  }

  get isPixSelected(): boolean {
    return this.formDadosEntrega.get('formaPagamento')?.value === 'Pix';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // opcional: se você quiser desconectar quando sair da tela
    // this.signalR.disconnect();
  }
}
