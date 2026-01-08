import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { initAppInsights } from './app/app-insights';

initAppInsights();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
