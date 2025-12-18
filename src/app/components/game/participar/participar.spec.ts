import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Participar } from './participar';

describe('Participar', () => {
  let component: Participar;
  let fixture: ComponentFixture<Participar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Participar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Participar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
