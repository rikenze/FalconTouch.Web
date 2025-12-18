import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Award } from './award';

describe('Award', () => {
  let component: Award;
  let fixture: ComponentFixture<Award>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Award]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Award);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
