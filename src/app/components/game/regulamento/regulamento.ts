import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-regulamento',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './regulamento.html',
  styleUrls: ['./regulamento.css']
})
export class Regulamento {
  constructor(private router: Router) {}

  voltar() {
    this.router.navigate(['/']);
  }
}
