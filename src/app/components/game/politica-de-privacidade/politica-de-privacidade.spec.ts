import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoliticaDePrivacidade } from './politica-de-privacidade';

describe('PoliticaDePrivacidade', () => {
  let component: PoliticaDePrivacidade;
  let fixture: ComponentFixture<PoliticaDePrivacidade>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoliticaDePrivacidade]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PoliticaDePrivacidade);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
