import { useEffect, useState } from 'react';
import type { Rating } from '../types';
import { Bar, useUI } from '../components/UI';
import { IconArrowRight, IconCheck } from '../components/Icons';
import { WordBody, WordHero, WordTop } from '../components/WordParts';
import { WORD_BY_ID } from '../lib/data';
import { formatInterval, prettyDate } from '../lib/dates';
import { previewIntervals } from '../lib/fsrs';
import { dueIds, nextDue } from '../lib/metrics';
import { go } from '../lib/router';
import { speak } from '../lib/speech';
import { useStore } from '../lib/store';
import { RATINGS } from './Learn';

export default function Review() {
  const { state, today, review } = useStore();
  const { openWord } = useUI();
  const [queue, setQueue] = useState<string[]>(() => dueIds(state, today));
  const [pos, setPos] = useState(0);
  const [rated, setRated] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState(false);

  const id = queue[pos];
  const w = id ? WORD_BY_ID[id] : undefined;
  const card = id ? state.cards[id] : undefined;

  // pick up words that became due while the screen is open (e.g. after midnight)
  useEffect(() => {
    if (pos >= queue.length) {
      const fresh = dueIds(state, today).filter((x) => !queue.includes(x));
      if (fresh.length) setQueue((q) => [...q, ...fresh]);
    }
  }, [today]);

  const rate = (g: Rating) => {
    if (!id) return;
    if (!rated.has(id)) {
      review(id, g);
      setRated((s) => new Set(s).add(id));
    }
    if (g === 1) setQueue((q) => [...q, id]);
    setPos((p) => p + 1);
    setRevealed(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!w) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) rate(Number(e.key) as Rating);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!w || !card) {
    const nd = nextDue(state, today);
    const reviewedToday = state.days[today]?.reviewed ?? 0;
    return (
      <div className="page narrow">
        <div className="learn-head">
          <h2>Review</h2>
          <span className="pill success">Spaced repetition</span>
        </div>
        <div className="card empty">
          <div className="big-icon">
            <IconCheck />
          </div>
          <h2>{reviewedToday ? `${reviewedToday} review${reviewedToday === 1 ? '' : 's'} done — all caught up` : 'Nothing due right now'}</h2>
          <p className="muted">
            {nd
              ? `Next words come back on ${prettyDate(nd, { weekday: 'long', day: 'numeric', month: 'short' })}. Harder words return sooner; easy ones wait longer.`
              : 'Words you learn will appear here when they are about to slip from memory.'}
          </p>
          <button className="btn btn-primary" onClick={() => go('home')}>
            Back to today's goal <IconArrowRight />
          </button>
        </div>
      </div>
    );
  }

  const intervals = previewIntervals(rated.has(id) ? undefined : card, today);

  return (
    <div className="page narrow">
      <div className="learn-head">
        <h2>Review</h2>
        <span className="muted small">
          {Math.min(pos + 1, queue.length)} of {queue.length}
        </span>
      </div>
      <Bar value={pos} max={queue.length} success />
      <article className="word-card" key={`${id}-${pos}`}>
        <WordTop w={w} />
        <WordHero w={w} />
        {!revealed ? (
          <>
            <div className="recall-prompt">What does it mean? Say a synonym and an antonym too.</div>
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                setRevealed(true);
                speak(w.word);
              }}
            >
              Reveal
            </button>
          </>
        ) : (
          <>
            <WordBody w={w} onOpen={openWord} />
            <div className="rate-dock">
              <div className="rate">
                {RATINGS.map((r) => (
                  <button key={r.g} className={r.cls} onClick={() => rate(r.g)}>
                    {r.label}
                    <small>{rated.has(id) ? r.meaning : `again in ${formatInterval(intervals[r.g])}`}</small>
                  </button>
                ))}
              </div>
              <p className="kbd center row" style={{ marginTop: 6 }}>
                Keys 1–4 · harder words come back sooner
              </p>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
