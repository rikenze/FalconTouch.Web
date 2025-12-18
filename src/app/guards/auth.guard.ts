import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  canActivate(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      // Evita quebra no lado do servidor
      return false;
    }

    const token = localStorage.getItem('token');

    if (token) return true;

    alert('Você precisa estar logado!');
    this.router.navigate(['/auth']);
    return false;
  }
}
