import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
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
    name: 'IPhone 13 Pro max',
    imagens: [] as { id: number; imagem: string }[],
    description: 'Descricao do premio.'
  };

  metodosPagamento: string[] = ['Pix', 'Cartao de Credito'];
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
    const token = localStorage.getItem('token');
    if (!token) {
      this.showNotification('Voce precisa estar logado para jogar!', 'warning');
      this.router.navigate(['/auth']);
      return;
    }

    this.stripe = await loadStripe(environment.stripePublicKey);
    if (this.stripe) this.stripeElements = this.stripe.elements();

    this.formDadosEntrega
      .get('formaPagamento')
      ?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value: string) => {
        if (value === 'Pix') {
          this.textBtnPay = 'Gerar QR Code';
          return;
        }

        if (value === 'Cartao de Credito') {
          this.textBtnPay = 'Pagar com Cartao';

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

    await this.signalR.connect();

    this.signalR.prizeDescription$
      .pipe(takeUntil(this.destroy$))
      .subscribe(description => {
        if (description) this.product.name = description;
      });

    this.signalR.prizeImages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(images => {
        this.product.imagens = images.map(img => ({
          id: img.id,
          imagem: img.image
        }));
      });

    this.signalR.price$
      .pipe(takeUntil(this.destroy$))
      .subscribe(price => {
        if (price) this.preco = price;
      });

    try {
      const publicGame = await this.signalR.getPublicGame();
      this.product.name = publicGame.prizeDescription;
      this.product.imagens = publicGame.images.map(img => ({
        id: img.id,
        imagem: img.image
      }));

      const current = await this.signalR.getCurrentGame();
      this.preco = current.price;
    } catch (err) {
      console.error('Erro ao buscar dados do jogo:', err);
    }

    try {
      const delivery = await this.signalR.getDeliveryInfo();
      if (delivery) {
        this.formDadosEntrega.patchValue({
          rua: delivery.street,
          numero: delivery.number,
          bairro: delivery.neighborhood,
          cidade: delivery.city,
          estado: delivery.state,
          cep: delivery.zipCode
        });
      }
    } catch (err) {
      console.error('Erro ao buscar dados de entrega:', err);
    }
  }

  validarCupom(code: string) {
    if (!code || code.trim().length === 0) return;

    this.signalR.validateCoupon(code).then((res) => {
      if (!res.isValid) {
        this.influencerId = null;
        this.discount_percent = 0;
        this.couponCode = '';
        this.comission = 0;
        this.showNotification(res.message || 'Cupom invalido ou expirado.', 'error');
        return;
      }

      this.preco = res.priceWithDiscount;
      this.influencerId = res.influencerId ?? null;
      this.discount_percent = res.discountPercent;
      this.comission = res.commissionAmount;
      this.couponCode = code;
    }).catch(() => {
      this.showNotification('Erro ao validar cupom.', 'error');
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
      const current = await this.signalR.getCurrentGame();
      if (!current.isActive) {
        this.showNotification('Nenhum jogo ativo no momento. Tente novamente mais tarde.', 'warning');
        return;
      }

      const formaPagamento = this.formDadosEntrega.value.formaPagamento;

      if (formaPagamento === 'Pix') {
        const pixRes = await firstValueFrom(
          this.http.post<PixResponse>(
            '/api/payments/pix',
            {
              amount: this.preco,
              couponCode: this.couponCode,
              influencerId: this.influencerId,
              discountPercent: this.discount_percent,
              commissionAmount: this.comission
            },
            { headers: this.getAuthHeaders() }
          )
        );

        this.pixQrCode = pixRes.imagemQrcode;
        this.pixCode = pixRes.qrcode;
        this.txid = pixRes.txid;
        return;
      }

      if (formaPagamento === 'Cartao de Credito') {
        const response = await firstValueFrom(
          this.http.post<{ clientSecret: string }>(
            '/api/payments/create-payment-intent',
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
              '/api/payments/confirm-card',
              {
                amount: this.preco,
                delivery: {
                  street: this.formDadosEntrega.value.rua,
                  number: this.formDadosEntrega.value.numero,
                  neighborhood: this.formDadosEntrega.value.bairro,
                  city: this.formDadosEntrega.value.cidade,
                  state: this.formDadosEntrega.value.estado,
                  zipCode: this.formDadosEntrega.value.cep
                },
                couponCode: this.couponCode,
                influencerId: this.influencerId,
                discountPercent: this.discount_percent,
                commissionAmount: this.comission,
                providerPaymentId: result.paymentIntent?.id
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
        console.error('Erro ao copiar codigo Pix:', err);
        this.showNotification('Erro ao copiar o codigo Pix.', 'error');
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
  }
}
