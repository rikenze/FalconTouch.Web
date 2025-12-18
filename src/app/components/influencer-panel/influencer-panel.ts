import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationComponent } from '../game/notification.component/notification.component';
import { AuthService } from '../game/auth.service';
import { take } from 'rxjs/operators';
import { SignalRService } from '../game/signalr.service';

@Component({
  selector: 'app-influencer-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NotificationComponent],
  templateUrl: './influencer-panel.html',
  styleUrl: './influencer-panel.css'
})
export class InfluencerPanel implements OnInit {
  influencerForm: FormGroup;
  influencers: {
    id: number;
    name: string;
    code: string;
    discountPercent: number;
    commissionType: string;
    commissionValue: number;
    followerCount: number;
    minimumFollowerPercentage: number;
    active: boolean;
    paidCount?: number;
    conversionDisplay?: string;
    conversionStatus?: string;
    conversionPercent?: number;
    conversionGoal?: number;
  }[] = [];

  message = '';
  messageType: 'success' | 'error' | '' = '';

  showNotificationDialog = false;
  notificationMessage = '';
  notificationType: 'success' | 'error' | 'warning' = 'success';

  editMode = false;
  editingId: number | null = null;

  constructor(
    public auth: AuthService,
    private fb: FormBuilder,
    private signalR: SignalRService
  ) {
    this.influencerForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      discountPercent: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      commissionType: ['per_player', Validators.required],
      commissionValue: [1, [Validators.required, Validators.min(0)]],
      followerCount: [0, [Validators.required, Validators.min(0)]],
      minimumFollowerPercentage: [0, [Validators.required, Validators.min(0)]],
      active: [true]
    });
  }

  ngOnInit(): void {
    this.auth.isAdmin$.pipe(take(1)).subscribe(async (isAdmin: any) => {
      if (!isAdmin) {
        this.message = 'Acesso negado. Apenas administradores.';
        this.messageType = 'error';
        return;
      }

      await this.signalR.connect();

      this.influencerForm.get('commissionType')?.valueChanges.subscribe(type => {
        const commissionControl = this.influencerForm.get('commissionValue');
        if (type === 'prize') {
          commissionControl?.disable();
        } else {
          commissionControl?.enable();
        }
      });

      this.loadInfluencers();
    });
  }

  loadInfluencers() {
    this.signalR.getInfluencers().then((data) => {
      this.influencers = data;
    }).catch(() => this.showError('Erro ao carregar influenciadores.'));
  }

  submitInfluencer() {
    if (this.influencerForm.invalid) {
      this.influencerForm.markAllAsTouched();
      return;
    }

    const payload = this.influencerForm.value;

    if (this.editMode && this.editingId !== null) {
      this.signalR.updateInfluencer(this.editingId, payload).then(() => {
        this.afterSave('Influenciador atualizado com sucesso!');
      }).catch(() => this.showError('Erro ao atualizar influenciador.'));
    } else {
      this.signalR.createInfluencer(payload).then(() => {
        this.afterSave('Influenciador cadastrado com sucesso!');
      }).catch(() => this.showError('Erro ao cadastrar influenciador.'));
    }
  }

  editInfluencer(influencer: any) {
    this.editMode = true;
    this.editingId = influencer.id;

    this.influencerForm.patchValue({
      name: influencer.name,
      code: influencer.code,
      discountPercent: influencer.discountPercent,
      commissionType: influencer.commissionType,
      commissionValue: influencer.commissionValue,
      followerCount: influencer.followerCount,
      minimumFollowerPercentage: influencer.minimumFollowerPercentage,
      active: influencer.active
    });
  }

  deleteInfluencer(id: number) {
    if (!confirm('Tem certeza que deseja excluir este influenciador?')) return;

    this.signalR.deleteInfluencer(id).then(() => {
      this.loadInfluencers();
      this.showNotification('Influenciador excluido com sucesso!', 'success');
    }).catch(() => this.showError('Erro ao excluir influenciador.'));
  }

  resetForm() {
    this.influencerForm.reset({
      name: '',
      code: '',
      discountPercent: 0,
      commissionType: 'per_player',
      commissionValue: 1,
      followerCount: 0,
      minimumFollowerPercentage: 0,
      active: true
    });
    this.editMode = false;
    this.editingId = null;
  }

  get isPrizeCommission(): boolean {
    return this.influencerForm.get('commissionType')?.value === 'prize';
  }

  private afterSave(message: string) {
    this.loadInfluencers();
    this.resetForm();
    this.showNotification(message, 'success');
  }

  private showError(message: string) {
    this.showNotification(message, 'error');
  }

  private showNotification(message: string, type: 'success' | 'error' | 'warning') {
    this.notificationMessage = message;
    this.notificationType = type;
    this.showNotificationDialog = true;
  }
}
