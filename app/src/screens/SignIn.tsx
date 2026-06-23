/**
 * SignIn — the unauthenticated entry screen (Email + Google). Rendered by AuthGate whenever there is
 * no Supabase session. On success the session updates and AuthGate swaps in the app automatically.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, TextField, useTheme } from '../ui';
import { useAuth } from '../auth/AuthProvider';

type Mode = 'signin' | 'signup';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInScreen(): React.ReactElement {
  const { colors, spacing } = useTheme();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, oauthError, clearAuthError } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // The native splash is held until the app shell mounts; when we land on sign-in instead, hide it.
  useEffect(() => { void SplashScreen.hideAsync().catch(() => {}); }, []);

  const resetMessages = useCallback(() => { setError(null); setInfo(null); clearAuthError(); }, [clearAuthError]);

  const submit = useCallback(async () => {
    resetMessages();
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) { setError('Enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error: err } = await signInWithEmail(mail, password);
        if (err) setError(err);
      } else {
        const { error: err, needsConfirmation, emailMayExist } = await signUpWithEmail(mail, password);
        if (err) setError(err);
        else if (emailMayExist) setError('An account with this email may already exist. Try signing in, or reset your password.');
        else if (needsConfirmation) setInfo('Account created. Check your email to confirm, then sign in.');
        // else: session is live → AuthGate swaps to the app automatically.
      }
    } finally {
      setBusy(false);
    }
  }, [mode, email, password, signInWithEmail, signUpWithEmail, resetMessages]);

  const onGoogle = useCallback(async () => {
    resetMessages();
    setGoogleBusy(true);
    try {
      const { error: err } = await signInWithGoogle();
      if (err) setError(err);
      // On success the system browser opens; the session (or an error) arrives via the deep-link handler.
    } finally {
      setGoogleBusy(false);
    }
  }, [signInWithGoogle, resetMessages]);

  const anyBusy = busy || googleBusy;
  const shownError = error || oauthError;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { padding: spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={[styles.brand, { marginBottom: spacing.xxl }]}>
            <View style={styles.logoRow}>
              <Text variant="display" weight="900" style={{ letterSpacing: 1.5 }}>
                LUC<Text variant="display" weight="900" color="accent">Y</Text>
              </Text>
              <Text variant="h3" color="accent" style={{ marginLeft: 2, marginTop: -6 }}>✦</Text>
            </View>
            <Text variant="callout" color="textMuted" align="center" style={{ marginTop: spacing.sm }}>
              {mode === 'signin' ? 'Welcome back — sign in to your second brain.' : 'Create your account to get started.'}
            </Text>
          </View>

          {/* Email + password */}
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            leadingIcon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            disabled={anyBusy}
            containerStyle={{ marginBottom: spacing.base }}
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
            leadingIcon="lock-closed-outline"
            trailingIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onTrailingPress={() => setShowPassword((s) => !s)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            disabled={anyBusy}
            onSubmitEditing={() => void submit()}
            returnKeyType="go"
          />

          {shownError ? (
            <Text variant="footnote" color="danger" style={{ marginTop: spacing.md }}>{shownError}</Text>
          ) : info ? (
            <Text variant="footnote" color="success" style={{ marginTop: spacing.md }}>{info}</Text>
          ) : null}

          {/* Primary action */}
          <Button
            label={mode === 'signin' ? 'Sign in' : 'Create account'}
            onPress={() => void submit()}
            loading={busy}
            disabled={anyBusy}
            size="lg"
            fullWidth
            style={{ marginTop: spacing.lg }}
          />

          {/* Divider */}
          <View style={[styles.dividerRow, { marginVertical: spacing.lg }]}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text variant="caption" color="textFaint" style={{ marginHorizontal: spacing.md }}>OR</Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>

          {/* Google */}
          <Button
            label="Continue with Google"
            onPress={() => void onGoogle()}
            loading={googleBusy}
            disabled={anyBusy}
            variant="secondary"
            size="lg"
            icon="logo-google"
            fullWidth
          />

          {/* Mode toggle */}
          <View style={[styles.toggleRow, { marginTop: spacing.xl }]}>
            <Text variant="footnote" color="textMuted">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <Text
              variant="footnote"
              color="accent"
              weight="700"
              onPress={anyBusy ? undefined : () => { setMode((m) => (m === 'signin' ? 'signup' : 'signin')); resetMessages(); }}
              style={{ marginLeft: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.xs }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </Text>
          </View>

          <Text variant="caption" color="textFaint" align="center" style={{ marginTop: spacing.xxl }}>
            Your notes stay encrypted on your device. <Ionicons name="lock-closed" size={10} />
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dividerRow: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

export default SignInScreen;
