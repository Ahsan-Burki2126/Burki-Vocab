/**
 * Supabase connection (accounts + cloud progress).
 *
 * Configure with two environment variables (Vercel → Project → Settings → Environment Variables):
 *   VITE_SUPABASE_URL              https://<project>.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY  the project's publishable / anon key (safe to expose; data is
 *                                  protected by row-level security, see supabase/schema.sql)
 *
 * Without them the app runs exactly as before, in guest mode with progress saved on the device.
 * The Supabase library is only downloaded when accounts are configured.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AppState } from '../types';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const cloudConfigured = Boolean(URL && KEY);

let client: Promise<SupabaseClient> | null = null;

export function supabase(): Promise<SupabaseClient> {
  if (!cloudConfigured) return Promise.reject(new Error('Accounts are not set up on this site.'));
  client ||= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'burki-vocab-auth',
      },
    }),
  );
  return client;
}

export interface AccountUser {
  id: string;
  email: string;
  name: string;
}

export function toAccountUser(u: User | null | undefined): AccountUser | null {
  if (!u) return null;
  const name = (u.user_metadata?.name as string | undefined)?.trim() || (u.email ?? '').split('@')[0];
  return { id: u.id, email: u.email ?? '', name };
}

const TABLE = 'progress';

export async function loadRemote(userId: string): Promise<AppState | null> {
  const sb = await supabase();
  const { data, error } = await sb.from(TABLE).select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  const remote = (data?.data ?? null) as AppState | null;
  return remote && remote.version === 1 ? remote : null;
}

export async function saveRemote(userId: string, state: AppState): Promise<void> {
  const sb = await supabase();
  const { error } = await sb.from(TABLE).upsert({ user_id: userId, data: state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function deleteRemote(userId: string): Promise<void> {
  const sb = await supabase();
  const { error } = await sb.from(TABLE).delete().eq('user_id', userId);
  if (error) throw error;
}

/** Where email links (confirm, reset password) should send people back to. */
export function returnUrl(): string {
  return window.location.origin + window.location.pathname;
}

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message || String(e);
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox (and the spam folder).';
  if (/already registered|already exists/i.test(msg)) return 'An account with this email already exists. Sign in instead.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a while and try again.';
  if (/only request this after|security purposes/i.test(msg)) return 'Please wait a minute before trying again.';
  if (/password should be|weak password/i.test(msg)) return 'Password is too weak. Use at least 6 characters.';
  if (/failed to fetch|network|load failed/i.test(msg)) return "Can't reach the server. Check your internet connection.";
  if (/relation .*progress.* does not exist|PGRST205|schema cache/i.test(msg))
    return 'The progress table is missing. Run supabase/schema.sql in the Supabase SQL editor.';
  return msg;
}
