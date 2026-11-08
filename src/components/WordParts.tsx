import type { Word } from '../types';
import { POLARITY_LABEL, POS_LABEL, likelihoodLabel, linkedId } from '../lib/data';
import { blankSentence } from '../lib/quiz';
import { canSpeak, speak } from '../lib/speech';
import { useStore } from '../lib/store';
import { IconBookmark, IconBulb, IconSpeaker } from './Icons';

export function Pol({ p }: { p: Word['polarity'] }) {
  const cls = p === '+' ? 'pos' : p === '-' ? 'neg' : 'neu';
  const sym = p === '+' ? '+' : p === '-' ? '−' : 'n';
  return (
    <span className={`pol ${cls}`} title={POLARITY_LABEL[p]} aria-label={POLARITY_LABEL[p]}>
      {sym}
    </span>
  );
}

export function Likelihood({ w }: { w: Word }) {
  const on = w.tier >= 5 ? 3 : w.tier === 4 ? 2 : 1;
  return (
    <span className="row" title={`Exam likelihood: ${likelihoodLabel(w)}`} style={{ gap: 6 }}>
      <span className="lk" aria-hidden>
        {[0, 1, 2].map((i) => (
          <i key={i} className={i < on ? 'on' : ''} />
        ))}
      </span>
    </span>
  );
}

export function WordActions({ w }: { w: Word }) {
  const { state, toggleBookmark } = useStore();
  const saved = state.bookmarks.includes(w.id);
  return (
    <div className="row" style={{ gap: 2 }}>
      {canSpeak() && (
        <button className="icon-btn" onClick={() => speak(w.word)} aria-label={`Pronounce ${w.word}`} title="Pronounce">
          <IconSpeaker />
        </button>
      )}
      <button
        className={`icon-btn ${saved ? 'on' : ''}`}
        onClick={() => toggleBookmark(w.id)}
        aria-label={saved ? 'Remove bookmark' : 'Bookmark this word'}
        aria-pressed={saved}
        title={saved ? 'Bookmarked' : 'Bookmark'}
      >
        <IconBookmark filled={saved} />
      </button>
    </div>
  );
}

export function WordTop({ w }: { w: Word }) {
  return (
    <div className="word-top">
      <div className="row wrap">
        <span className="pill primary">{POS_LABEL[w.pos]}</span>
        {w.source === 'extra' && (
          <span className="pill" title="Added beyond the PDF list because it recurs in Pakistani competitive-test papers">
            Extra word
          </span>
        )}
      </div>
      <WordActions w={w} />
    </div>
  );
}

export function WordHero({ w }: { w: Word }) {
  return (
    <div className="word-hero">
      <h1>{w.word}</h1>
    </div>
  );
}

function Example({ w }: { w: Word }) {
  const parts = blankSentence(w);
  if (!parts) return <p className="example">{w.example}</p>;
  const hit = w.example.slice(parts.before.length, w.example.length - parts.after.length);
  return (
    <p className="example">
      {parts.before}
      <b>{hit}</b>
      {parts.after}
    </p>
  );
}

function Chips({ items, kind, onOpen }: { items: string[]; kind: 'syn' | 'ant'; onOpen?: (id: string) => void }) {
  return (
    <div className="chips">
      {items.map((t) => {
        const id = linkedId(t);
        if (id && onOpen) {
          return (
            <button key={t} className={`chip ${kind} linked`} onClick={() => onOpen(id)} title={`Open “${t}”`}>
              {t}
            </button>
          );
        }
        return (
          <span key={t} className={`chip ${kind}`}>
            {t}
          </span>
        );
      })}
    </div>
  );
}

/** The revealed half of a learning card: meaning, Urdu, mnemonic, network, example. */
export function WordBody({ w, onOpen, hookFirst = false }: { w: Word; onOpen?: (id: string) => void; hookFirst?: boolean }) {
  const { state } = useStore();
  const hook = (
    <div className="hook">
      <IconBulb />
      <div className="field">
        <span className="eyebrow">Mnemonic · memory hook</span>
        <p>{w.hook}</p>
      </div>
    </div>
  );
  return (
    <>
      {hookFirst && hook}
      <div className="field">
        <span className="eyebrow">Meaning</span>
        <div className="meaning">
          <Pol p={w.polarity} />
          <span>{w.meaning}</span>
        </div>
        {state.settings.showUrdu && (
          <p className="urdu" lang="ur">
            {w.urdu}
          </p>
        )}
      </div>
      {!hookFirst && hook}
      <div className="field">
        <span className="eyebrow">Synonyms</span>
        <Chips items={w.synonyms} kind="syn" onOpen={onOpen} />
      </div>
      <div className="field">
        <span className="eyebrow">Antonyms</span>
        <Chips items={w.antonyms} kind="ant" onOpen={onOpen} />
      </div>
      <div className="field">
        <span className="eyebrow">In a sentence</span>
        <Example w={w} />
      </div>
      <div className="meta-row small muted">
        <span>Exam likelihood:</span>
        <Likelihood w={w} />
        <b style={{ color: 'var(--ink-2)' }}>{likelihoodLabel(w)}</b>
        <span>·</span>
        <span>{POLARITY_LABEL[w.polarity]} word</span>
      </div>
    </>
  );
}
