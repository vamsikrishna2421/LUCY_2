/**
 * Verifies a LUCY app user from the request's `Authorization: Bearer <supabase access token>` header.
 * The token is the user's Supabase session JWT (sent by the mobile app); we validate it server-side
 * via the admin client, which confirms the signature + expiry and returns the user.
 */
import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabaseAdmin';

export interface AuthedUser { user: User | null; error?: string }

export function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

export async function getUserFromRequest(req: NextRequest): Promise<AuthedUser> {
  const token = bearerToken(req);
  if (!token) return { user: null, error: 'Missing Authorization bearer token.' };
  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    if (error || !data.user) return { user: null, error: error?.message ?? 'Invalid or expired token.' };
    return { user: data.user };
  } catch (e) {
    return { user: null, error: e instanceof Error ? e.message : 'Auth verification failed.' };
  }
}
