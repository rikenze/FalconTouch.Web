import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Regulamento } from './regulamento';

describe('Regulamento', () => {
  let component: Regulamento;
  let fixture: ComponentFixture<Regulamento>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Regulamento]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Regulamento);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
