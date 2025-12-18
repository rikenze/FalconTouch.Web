import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { Play } from './components/game/play/play';
import { Award } from './components/game/award/award';
import { AuthComponent } from './components/auth.component/auth.component';
import { Participar } from './components/game/participar/participar';
import { Regulamento } from './components/game/regulamento/regulamento';
import { PoliticaDePrivacidade } from './components/game/politica-de-privacidade/politica-de-privacidade';
import { ResetPassword } from './components/game/reset-password/reset-password';
import { Footer } from './components/footer/footer';
import { InfluencerPanel } from './components/influencer-panel/influencer-panel';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'award',
    pathMatch: 'full'
  },
  {
    path: 'award',
    component: Award
  },
  {
    path: 'play',
    component: Play,
    // canActivate: [AuthGuard]
  },
  {
    path: 'auth',
    component: AuthComponent
  },
  {
    path: 'participar',
    component: Participar
  },
  {
    path: 'regulamento',
    component: Regulamento
  },
  {
    path: 'politica-de-privacidade',
    component: PoliticaDePrivacidade
  },
  {
    path: 'reset-password',
    component: ResetPassword
  },
  {
    path: 'influencer-panel',
    component: InfluencerPanel
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
