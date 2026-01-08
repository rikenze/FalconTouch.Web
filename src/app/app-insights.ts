import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { environment } from '../environments/environment';

let appInsights: ApplicationInsights | null = null;

export function initAppInsights(): void {
  if (typeof window === 'undefined') return;
  if (appInsights) return;
  if (!environment.appInsightsConnectionString) return;

  appInsights = new ApplicationInsights({
    config: {
      connectionString: environment.appInsightsConnectionString,
      enableAutoRouteTracking: true
    }
  });

  appInsights.loadAppInsights();
  appInsights.trackPageView();
}

export function getAppInsights(): ApplicationInsights | null {
  return appInsights;
}

export function trackEvent(name: string, properties?: Record<string, any>): void {
  if (!appInsights) return;
  appInsights.trackEvent({ name }, properties);
}
