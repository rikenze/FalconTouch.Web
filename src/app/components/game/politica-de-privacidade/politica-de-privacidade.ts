import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-politica-de-privacidade',
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  standalone: true,
  templateUrl: './politica-de-privacidade.html',
  styleUrl: './politica-de-privacidade.css'
})
export class PoliticaDePrivacidade {

}
