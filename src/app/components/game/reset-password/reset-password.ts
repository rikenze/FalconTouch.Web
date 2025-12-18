import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword implements OnInit {
  form!: FormGroup;
  token!: string;
  message = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  onSubmit() {
    if (this.form.invalid || !this.token) return;

    this.loading = true;
    this.auth.resetPassword(this.token, this.form.value.newPassword).subscribe({
      next: () => {
        this.message = 'Senha redefinida com sucesso. Você será redirecionado.';
        setTimeout(() => this.router.navigate(['/auth']), 3000);
      },
      error: (err) => {
        this.message = err.error?.message || 'Erro ao redefinir senha.';
        this.loading = false;
      }
    });
  }
}
