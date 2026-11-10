import { useState, type FormEvent } from 'react';
import { useUI } from '../components/UI';
import { IconCheck, IconCloud, IconUser } from '../components/Icons';
import { useAccount } from '../lib/account';
import { counts } from '../lib/metrics';
import { useStore } from '../lib/store';

type Mode = 'signin' | 'signup' | 'reset';

export default function Account() {
  const acc = useAccount();
  return (
    <div className="page narrow">
      <div className="learn-head">
        <h2 style={{ fontSize: 24 }}>Account</h2>
        {acc.user && <SyncPill />}
      </div>
      {!acc.configured ? <NotConfigured /> : !acc.ready ? <div className="card muted">Loading…</div> : acc.recovery ? <NewPassword /> : acc.user ? <SignedIn /> : <AuthForms />}
    </div>
  );
}

export function SyncPill() {
  const { status } = useAccount();
  const map = {
    idle: ['', 'Not synced'],
    syncing: ['primary', 'Syncing…'],
    synced: ['success', 'Synced'],
    offline: ['review', 'Offline — will sync'],
    error: ['error', 'Sync problem'],
  } as const;
  const [cls, label] = map[status];
  return (
    <span className={`pill ${cls}`} role="status">
      {status === 'synced' ? <IconCheck width={13} height={13} /> : <IconCloud width={13} height={13} />} {label}
    </span>
  );
}

function NotConfigured() {
  return (
    <div className="card stack">
      <div className="row">
        <span className="brand-mark" style={{ background: 'var(--line-2)', color: 'var(--ink-3)', boxShadow: 'none' }}>
          <IconCloud width={18} height={18} />
        </span>
        <h3 style={{ fontSize: 18 }}>Accounts aren't switched on for this site yet</h3>
      </div>
      <p className="muted small">
        Your progress is saved on this device and everything works in guest mode. To let learners create accounts and sync across devices, the
        site owner connects a free Supabase project: run <code>supabase/schema.sql</code>, then add <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in Vercel and redeploy. Steps are in the README.
      </p>
    </div>
  );
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  return (
    <label className="field">
      <span className="eyebrow">{label}</span>
      <span className="search" style={{ minHeight: 48 }}>
        <input
          type={isPw && show ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={isPw ? 6 : undefined}
          aria-label={label}
        />
        {isPw && (
          <button type="button" className="link-btn" style={{ minHeight: 36 }} onClick={() => setShow((s) => !s)}>
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </span>
    </label>
  );
}

function AuthForms() {
  const acc = useAccount();
  const { state } = useStore();
  const { toast } = useUI();
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const c = counts(state);
  const hasLocal = c.learned + c.known > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signup') {
        const { needsConfirm } = await acc.signUp(name, email, password);
        if (needsConfirm) setNotice(`Almost done. We sent a confirmation link to ${email}. Open it on this device, then sign in.`);
        else toast('Account created. Your progress is now saved to your account.');
      } else if (mode === 'signin') {
        await acc.signIn(email, password);
        toast('Signed in. Syncing your progress…');
      } else {
        await acc.sendReset(email);
        setNotice(`If an account exists for ${email}, a reset link is on its way. Open it in this browser.`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack">
      <div>
        <h3 style={{ fontSize: 18 }}>{mode === 'signup' ? 'Create your account' : mode === 'signin' ? 'Welcome back' : 'Reset your password'}</h3>
        <p className="muted small" style={{ marginTop: 4 }}>
          {mode === 'reset'
            ? "Enter your email and we'll send you a link to choose a new password."
            : 'Save your progress to your account and continue on any phone or computer.'}
          {mode !== 'reset' && hasLocal && ` Your ${c.learned + c.known} words learned on this device will be added to your account.`}
        </p>
      </div>
      {mode !== 'reset' && (
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
            Create account
          </button>
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>
            Sign in
          </button>
        </div>
      )}
      <form className="stack" onSubmit={submit}>
        {mode === 'signup' && <Field label="Your name" value={name} onChange={setName} autoComplete="name" placeholder="e.g. Ahsan" />}
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" />
        {mode !== 'reset' && (
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="At least 6 characters"
          />
        )}
        {error && (
          <div className="feedback bad" role="alert">
            <p className="small">{error}</p>
          </div>
        )}
        {notice && (
          <div className="feedback ok" role="status">
            <p className="small">{notice}</p>
          </div>
        )}
        <button className={`btn btn-primary btn-block ${busy ? 'disabled' : ''}`} type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
        </button>
      </form>
      <div className="row center wrap">
        {mode === 'signin' && (
          <button className="link-btn" onClick={() => setMode('reset')}>
            Forgot password?
          </button>
        )}
        {mode === 'reset' && (
          <button className="link-btn" onClick={() => setMode('signin')}>
            Back to sign in
          </button>
        )}
      </div>
      <p className="muted small center row">No account? You can keep using Burki Vocab as a guest — progress stays on this device.</p>
    </div>
  );
}

function NewPassword() {
  const acc = useAccount();
  const { toast } = useUI();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await acc.updatePassword(pw);
          toast('Password updated.');
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 style={{ fontSize: 18 }}>Choose a new password</h3>
      <Field label="New password" type="password" value={pw} onChange={setPw} autoComplete="new-password" placeholder="At least 6 characters" />
      {error && (
        <div className="feedback bad" role="alert">
          <p className="small">{error}</p>
        </div>
      )}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}

function SignedIn() {
  const acc = useAccount();
  const { state } = useStore();
  const { toast } = useUI();
  const u = acc.user!;
  const c = counts(state);
  const [confirm, setConfirm] = useState<null | 'clear' | 'delete'>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(u.name);

  return (
    <>
      <section className="card stack">
        <div className="row" style={{ gap: 14 }}>
          <span className="brand-mark" style={{ width: 48, height: 48, borderRadius: 14, fontSize: 22 }}>
            {u.name.slice(0, 1).toUpperCase()}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            {editing ? (
              <form
                className="row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await acc.updateName(name);
                    setEditing(false);
                  } catch (err) {
                    toast((err as Error).message);
                  }
                }}
              >
                <span className="search" style={{ minHeight: 40, flex: 1 }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" autoFocus />
                </span>
                <button className="btn btn-soft" type="submit">
                  Save
                </button>
              </form>
            ) : (
              <div className="row">
                <h3 style={{ fontSize: 19 }}>{u.name}</h3>
                <button className="link-btn" style={{ minHeight: 30 }} onClick={() => setEditing(true)}>
                  Edit
                </button>
              </div>
            )}
            <p className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {u.email}
            </p>
          </div>
        </div>
        <div className="grid-2">
          <div className="stat" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
            <span className="l">Words saved</span>
            <span className="v">{c.learned + c.known}</span>
          </div>
          <div className="stat" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
            <span className="l">Last synced</span>
            <span className="v" style={{ fontSize: 18 }}>
              {acc.lastSynced ? new Date(acc.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
          </div>
        </div>
        {acc.syncError && (
          <div className="feedback bad" role="alert">
            <p className="small">{acc.syncError}</p>
          </div>
        )}
        <p className="muted small">
          Progress syncs automatically a couple of seconds after each change, and pulls in work from your other devices when you come back to the
          app. Studying offline is fine — it syncs when you're back online.
        </p>
        <button className="btn btn-outline" onClick={() => void acc.syncNow()} disabled={acc.status === 'syncing'}>
          <IconCloud /> Sync now
        </button>
      </section>

      <section className="card stack">
        <h3 style={{ fontSize: 17 }}>Sign out</h3>
        <div className="row wrap">
          <button className="btn btn-outline" onClick={() => void acc.signOut(false).then(() => toast('Signed out. Progress stays on this device.'))}>
            Sign out
          </button>
          {confirm === 'clear' ? (
            <>
              <button className="btn btn-danger" onClick={() => void acc.signOut(true).then(() => toast('Signed out and cleared this device.'))}>
                Yes, sign out &amp; clear
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-ghost" onClick={() => setConfirm('clear')}>
              Sign out &amp; clear this device
            </button>
          )}
        </div>
        <p className="muted small">Use "clear this device" on a shared or borrowed phone. Your progress stays safe in your account.</p>
      </section>

      <section className="card flat stack">
        <h3 style={{ fontSize: 16 }}>Delete cloud data</h3>
        <p className="muted small">Removes your saved progress from the server and signs you out. Progress on this device is kept.</p>
        {confirm === 'delete' ? (
          <div className="row wrap">
            <button
              className="btn btn-danger"
              onClick={() =>
                void acc
                  .deleteCloud()
                  .then(() => toast('Cloud progress deleted.'))
                  .catch((e) => toast((e as Error).message))
              }
            >
              Yes, delete my cloud progress
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <button className="btn btn-ghost" style={{ color: 'var(--error)' }} onClick={() => setConfirm('delete')}>
              Delete cloud progress
            </button>
          </div>
        )}
      </section>
    </>
  );
}

export function AccountChip() {
  const { user, configured } = useAccount();
  if (!configured) return null;
  return user ? (
    <span className="brand-mark" style={{ width: 30, height: 30, borderRadius: 9, fontSize: 14, boxShadow: 'none' }} aria-hidden>
      {user.name.slice(0, 1).toUpperCase()}
    </span>
  ) : (
    <IconUser />
  );
}
