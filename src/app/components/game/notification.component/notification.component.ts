import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  styleUrls: ['./notification.component.css'],
  standalone: true,
})
export class NotificationComponent {
  @Input() show: boolean = false;
  @Input() message: string = '';
  @Input() type: 'success' | 'error' | 'warning' = 'success';
  @Output() dismiss = new EventEmitter<void>();

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent) {
    const clickedInside = (event.target as HTMLElement).closest('.modal');
    if (!clickedInside && this.show) {
      this.dismiss.emit();
    }
  }

  close() {
    this.dismiss.emit();
  }
}
