import { RouterOutlet } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { UserBar } from './components/user-bar/user-bar';
import { CommonModule } from '@angular/common';
import { AuthService } from '../app/components/game/auth.service';
import { Footer } from "./components/footer/footer";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, UserBar, RouterOutlet, Footer],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.init();
  }
}
