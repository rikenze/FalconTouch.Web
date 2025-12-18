import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfluencerPanel } from './influencer-panel';

describe('InfluencerPanel', () => {
  let component: InfluencerPanel;
  let fixture: ComponentFixture<InfluencerPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfluencerPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InfluencerPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
