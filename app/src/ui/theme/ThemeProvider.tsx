/**
 * ThemeProvider / useTheme — the single hook every primitive uses to reach tokens.
 *
 * Today the theme is static (the dark palette in `tokens.ts`). It is wrapped in a context anyway so
 * that a future light theme — or per-user accent swaps (a 1.0 feature) — is a provider-level change,
 * not a find-replace across every component. Components MUST read tokens via `useTheme()` rather than
 * importing `tokens` directly, so they stay theme-agnostic.
 */
import React, { createContext, useContext, useMemo } from 'react';
import tokens, { type Tokens } from './tokens';

export interface Theme extends Tokens {
  /** Identifier for the active theme — lets components branch if ever needed (e.g. status bar). */
  name: 'dark';
  /** Convenience: true when the active theme is dark (always true today). */
  isDark: boolean;
}

const darkTheme: Theme = { ...tokens, name: 'dark', isDark: true };

const ThemeContext = createContext<Theme>(darkTheme);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Override the theme (reserved for future light/accent variants). Defaults to dark. */
  theme?: Theme;
}

export function ThemeProvider({ children, theme }: ThemeProviderProps): React.ReactElement {
  const value = useMemo(() => theme ?? darkTheme, [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme tokens. Safe outside a provider — falls back to the dark theme. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export { tokens, darkTheme };
