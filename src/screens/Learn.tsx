import { useEffect, useState } from 'react';
import type { Rating } from '../types';
import { Bar, useUI } from '../components/UI';
import { IconArrowRight, IconBulb, IconCheck } from '../components/Icons';
import { WordBody, WordHero, WordTop } from '../components/WordParts';
import { WORD_BY_ID } from '../lib/data';
import { formatInterval } from '../lib/dates';
import { previewIntervals } from '../lib/fsrs';
import { go } from '../lib/router';
import { speak } from '../lib/speech';
import { useStore } from '../lib/store';

export const RATINGS: { g: Rating; cls: string; label: string; meaning: string }[] = [
  { g: 1, cls: 'again', label: 'Again', meaning: 'Forgot it' },
  { g: 2, cls: 'hard', label: 'Hard', meaning: 'Struggled' },
  { g: 3, cls: 'good', label: 'Good', meaning: 'Remembered' },
  { g: 4, cls: 'easy', label: 'Easy', meaning: 'Instantly' },
];

export default function Learn() {
  const { state, today, learn, markKnown, setTarget } = useStore();
  const { openWord, toast } = useUI();
  const log = state.days[today];
  const words = log?.words ?? [];
  const learned = log?.learned ?? [];
  const [deferred, setDeferred] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);

  const pending = words.filter((id) => !learned.includes(id));
  const ordered = [...pending.filter((id) => !deferred.includes(id)), ...deferred.filter((id) => pending.includes(id))];
  const currentId = ordered[0];
  const w = currentId ? WORD_BY_ID[currentId] : undefined;

  useEffect(() => {
    setRevealed(false);
    setHint(false);
  }, [currentId, deferred.length]);

  const rate = (g: Rating) => {
    if (!w) return;
    learn(w.id, g);
    if (g === 1) setDeferred((d) => [...d.filter((x) => x !== w.id), w.id]);
    setRevealed(false);
    setHint(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!w || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        rate(Number(e.key) as Rating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (words.length === 0) {
    return (
      <div className="page narrow">
        <div className="card empty">
          <div className="big-icon">
            <IconCheck />
          </div>
          <h2>Word bank complete</h2>
          <p className="muted">Every word is learned. Keep your streak going with daily reviews.</p>
          <button className="btn btn-primary" onClick={() => go('review')}>
            Go to Review
          </button>
        </div>
      </div>
    );
  }

  if (!w) {
    return (
      <div className="page narrow">
        <div className="card empty">
          <div className="big-icon">
            <IconCheck />
          </div>
          <h2>All {words.length} words learned today</h2>
          <p className="muted">Now practise the same words — synonyms, antonyms and sentences — before you forget them.</p>
          <button className="btn btn-primary" onClick={() => go('practice')}>
            Practice today's words <IconArrowRight />
          </button>
          <div className="today-words center" style={{ marginTop: 8 }}>
            {words.map((id) => (
              <button key={id} className="tw done" onClick={() => openWord(id)}>
                <span className="lt">{WORD_BY_ID[id].word[0]}</span>
                {WORD_BY_ID[id].word}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={() => setTarget(state.settings.dailyTarget + 5)}>
            Feeling strong? Add 5 more words today
          </button>
        </div>
      </div>
    );
  }

  const intervals = previewIntervals(undefined, today);
  const position = Math.min(words.length, learned.length + 1);

  return (
    <div className="page narrow">
      <div className="learn-head">
        <h2>Daily Vocabulary</h2>
        <span className="muted small" aria-live="polite">
          Word {position} of {words.length}
        </span>
      </div>
      <Bar value={learned.length} max={words.length} />

      <article className="word-card" key={w.id + (deferred.includes(w.id) ? '-again' : '')}>
        <WordTop w={w} />
        <WordHero w={w} />

        {!revealed ? (
          <>
            <div className="recall-prompt">Recall the meaning in your head, then reveal.</div>
            {hint ? (
              <div className="hook">
                <IconBulb />
                <div className="field">
                  <span className="eyebrow">Mnemonic · memory hook</span>
                  <p>{w.hook}</p>
                </div>
              </div>
            ) : (
              <button className="btn btn-soft" onClick={() => setHint(true)}>
                <IconBulb /> Show mnemonic hint
              </button>
            )}
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                setRevealed(true);
                speak(w.word);
              }}
            >
              Reveal meaning
            </button>
            <p className="kbd center row">Space to reveal</p>
          </>
        ) : (
          <>
            <WordBody w={w} onOpen={openWord} />
            <div className="rate-dock">
              <p className="eyebrow center row" style={{ marginBottom: 8 }}>
                How well did you know it?
              </p>
              <div className="rate">
                {RATINGS.map((r) => (
                  <button key={r.g} className={r.cls} onClick={() => rate(r.g)} title={`Next review in ${formatInterval(intervals[r.g])}`}>
                    {r.label}
                    <small>{r.meaning}</small>
                  </button>
                ))}
              </div>
              <p className="kbd center row" style={{ marginTop: 6 }}>
                Keys 1–4 · “Again” brings the word back later in this session
              </p>
            </div>
          </>
        )}
      </article>

      <div className="row center">
        <button
          className="link-btn"
          onClick={() => {
            markKnown(w.id);
            toast(`“${w.word}” marked as known — swapped for the next best word.`);
          }}
        >
          I already know this word — replace it
        </button>
      </div>
    </div>
  );
}
