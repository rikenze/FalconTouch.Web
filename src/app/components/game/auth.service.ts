import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'token';
  private apiUrl = '/api';

  
  private userNameSubject = new BehaviorSubject<string | null>(null);
  private userEmailSubject = new BehaviorSubject<string | null>(null);
  private userIdSubject = new BehaviorSubject<string | null>(null);
  private loggedInSubject = new BehaviorSubject<boolean>(false);
  private isAdminSubject = new BehaviorSubject<boolean>(false);
  private userCpfSubject = new BehaviorSubject<string | null>(null);

  userCpf$ = this.userCpfSubject.asObservable();
  userName$ = this.userNameSubject.asObservable();
  userEmail$ = this.userEmailSubject.asObservable();
  userId$ = this.userIdSubject.asObservable();
  isLoggedIn$ = this.loggedInSubject.asObservable();
  isAdmin$ = this.isAdminSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Chame este método no início da aplicação para restaurar dados do token.
   */
  init() {
    const token = this.getToken();
    if (!token) {
      this.loggedInSubject.next(false);
      this.isAdminSubject.next(false);
      return;
    }

    try {
      const decoded: any = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        this.logout();
        return;
      }

      this.userNameSubject.next(decoded.name || null);
      this.userEmailSubject.next(decoded.email || null);
      this.userCpfSubject.next(decoded.cpf || null);
      this.userIdSubject.next(decoded.id || null);
      this.loggedInSubject.next(true);
      const role = String(
        decoded.role ||
        decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        ''
      ).toLowerCase();
      this.isAdminSubject.next(role === 'admin');
    } catch (err) {
      console.error('Erro ao decodificar token:', err);
      this.logout();
    }
  }

  loginRequest(email: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.apiUrl}/auth/login`, { email, password });
  }

  registerRequest(name: string, email: string, cpf: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.apiUrl}/auth/register`, { name, email, cpf, password });
  }

  login(token: string) {
    localStorage.setItem(this.tokenKey, token);
    this.init(); // atualiza os observables
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.userNameSubject.next(null);
    this.userEmailSubject.next(null);
    this.userIdSubject.next(null);
    this.loggedInSubject.next(false);
    this.isAdminSubject.next(false);
    this.router.navigate(['/auth']);
  }

  getToken(): string | null {
    return typeof window !== 'undefined' ? localStorage.getItem(this.tokenKey) : null;
  }

  getUserCpf(): string | null {
    return this.userCpfSubject.getValue();
  }

  getUserRole(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const decoded: any = jwtDecode(token);
      return (
        decoded.role ||
        decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        null
      );
    } catch {
      return null;
    }
  }

  isAdmin(): boolean {
    return this.isAdminSubject.getValue();
  }

  // Métodos de acesso direto
  getUserEmail(): string | null {
    return this.userEmailSubject.getValue();
  }

  getUserName(): string | null {
    return this.userNameSubject.getValue();
  }

  getUserId(): string | null {
    return this.userIdSubject.getValue();
  }

  isLoggedIn(): boolean {
    return this.loggedInSubject.getValue();
  }

  forgotPassword(email: string) {
    return this.http.post<{ message: string; token?: string }>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, { token, newPassword });
  }


}
