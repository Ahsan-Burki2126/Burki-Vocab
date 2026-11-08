import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, useUI } from '../components/UI';
import { IconArrowRight, IconCheck, IconTimer, IconX } from '../components/Icons';
import { Pol } from '../components/WordParts';
import { WORD_BY_ID } from '../lib/data';
import { QTYPE_LABEL, buildSession, type PracticeMode, type Question } from '../lib/quiz';
import { go } from '../lib/router';
import { useStore } from '../lib/store';

const MODES: { id: PracticeMode; label: string }[] = [
  { id: 'mixed', label: 'Mixed' },
  { id: 'synonym', label: 'Synonyms' },
  { id: 'antonym', label: 'Antonyms' },
  { id: 'blank', label: 'Sentences' },
  { id: 'meaning', label: 'Meanings' },
];
const TIMES = [15, 30, 45, 60];
const KEYS = ['A', 'B', 'C', 'D'];

interface Answer {
  q: Question;
  picked: number; // -1 = timed out
}

export default function Practice() {
  const { state, today, updateSettings } = useStore();
  const log = state.days[today];
  const learned = log?.learned ?? [];
  const words = log?.words ?? [];
  const [mode, setMode] = useState<PracticeMode>('mixed');
  const [session, setSession] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const start = (ids: string[]) => {
    setAnswers([]);
    setSession(buildSession(ids, mode, ids.length <= 3 ? 3 : 2));
  };

  if (learned.length === 0) {
    return (
      <div className="page narrow">
        <PracticeHeader />
        <div className="card empty">
          <div className="big-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
            <IconTimer />
          </div>
          <h2>Learn today's words first</h2>
          <p className="muted">Practice is locked to today's set. Learn at least one of today's {words.length} words, then come back.</p>
          <button className="btn btn-primary" onClick={() => go('learn')}>
            Start learning <IconArrowRight />
          </button>
        </div>
      </div>
    );
  }

  if (session && answers.length >= session.length) {
    return (
      <Results
        answers={answers}
        onRetry={(ids) => start(ids)}
        onNew={() => start(learned)}
        onSetup={() => {
          setSession(null);
          setAnswers([]);
        }}
      />
    );
  }

  if (session) {
    return (
      <Runner
        key={session[answers.length]?.key}
        session={session}
        index={answers.length}
        score={answers.filter((a) => a.picked === a.q.answer).length}
        onAnswer={(a) => setAnswers((prev) => [...prev, a])}
        onQuit={() => {
          setSession(null);
          setAnswers([]);
        }}
      />
    );
  }

  const left = words.length - learned.length;
  return (
    <div className="page narrow">
      <PracticeHeader />
      <div className="card stack">
        <div>
          <h3 style={{ fontSize: 18 }}>Today's words only</h3>
          <p className="muted small" style={{ marginTop: 4 }}>
            {learned.length} word{learned.length === 1 ? '' : 's'} ready
            {left > 0 ? ` · ${left} still to learn (they'll join once learned)` : ''}. Synonym questions hide the antonym as a trap — just like
            the real CBT.
          </p>
        </div>
        <div className="today-words">
          {learned.map((id) => (
            <span key={id} className="tw done" style={{ cursor: 'default' }}>
              <span className="lt">{WORD_BY_ID[id].word[0]}</span>
              {WORD_BY_ID[id].word}
            </span>
          ))}
        </div>
        <div className="field">
          <span className="eyebrow">Question type</span>
          <div className="seg">
            {MODES.map((m) => (
              <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <label className="toggle">
          <span>
            <b>Timed mode</b>
            <br />
            <span className="muted small">CBT-style countdown on each question</span>
          </span>
          <input type="checkbox" checked={state.settings.timed} onChange={(e) => updateSettings({ timed: e.target.checked })} />
        </label>
        {state.settings.timed && (
          <div className="seg">
            {TIMES.map((t) => (
              <button key={t} className={state.settings.timerSeconds === t ? 'on' : ''} onClick={() => updateSettings({ timerSeconds: t })}>
                {t}s
              </button>
            ))}
          </div>
        )}
        <button className="btn btn-primary btn-block" onClick={() => start(learned)}>
          Start practice <IconArrowRight />
        </button>
      </div>
    </div>
  );
}

function PracticeHeader() {
  return (
    <div className="learn-head">
      <h2>Practice</h2>
      <span className="pill primary">Today's set</span>
    </div>
  );
}

function Runner({
  session,
  index,
  score,
  onAnswer,
  onQuit,
}: {
  session: Question[];
  index: number;
  score: number;
  onAnswer: (a: Answer) => void;
  onQuit: () => void;
}) {
  const { state, recordAnswer } = useStore();
  const q = session[index];
  const w = WORD_BY_ID[q.wordId];
  const [picked, setPicked] = useState<number | null>(null);
  const timed = state.settings.timed;
  const limit = state.settings.timerSeconds;
  const [left, setLeft] = useState(limit);
  const nextRef = useRef<HTMLButtonElement>(null);

  const choose = useCallback(
    (i: number) => {
      if (picked !== null) return;
      setPicked(i);
      recordAnswer(q.wordId, i === q.answer);
      setTimeout(() => nextRef.current?.focus(), 50);
    },
    [picked, q, recordAnswer],
  );

  useEffect(() => {
    if (!timed || picked !== null) return;
    if (left <= 0) {
      choose(-1);
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timed, left, picked, choose]);

  const next = () => {
    if (picked === null) return;
    onAnswer({ q, picked });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (picked === null) {
        const idx = ['1', '2', '3', '4'].indexOf(k) >= 0 ? Number(k) - 1 : KEYS.indexOf(k);
        if (idx >= 0 && idx < q.options.length) choose(idx);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const correct = picked === q.answer;
  const pickedOpt = picked !== null && picked >= 0 ? q.options[picked] : null;
  const showWord = q.type !== 'blank' && q.type !== 'reverse';

  return (
    <div className="page narrow">
      <div className="learn-head">
        <button className="btn btn-ghost" onClick={onQuit} style={{ paddingLeft: 8 }}>
          <IconX /> Quit
        </button>
        <span className="muted small">
          Question {index + 1} of {session.length} · <b style={{ color: 'var(--success)' }}>{score} correct</b>
        </span>
      </div>
      <Bar value={index} max={session.length} />

      <article className="q-card" key={q.key}>
        <div className="row">
          <span className="pill primary">{QTYPE_LABEL[q.type]}</span>
          <span className="spacer" />
          {timed && picked === null && (
            <span className={`pill ${left <= 5 ? 'error' : ''}`}>
              <IconTimer width={14} height={14} /> {left}s
            </span>
          )}
        </div>
        {timed && (
          <div className={`timer ${left <= 5 ? 'low' : ''}`}>
            <i style={{ width: `${picked !== null ? 0 : (left / limit) * 100}%` }} />
          </div>
        )}
        <p className="muted center row">{q.prompt}</p>
        {showWord && <div className="q-word">{w.word}</div>}
        {q.type === 'blank' && q.sentence && (
          <p className="q-sentence">
            {q.sentence.before}
            <span className="blank">{picked !== null ? (q.sentence.before.trim() ? w.word.toLowerCase() : w.word) : '\u00a0'}</span>
            {q.sentence.after}
          </p>
        )}

        <div className="opts" role="radiogroup">
          {q.options.map((o, i) => {
            const state = picked === null ? '' : i === q.answer ? 'correct' : i === picked ? 'wrong' : '';
            return (
              <button key={i} className={`opt ${state} ${picked !== null ? 'locked' : ''}`} onClick={() => choose(i)} role="radio" aria-checked={picked === i}>
                <span className="k">{state === 'correct' ? <IconCheck width={16} height={16} /> : state === 'wrong' ? <IconX width={16} height={16} /> : KEYS[i]}</span>
                <span>{o.text}</span>
                {picked !== null && o.trap && <span className="pill review tag">{o.trap === 'antonym' ? 'Antonym — trap' : 'Synonym — trap'}</span>}
              </button>
            );
          })}
        </div>

        {picked !== null && (
          <div className={`feedback ${correct ? 'ok' : 'bad'}`}>
            <h4>{correct ? 'Correct!' : picked === -1 ? "Time's up" : 'Not quite'}</h4>
            {pickedOpt?.trap === 'antonym' && (
              <p className="small">
                <b>“{pickedOpt.text}”</b> is the <b>opposite</b> of {w.word.toLowerCase()} — the classic antonym trap in synonym questions.
              </p>
            )}
            {pickedOpt?.trap === 'synonym' && (
              <p className="small">
                <b>“{pickedOpt.text}”</b> means the <b>same</b> as {w.word.toLowerCase()} — the classic synonym trap in antonym questions.
              </p>
            )}
            <p className="small row" style={{ alignItems: 'flex-start' }}>
              <Pol p={w.polarity} />
              <span>
                <b>{w.word}</b> — {w.meaning}. Synonyms: {w.synonyms.join(', ')}. Antonyms: {w.antonyms.join(', ')}.
              </span>
            </p>
            <p className="small" style={{ color: 'var(--review-ink)' }}>
              💡 {w.hook}
            </p>
          </div>
        )}

        {picked !== null && (
          <button ref={nextRef} className="btn btn-primary btn-block" onClick={next}>
            {index + 1 >= session.length ? 'See results' : 'Next question'} <IconArrowRight />
          </button>
        )}
        <p className="kbd center row">Keys A–D or 1–4 · Enter for next</p>
      </article>
    </div>
  );
}

function Results({ answers, onRetry, onNew, onSetup }: { answers: Answer[]; onRetry: (ids: string[]) => void; onNew: () => void; onSetup: () => void }) {
  const { openWord } = useUI();
  const right = answers.filter((a) => a.picked === a.q.answer).length;
  const pct = Math.round((right / Math.max(1, answers.length)) * 100);
  const missed = useMemo(() => Array.from(new Set(answers.filter((a) => a.picked !== a.q.answer).map((a) => a.q.wordId))), [answers]);
  const traps = answers.filter((a) => a.picked >= 0 && a.q.options[a.picked]?.trap).length;

  return (
    <div className="page narrow">
      <div className="card stack" style={{ alignItems: 'stretch' }}>
        <p className="eyebrow center row">Round complete</p>
        <div className="score-big" style={{ color: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--ink)' : 'var(--error)' }}>
          {pct}%
        </div>
        <p className="center row muted">
          {right} of {answers.length} correct
          {traps > 0 ? ` · fell for ${traps} trap${traps === 1 ? '' : 's'}` : ''}
        </p>
        {missed.length > 0 ? (
          <>
            <p className="eyebrow">Words to revisit</p>
            <div className="list">
              {missed.map((id) => {
                const w = WORD_BY_ID[id];
                return (
                  <button key={id} className="list-item" onClick={() => openWord(id)}>
                    <Pol p={w.polarity} />
                    <div className="body">
                      <div className="w">{w.word}</div>
                      <div className="m">{w.meaning}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button className="btn btn-primary btn-block" onClick={() => onRetry(missed)}>
              Retry missed words
            </button>
          </>
        ) : (
          <p className="center row" style={{ color: 'var(--success)', fontWeight: 600 }}>
            Perfect round — every answer right.
          </p>
        )}
        <div className="grid-2">
          <button className="btn btn-outline" onClick={onNew}>
            New round
          </button>
          <button className="btn btn-outline" onClick={onSetup}>
            Settings
          </button>
        </div>
        <button className="btn btn-ghost" onClick={() => go('home')}>
          Back to home
        </button>
      </div>
    </div>
  );
}
