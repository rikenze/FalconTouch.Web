import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  OnInit,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../game/auth.service';
import { SignalRService } from '../game/signalr.service';

@Component({
  selector: 'app-user-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-bar.html',
  styleUrls: ['./user-bar.css'],
})
export class UserBar implements OnInit {
  userName = 'Usuário';
  userId = '0000';
  isLoggedIn = false;
  isSidebarOpen = false;
  isBrowser = false;
  isAdmin = false;

  @ViewChild('sidebar', { static: false }) sidebarRef!: ElementRef;

  constructor(
    private router: Router,
    private auth: AuthService,
    private signalRService: SignalRService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      this.auth.userEmail$.subscribe(email => {
        this.userName = email || 'Usuário';
      });

      this.auth.userId$.subscribe(id => {
        this.userId = id || '0000';
      });

      this.auth.isLoggedIn$.subscribe(status => {
        this.isLoggedIn = status;
      });
      
      this.auth.isAdmin$.subscribe(status => {
        this.isAdmin = status;
      });
    }
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (
      this.sidebarRef &&
      this.sidebarRef.nativeElement &&
      !this.sidebarRef.nativeElement.contains(event.target)
    ) {
      this.isSidebarOpen = false;
    }
  }

  navigateTo(section: string) {
    this.toggleSidebar();
    this.router.navigate([`/${section}`]);
  }

  goToRegulamento(){
    this.router.navigate(['/regulamento']);
  }

  goToHome() {
    this.router.navigate(['/award']);
  }

  login() {
    this.router.navigate(['/auth']);
  }

  logout() {
    this.signalRService.disconnect();
    this.auth.logout();
  }

  goToProfile() {
    this.router.navigate(['/perfil']);
  }
}
