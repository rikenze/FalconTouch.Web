import { ErrorHandler, Injectable } from '@angular/core';
import { getAppInsights } from './app-insights';

@Injectable()
export class AppInsightsErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const appInsights = getAppInsights();
    if (appInsights) {
      appInsights.trackException({ exception: error instanceof Error ? error : new Error(String(error)) });
    }

    console.error(error);
  }
}
