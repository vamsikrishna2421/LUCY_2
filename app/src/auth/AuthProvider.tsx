/**
 * AuthProvider — the app's authentication seam (Supabase).
 *
 * Holds the current session, exposes sign-in/up/out actions, keeps tokens fresh while the app is
 * foregrounded, and completes the Google OAuth round-trip via the `lucy://auth-callback` deep link.
 * AuthGate (below) renders the sign-in screen until there is a session.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { AppState, Linking, View } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, OAUTH_REDIRECT } from './supabase';

export interface SignUpResult { error?: string; needsConfirmation?: boolean; emailMayExist?: boolean }

export interface AuthValue {
  session: Session | null;
  user: User | null;
  loading: boolean;                       // initial session read from storage
  /** Error from the Google OAuth round-trip (cancelled / provider error / token exchange failed). */
  oauthError: string | null;
  clearAuthError: () => void;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/** Parse OAuth params from a redirect URL — implicit flow returns them in the `#` fragment, but
 *  errors can arrive in the `?` query, so we read both. */
function paramsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const grab = (segment: string | undefined): void => {
    if (!segment) return;
    for (const pair of segment.split('&')) {
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      try { out[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1)); } catch { /* skip */ }
    }
  };
  const hash = url.indexOf('#');
  const ques = url.indexOf('?');
  if (ques >= 0) grab(url.slice(ques + 1, hash >= 0 ? hash : undefined));
  if (hash >= 0) grab(url.slice(hash + 1));
  return out;
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Initial session (from encrypted SQLite) + live updates.
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Keep the access token fresh only while foregrounded (supabase's recommended RN pattern).
  useEffect(() => {
    const apply = (state: string): void => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    apply(AppState.currentState);
    const sub = AppState.addEventListener('change', apply);
    return () => sub.remove();
  }, []);

  // Complete Google OAuth: the system browser redirects to lucy://auth-callback#access_token=…
  // (or ?error=… if the user cancels / the provider rejects). We OWN this URL — surface every outcome
  // so the sign-in screen never silently dead-ends.
  useEffect(() => {
    const handle = async (url: string | null): Promise<void> => {
      if (!url || !url.includes('auth-callback')) return;
      try {
        const p = paramsFromUrl(url);
        if (p.error || p.error_description) {
          const msg = (p.error_description || p.error || '').replace(/\+/g, ' ');
          setOauthError(/access_denied|cancel/i.test(`${p.error} ${p.error_description}`)
            ? 'Google sign-in was cancelled.'
            : `Google sign-in failed: ${msg || 'please try again.'}`);
          return;
        }
        if (p.access_token && p.refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
          if (error) setOauthError(`Could not finish sign-in: ${error.message}`);
          // success → onAuthStateChange fires SIGNED_IN and AuthGate swaps to the app.
          return;
        }
        // Returned to the callback but with neither tokens nor an error — unexpected.
        setOauthError('Could not complete Google sign-in. Please try again.');
      } catch (e) {
        setOauthError(e instanceof Error ? e.message : 'Could not complete Google sign-in.');
      }
    };
    const sub = Linking.addEventListener('url', (e) => void handle(e.url));
    void Linking.getInitialURL().then(handle).catch(() => { /* none */ });
    return () => sub.remove();
  }, []);

  const clearAuthError = useCallback(() => setOauthError(null), []);

  const signInWithEmail = useCallback<AuthValue['signInWithEmail']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    return { error: error?.message };
  }, []);

  const signUpWithEmail = useCallback<AuthValue['signUpWithEmail']>(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
    if (error) return { error: error.message };
    // Supabase anti-enumeration: an already-registered email returns an obfuscated user with an
    // EMPTY identities array (and no session). Detect it so we don't show a false "check your email".
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { emailMayExist: true };
    }
    // No session ⇒ email confirmation required (mailer_autoconfirm off).
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithGoogle = useCallback<AuthValue['signInWithGoogle']>(async () => {
    setOauthError(null);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'Could not start Google sign-in.' };
    const ok = await Linking.canOpenURL(data.url).catch(() => true);
    if (!ok) return { error: 'No browser available to sign in.' };
    await Linking.openURL(data.url);
    return {};
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setOauthError(null);
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    oauthError,
    clearAuthError,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
  }), [session, loading, oauthError, clearAuthError, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * AuthGate — renders `children` (the authenticated app) only when signed in, and `fallback` (the
 * sign-in screen) when signed out. During the brief initial session read we render a neutral view
 * (the native splash is still up over it) so the heavy app shell never mounts for signed-out users.
 */
export function AuthGate({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }): React.ReactElement {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, backgroundColor: '#0C0B09' }} />;
  return <>{session ? children : fallback}</>;
}
