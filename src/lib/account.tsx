import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useUI } from '../components/UI';
import type { AppState } from '../types';
import { cloudConfigured, deleteRemote, friendlyError, loadRemote, returnUrl, saveRemote, supabase, toAccountUser, type AccountUser } from './cloud';
import { ensureToday } from './daily';
import { dateKey } from './dates';
import { go } from './router';
import { useStore } from './store';
import { isPristine, mergeStates, signature } from './sync';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface Account {
  configured: boolean;
  ready: boolean;
  user: AccountUser | null;
  status: SyncStatus;
  lastSynced: number | null;
  syncError: string | null;
  /** True after opening a password-reset link: show the "choose a new password" form. */
  recovery: boolean;
  signUp: (name: string, email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: (clearDevice: boolean) => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  syncNow: () => Promise<void>;
  deleteCloud: () => Promise<void>;
}

const Ctx = createContext<Account | null>(null);
const PUSH_DELAY = 2000;
const PULL_EVERY = 20_000;

export function AccountProvider({ children }: { children: ReactNode }) {
  const { state, replaceState, clearDevice } = useStore();
  const { toast } = useUI();
  const [ready, setReady] = useState(!cloudConfigured);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const userRef = useRef<AccountUser | null>(null);
  userRef.current = user;
  const syncedFor = useRef<string | null>(null); // user id whose first sync has finished
  const lastPushed = useRef<string>('');
  const pushTimer = useRef<number>();
  const lastPull = useRef(0);
  const busy = useRef(false);

  // ---- session ----
  useEffect(() => {
    if (!cloudConfigured) return;
    let unsub: (() => void) | undefined;
    supabase()
      .then(async (sb) => {
        const params = new URLSearchParams(window.location.search);
        const linkError = params.get('error_description');
        const hadCode = params.has('code');
        const { data } = await sb.auth.getSession();
        setUser(toAccountUser(data.session?.user));
        setReady(true);
        if (hadCode || linkError) {
          // tidy the address bar after an email link
          window.history.replaceState(null, '', window.location.pathname + window.location.hash);
          if (linkError) toast(linkError.replace(/\+/g, ' '));
          else if (!data.session) toast('That link could not be used here. Open it in the same browser you used to request it, or sign in.');
        }
        const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
          setUser(toAccountUser(session?.user));
          if (event === 'PASSWORD_RECOVERY') {
            setRecovery(true);
            go('account');
          }
        });
        unsub = () => sub.subscription.unsubscribe();
      })
      .catch(() => setReady(true));
    return () => unsub?.();
  }, [toast]);

  // ---- sync engine ----
  const pullAndMerge = useCallback(async (u: AccountUser, first: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setStatus('syncing');
    try {
      const remote = await loadRemote(u.id);
      const local = stateRef.current;
      let merged: AppState;
      if (!remote) merged = local;
      else if (first && isPristine(local)) merged = { ...remote, updatedAt: remote.updatedAt ?? Date.now() };
      else merged = mergeStates(remote, local);
      merged = ensureToday(merged, dateKey());
      if (signature(merged) !== signature(local)) replaceState(merged);
      if (!remote || signature(merged) !== signature(remote)) await saveRemote(u.id, merged);
      lastPushed.current = signature(merged);
      lastPull.current = Date.now();
      syncedFor.current = u.id;
      setLastSynced(Date.now());
      setSyncError(null);
      setStatus('synced');
    } catch (e) {
      setSyncError(friendlyError(e));
      setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      busy.current = false;
    }
  }, [replaceState]);

  const push = useCallback(async () => {
    const u = userRef.current;
    if (!u || syncedFor.current !== u.id) return;
    const s = stateRef.current;
    const sig = signature(s);
    if (sig === lastPushed.current) return;
    setStatus('syncing');
    try {
      await saveRemote(u.id, s);
      lastPushed.current = sig;
      setLastSynced(Date.now());
      setSyncError(null);
      setStatus('synced');
    } catch (e) {
      setSyncError(friendlyError(e));
      setStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, []);

  // first sync after sign-in (or on load with a saved session)
  useEffect(() => {
    if (!user) {
      syncedFor.current = null;
      setStatus('idle');
      return;
    }
    if (syncedFor.current !== user.id) void pullAndMerge(user, true);
  }, [user, pullAndMerge]);

  // push local changes shortly after they happen
  useEffect(() => {
    if (!user || syncedFor.current !== user.id) return;
    if (signature(state) === lastPushed.current) return;
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void push(), PUSH_DELAY);
    return () => window.clearTimeout(pushTimer.current);
  }, [state, user, push]);

  // pick up progress from other devices when coming back to the app; flush when leaving
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(pushTimer.current);
        void push();
      } else if (Date.now() - lastPull.current > PULL_EVERY && syncedFor.current === user.id) {
        void pullAndMerge(user, false);
      }
    };
    const onFocus = () => {
      if (Date.now() - lastPull.current > PULL_EVERY && syncedFor.current === user.id) void pullAndMerge(user, false);
    };
    const onOnline = () => void (syncedFor.current === user.id ? push() : pullAndMerge(user, true));
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [user, push, pullAndMerge]);

  // ---- actions ----
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const sb = await supabase();
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: returnUrl() },
    });
    if (error) throw new Error(friendlyError(error));
    // Supabase returns a user with no identities when the email is already registered
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Sign in instead.');
    }
    return { needsConfirm: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = await supabase();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(friendlyError(error));
  }, []);

  const signOut = useCallback(
    async (clear: boolean) => {
      window.clearTimeout(pushTimer.current);
      await push().catch(() => undefined);
      const sb = await supabase();
      await sb.auth.signOut().catch(() => undefined);
      syncedFor.current = null;
      lastPushed.current = '';
      setUser(null);
      setRecovery(false);
      if (clear) clearDevice();
    },
    [push, clearDevice],
  );

  const sendReset = useCallback(async (email: string) => {
    const sb = await supabase();
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: returnUrl() });
    if (error) throw new Error(friendlyError(error));
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const sb = await supabase();
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw new Error(friendlyError(error));
    setRecovery(false);
  }, []);

  const updateName = useCallback(async (name: string) => {
    const sb = await supabase();
    const { data, error } = await sb.auth.updateUser({ data: { name: name.trim() } });
    if (error) throw new Error(friendlyError(error));
    setUser(toAccountUser(data.user));
  }, []);

  const syncNow = useCallback(async () => {
    const u = userRef.current;
    if (u) await pullAndMerge(u, syncedFor.current !== u.id);
  }, [pullAndMerge]);

  const deleteCloud = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;
    await deleteRemote(u.id);
    // local copy stays; stop syncing until the next sign-in re-uploads it
    window.clearTimeout(pushTimer.current);
    await signOut(false);
  }, [signOut]);

  const value = useMemo<Account>(
    () => ({
      configured: cloudConfigured,
      ready,
      user,
      status,
      lastSynced,
      syncError,
      recovery,
      signUp,
      signIn,
      signOut,
      sendReset,
      updatePassword,
      updateName,
      syncNow,
      deleteCloud,
    }),
    [ready, user, status, lastSynced, syncError, recovery, signUp, signIn, signOut, sendReset, updatePassword, updateName, syncNow, deleteCloud],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): Account {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount outside AccountProvider');
  return v;
}
