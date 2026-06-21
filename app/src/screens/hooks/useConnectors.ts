/**
 * useConnectors — the Connectors screen's logic seam.
 *
 * The ONLY place the redesigned Connectors screen touches frozen logic. Wraps the exact entry points
 * named in docs/04_SEAM_REPORT.md (Connectors row) with identical arguments and outcomes:
 *
 *   db/settings                 → getSetting, setSetting
 *   processing/calendarConnector→ requestCalendarPermission, hasCalendarPermission
 *   audio/PassiveListener       → passiveListener (.start/.stop)
 *   processing/notifications    → scheduleProgressCheckIn, cancelProgressCheckIn
 *
 * Plus the same OS/permission calls + lazily-imported background-location module Connectors 1.0 used
 * (expo-battery is imported by 1.0 but unused there — for true parity this hook does not call it
 * either). No logic is changed — toggle behavior matches Connectors 1.0 exactly. Each handler returns a
 * `ToggleResult` describing the user-facing outcome so the screen owns presentation (Toast vs. Alert):
 * the screen decides chrome, the hook owns logic.
 */
import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { getDatabase } from '../../db';
import { getSetting, setSetting } from '../../db/settings';
import { requestCalendarPermission, hasCalendarPermission } from '../../processing/calendarConnector';
import { passiveListener } from '../../audio/PassiveListener';
import { scheduleProgressCheckIn, cancelProgressCheckIn } from '../../processing/notifications';

export type ConnectorId =
  | 'calendar' | 'location' | 'battery_tracking' | 'progress_checkins' | 'passive_listening' | 'meeting_mode';

export type ConnectorState = Record<ConnectorId, boolean>;

/**
 * The outcome of a toggle, so the screen can render the right feedback:
 *  - `applied`: whether the connector's enabled value actually changed (drives the switch).
 *  - `notice`: an optional message; `tone` info|success for a Toast, `permission` for an Alert that
 *    should route the user to system Settings (kept as a blocking Alert, as in 1.0).
 */
export interface ToggleResult {
  applied: boolean;
  enabled: boolean;
  notice?: { title: string; message: string; tone: 'success' | 'info' | 'permission' };
}

export interface UseConnectors {
  connectors: ConnectorState;
  loading: Record<string, boolean>;
  /** Run a connector's toggle (frozen logic). Returns the outcome for the screen to present. */
  toggle: (id: ConnectorId, enable: boolean) => Promise<ToggleResult>;
}

const INITIAL: ConnectorState = {
  calendar: false,
  location: false,
  battery_tracking: true, // already running
  progress_checkins: false,
  passive_listening: false,
  meeting_mode: true, // always available
};

export function useConnectors(): UseConnectors {
  const [connectors, setConnectors] = useState<ConnectorState>(INITIAL);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Initial permission/state hydration — identical to Connectors 1.0's mount effect.
  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      const [calPerm, checkinId, locationPerm] = await Promise.all([
        hasCalendarPermission(),
        getSetting(db, 'progress_checkin_notification_id'),
        Location.getForegroundPermissionsAsync().catch(() => ({ status: 'denied' as Location.PermissionStatus })),
      ]);
      setConnectors((prev) => ({
        ...prev,
        calendar: calPerm,
        progress_checkins: !!checkinId,
        location: locationPerm.status === 'granted',
      }));
    })();
  }, []);

  const setEnabled = useCallback((id: ConnectorId, val: boolean) => {
    setConnectors((prev) => ({ ...prev, [id]: val }));
  }, []);

  const runToggle = useCallback(async (id: ConnectorId, enable: boolean): Promise<ToggleResult> => {
    const db = await getDatabase();
    switch (id) {
      case 'calendar': {
        if (enable) {
          const granted = await requestCalendarPermission();
          if (!granted) {
            return { applied: false, enabled: false, notice: { title: 'Permission needed', message: 'Go to Settings → LUCY → Calendars to grant access.', tone: 'permission' } };
          }
          setEnabled('calendar', true);
          return { applied: true, enabled: true, notice: { title: 'Calendar connected', message: 'LUCY will send pre-meeting briefs and help you prepare for meetings.', tone: 'success' } };
        }
        setEnabled('calendar', false);
        return { applied: true, enabled: false, notice: { title: 'Calendar disconnected', message: 'LUCY will no longer read your calendar. Re-enable anytime.', tone: 'info' } };
      }

      case 'location': {
        if (enable) {
          // Try "Always" (best — background ~1h). Fall back to "when in use" if only foreground granted.
          const { startBackgroundLocationTracking } = await import('../../processing/backgroundLocation');
          const started = await startBackgroundLocationTracking();
          if (started) {
            setEnabled('location', true);
            return { applied: true, enabled: true };
          }
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            return { applied: false, enabled: false, notice: { title: 'Permission needed', message: 'Go to Settings → LUCY → Location to grant access.', tone: 'permission' } };
          }
          setEnabled('location', true);
          return { applied: true, enabled: true, notice: { title: 'Location enabled (app-open only)', message: 'LUCY will record your location when you open the app. For travel tracking while the phone is in your pocket, grant "Always" location access in Settings → LUCY → Location.', tone: 'permission' } };
        }
        const { stopBackgroundLocationTracking } = await import('../../processing/backgroundLocation');
        await stopBackgroundLocationTracking();
        setEnabled('location', false);
        return { applied: true, enabled: false };
      }

      case 'battery_tracking': {
        setEnabled('battery_tracking', enable);
        await setSetting(db, 'battery_tracking_enabled', enable ? 'true' : 'false');
        return { applied: true, enabled: enable };
      }

      case 'progress_checkins': {
        if (enable) {
          const notifId = await scheduleProgressCheckIn();
          if (notifId) {
            await setSetting(db, 'progress_checkin_notification_id', notifId);
            setEnabled('progress_checkins', true);
            return { applied: true, enabled: true };
          }
          return { applied: false, enabled: false };
        }
        const existingId = await getSetting(db, 'progress_checkin_notification_id');
        if (existingId) await cancelProgressCheckIn(existingId);
        await setSetting(db, 'progress_checkin_notification_id', '');
        setEnabled('progress_checkins', false);
        return { applied: true, enabled: false };
      }

      case 'passive_listening': {
        if (enable) {
          await passiveListener.start();
          setEnabled('passive_listening', true);
          return { applied: true, enabled: true };
        }
        await passiveListener.stop();
        setEnabled('passive_listening', false);
        return { applied: true, enabled: false };
      }

      case 'meeting_mode': {
        setEnabled('meeting_mode', enable);
        return { applied: true, enabled: enable };
      }

      default:
        return { applied: false, enabled: false };
    }
  }, [setEnabled]);

  const toggle = useCallback(async (id: ConnectorId, enable: boolean): Promise<ToggleResult> => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      return await runToggle(id, enable);
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }, [runToggle]);

  return { connectors, loading, toggle };
}
