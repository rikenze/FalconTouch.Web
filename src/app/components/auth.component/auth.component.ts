import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../game/auth.service';
import { NotificationComponent } from '../game/notification.component/notification.component';
import { SignalRService } from '../game/signalr.service';
import { NgxMaskDirective } from 'ngx-mask';
import { ConfirmDialog } from '../game/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [NgxMaskDirective, CommonModule, ReactiveFormsModule, NotificationComponent, FormsModule, ConfirmDialog],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent {
  authForm: FormGroup;
  isLogin = true;

  showNotificationDialog = false;
  notificationMessage = '';
  notificationType: 'success' | 'error' | 'warning' = 'success';
  showPassword = false;
  aceitaPolitica: boolean = false;

  showConfirmDialog = false;
  confirmMessage = '';
  confirmCallback?: (confirmed: boolean) => void;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private signalRService: SignalRService
  ) {
    this.authForm = this.createForm();
  }

  createForm(): FormGroup {
    const controls: any = {
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    };

    if (!this.isLogin) {
      controls.name = ['', [Validators.required, Validators.pattern(/^[\p{L} ]+$/u)]];
      controls.email = ['', [Validators.required, Validators.email]];
      controls.cpf = ['', Validators.required];
      controls.aceitaPolitica = ['', Validators.required];
    }

    return this.fb.group(controls);
  }

  toggleMode() {
    this.isLogin = !this.isLogin;

    if (!this.isLogin) {
      this.authForm.addControl('name', this.fb.control('', [Validators.required, Validators.pattern(/^[\p{L} ]+$/u)]));
      this.authForm.addControl('cpf', this.fb.control('', Validators.required));
      this.authForm.addControl('aceitaPolitica', this.fb.control('', Validators.required));
    } else {
      this.authForm.removeControl('name');
      this.authForm.removeControl('cpf');
      this.authForm.removeControl('aceitaPolitica');
    }
  }

  onSubmit() {
    if (this.authForm.invalid) {
        this.authForm.markAllAsTouched();
        return;
    }

    if (!this.isLogin && !this.authForm.get('aceitaPolitica')?.value) {
      this.showNotification('Você precisa aceitar a Política de Privacidade para continuar.', 'warning');
      return;
    }
    
    const { name, email, password, cpf } = this.authForm.value;

    const request$ = this.isLogin
      ? this.auth.loginRequest(email, password)
      : this.auth.registerRequest(name, email, cpf, password);

    request$.subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        this.auth.login(res.token);
        this.signalRService.updateAuthToken(res.token);
        this.router.navigate(['/award']);
      },
      error: (err) => {
        this.showNotification(err.error?.message || 'Erro ao autenticar', 'error');
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

  async openPasswordReset() {
    const email = this.authForm.get('email')?.value;
    if (!email || this.authForm.get('email')?.invalid) {
      this.showNotification('Informe um email válido para recuperar a senha.', 'warning');
      return;
    }

    const confirmed = await this.askConfirm('Tem certeza que deseja redefinir sua senha?');
    if (!confirmed) return;

    this.auth.forgotPassword(email).subscribe({
      next: () => {
        this.showNotification('Email de recuperação enviado com sucesso.', 'success');
      },
      error: (err: { error: { message: any; }; }) => {
        this.showNotification(err.error?.message || 'Erro ao enviar email de recuperação.', 'error');
      }
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

}
