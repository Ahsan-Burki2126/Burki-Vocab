import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { WORD_BY_ID } from '../lib/data';
import { useStore } from '../lib/store';
import { IconArrowLeft, IconX } from './Icons';
import { WordBody, WordHero, WordTop } from './WordParts';

interface UI {
  openWord: (id: string) => void;
  toast: (msg: string) => void;
}
const Ctx = createContext<UI | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>();

  const openWord = useCallback((id: string) => {
    if (WORD_BY_ID[id]) setStack((s) => [...s, id]);
  }, []);
  const toast = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);

  const value = useMemo(() => ({ openWord, toast }), [openWord, toast]);
  const current = stack[stack.length - 1];

  return (
    <Ctx.Provider value={value}>
      {children}
      {current && <WordSheet id={current} depth={stack.length} onBack={() => setStack((s) => s.slice(0, -1))} onClose={() => setStack([])} onOpen={openWord} />}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useUI(): UI {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUI outside UIProvider');
  return v;
}

function WordSheet({ id, depth, onBack, onClose, onOpen }: { id: string; depth: number; onBack: () => void; onClose: () => void; onOpen: (id: string) => void }) {
  const w = WORD_BY_ID[id];
  const { state } = useStore();
  const card = state.cards[id];
  const stat = state.stats[id];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${w.word} details`}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 8 }}>
          {depth > 1 ? (
            <button className="btn btn-ghost" onClick={onBack}>
              <IconArrowLeft /> Back
            </button>
          ) : (
            <span className="eyebrow" style={{ paddingLeft: 4 }}>
              Word card
            </span>
          )}
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        <div className="word-card" key={id}>
          <WordTop w={w} />
          <WordHero w={w} />
          <WordBody w={w} onOpen={onOpen} />
          <div className="row wrap small muted">
            {card?.state === 'known' && <span className="pill success">Marked as known</span>}
            {card?.state === 'review' && <span className="pill primary">Learned · next review {card.due}</span>}
            {!card && <span className="pill">Not learned yet</span>}
            {stat && (
              <span className="pill">
                Practice {stat.correct}/{stat.seen}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Ring({ value, max, size = 96, stroke = 9, label, sub, light = false }: { value: number; max: number; size?: number; stroke?: number; label: string; sub?: string; light?: boolean }) {
  const r = (100 - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${value} of ${max}`}>
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke={light ? 'rgba(255,255,255,.25)' : 'var(--line-2)'} strokeWidth={stroke} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={light ? '#fff' : 'var(--primary)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 250ms ease' }}
        />
      </svg>
      <div className="ring-label">
        <div>
          <b>{label}</b>
          {sub && <span>{sub}</span>}
        </div>
      </div>
    </div>
  );
}

export function Bar({ value, max, success = false }: { value: number; max: number; success?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`bar ${success ? 'success' : ''}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
