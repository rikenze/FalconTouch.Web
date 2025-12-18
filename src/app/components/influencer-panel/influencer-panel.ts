import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { NotificationComponent } from '../game/notification.component/notification.component';
import { AuthService } from '../game/auth.service';
import { take } from 'rxjs/operators';

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
    discount_percent: number;
    commission_type: string;
    commission_value: number;
    follower_count: number;
    minimum_follower_percentage: number;
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
    private http: HttpClient
  ) {
    this.influencerForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      discount_percent: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      commission_type: ['per_player', Validators.required],
      commission_value: [1, [Validators.required, Validators.min(0)]],
      follower_count: [0, [Validators.required, Validators.min(0)]],
      minimum_follower_percentage: [0, [Validators.required, Validators.min(0)]],
      active: [true]
    });
  }

  ngOnInit(): void {
    this.auth.isAdmin$.pipe(take(1)).subscribe((isAdmin: any) => {
      if (!isAdmin) {
        this.message = 'Acesso negado. Apenas administradores.';
        this.messageType = 'error';
        return;
      }

      this.influencerForm.get('commission_type')?.valueChanges.subscribe(type => {
        const commissionControl = this.influencerForm.get('commission_value');
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
    this.http.get('/api/game/influencer', { headers: this.getAuthHeaders() }).subscribe({
      next: (data: any) => {
        this.influencers = data;
      },
      error: () => this.showError('Erro ao carregar influenciadores.')
    });
  }

  submitInfluencer() {
  if (this.influencerForm.invalid) {
    this.influencerForm.markAllAsTouched();
    return;
  }

    const payload = this.influencerForm.value;
    const headers = this.getAuthHeaders();

    if (this.editMode && this.editingId !== null) {
      this.http.put(`/api/game/influencer/${this.editingId}`, payload, { headers }).subscribe({
        next: () => this.afterSave('Influenciador atualizado com sucesso!'),
        error: () => this.showError('Erro ao atualizar influenciador.')
      });
    } else {
      this.http.post('/api/game/influencer', payload, { headers }).subscribe({
        next: () => this.afterSave('Influenciador cadastrado com sucesso!'),
        error: () => this.showError('Erro ao cadastrar influenciador.')
      });
    }
  }

  editInfluencer(influencer: any) {
    this.editMode = true;
    this.editingId = influencer.id;

    this.influencerForm.patchValue({
      name: influencer.name,
      code: influencer.code,
      discount_percent: influencer.discount_percent,
      commission_type: influencer.commission_type,
      commission_value: influencer.commission_value,
      follower_count: influencer.follower_count,
      minimum_follower_percentage: influencer.minimum_follower_percentage,
      active: influencer.active
    });
  }

  deleteInfluencer(id: number) {
    if (!confirm('Tem certeza que deseja excluir este influenciador?')) return;

    this.http.delete(`/api/game/influencer/${id}`, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        this.loadInfluencers();
        this.showNotification('Influenciador excluído com sucesso!', 'success');
      },
      error: () => this.showError('Erro ao excluir influenciador.')
    });
  }

  resetForm() {
    this.influencerForm.reset({
      name: '',
      code: '',
      discount_percent: 0,
      commission_type: 'per_player',
      commission_value: 1,
      follower_count: 0,
      minimum_follower_percentage: 0,
      active: true
    });
    this.editMode = false;
    this.editingId = null;
  }

  get isPrizeCommission(): boolean {
    return this.influencerForm.get('commission_type')?.value === 'prize';
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

  private getAuthHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }
}
