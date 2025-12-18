import { CommonModule, ViewportScroller, isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Inject, Input, Output, PLATFORM_ID, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './ranking.html',
  styleUrl: './ranking.css'
})
export class Ranking {
  @Input() visible: boolean = false;
  @Input() data: { email: string, time: number }[] = [];
  @Output() close = new EventEmitter<void>();

  @ViewChild('rankingRef') rankingRef!: ElementRef;
  isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

    // Fecha ao clicar fora do modal
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInside = this.rankingRef?.nativeElement?.contains(event.target);
    if (!clickedInside && this.visible) {
      this.close.emit();
    }
  }

  onClose() {
    this.close.emit();
  }
}
