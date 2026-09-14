import { trackPilotEvent, type PilotMetricEventType } from '@/lib/pilot-ops/client';

export type ClinicianAnalyticsEventName =
  | 'clinician.sign_in'
  | 'clinician.onboarding_started'
  | 'clinician.onboarding_completed'
  | 'clinician.readiness_viewed'
  | 'clinician.blocker_opened'
  | 'clinician.blocker_resolved'
  | 'clinician.opportunity_viewed'
  /** The Roles list checked its rows against the clinician's stated terms; counts only. */
  | 'clinician.terms_checked'
  | 'clinician.apply_started'
  | 'clinician.apply_submitted'
  | 'clinician.application_detail_viewed'
  | 'clinician.alert_viewed'
  | 'clinician.application_status_viewed'
  | 'clinician.wallet_viewed'
  | 'clinician.return_session';

const PILOT_EVENT_MAP: Partial<Record<ClinicianAnalyticsEventName, PilotMetricEventType>> = {
  'clinician.onboarding_started': 'onboarding_started',
  'clinician.onboarding_completed': 'onboarding_completed',
  'clinician.readiness_viewed': 'readiness_viewed',
  'clinician.blocker_opened': 'blocker_opened',
  'clinician.blocker_resolved': 'blocker_resolved',
  'clinician.opportunity_viewed': 'opportunity_viewed',
  'clinician.apply_started': 'apply_started',
  'clinician.apply_submitted': 'apply_submitted',
  'clinician.application_detail_viewed': 'application_detail_viewed',
  'clinician.application_status_viewed': 'application_status_viewed',
  'clinician.alert_viewed': 'alert_viewed',
  'clinician.wallet_viewed': 'wallet_viewed',
  'clinician.return_session': 'return_session',
};

function onceKey(key: string): string {
  return `vitalcv.analytics.once.${key}`;
}

export async function trackClinicianEvent(
  name: ClinicianAnalyticsEventName,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const pilotEventType = PILOT_EVENT_MAP[name];

  try {
    await Promise.allSettled([
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name,
          properties,
        }),
        keepalive: true,
      }),
      pilotEventType
        ? trackPilotEvent({
            eventType: pilotEventType,
            details: properties,
            oncePerSession: false,
          })
        : Promise.resolve(),
    ]);
  } catch {
    // Best-effort launch analytics should never block the clinician flow.
  }
}

export async function trackClinicianEventOncePerSession(
  key: string,
  name: ClinicianAnalyticsEventName,
  properties: Record<string, unknown> = {},
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = onceKey(key);
  if (window.sessionStorage.getItem(storageKey)) {
    return;
  }

  window.sessionStorage.setItem(storageKey, '1');
  await trackClinicianEvent(name, properties);
}
