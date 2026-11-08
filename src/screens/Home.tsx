import { Ring, useUI } from '../components/UI';
import { IconArrowRight, IconFlame, IconLibrary, IconToolkit } from '../components/Icons';
import { LETTERS, WORD_BY_ID, WORDS } from '../lib/data';
import { lettersCycleDays } from '../lib/daily';
import { prettyDate } from '../lib/dates';
import { counts, dueIds, readiness, streak } from '../lib/metrics';
import { go } from '../lib/router';
import { useStore } from '../lib/store';
import { Brand } from '../App';

const PRESETS = [5, 10, 15, 20, 25];

export function TargetPicker({ compact = false }: { compact?: boolean }) {
  const { state, setTarget } = useStore();
  const t = state.settings.dailyTarget;
  return (
    <div className="target-row">
      <div className="stepper" aria-label="Daily target">
        <button onClick={() => setTarget(t - 1)} aria-label="Fewer words">
          −
        </button>
        <output aria-live="polite">{t}</output>
        <button onClick={() => setTarget(t + 1)} aria-label="More words">
          +
        </button>
      </div>
      {!compact && (
        <div className="seg">
          {PRESETS.map((p) => (
            <button key={p} className={p === t ? 'on' : ''} onClick={() => setTarget(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { state, today, updateSettings, setTarget } = useStore();
  const { openWord } = useUI();
  const log = state.days[today];
  const words = log?.words ?? [];
  const learned = log?.learned ?? [];
  const due = dueIds(state, today);
  const c = counts(state);
  const ready = readiness(state, today);
  const st = streak(state, today);
  const todayLetters = new Set(words.map((id) => id[0].toUpperCase()));
  const coveredLetters = new Set(Object.keys(state.cards).map((id) => id[0].toUpperCase()));
  const target = state.settings.dailyTarget;
  const allLearned = words.length > 0 && learned.length >= words.length;
  const practised = (log?.practiceAnswered ?? 0) > 0;

  let cta: { label: string; to: 'learn' | 'practice' | 'review' | 'progress'; sub: string };
  if (words.length === 0) {
    cta = { label: 'See your progress', to: 'progress', sub: 'You have learned every word in the bank. Keep reviewing to hold on to them.' };
  } else if (!allLearned) {
    cta = {
      label: learned.length ? 'Continue learning' : "Start today's words",
      to: 'learn',
      sub: `${words.length - learned.length} new word${words.length - learned.length === 1 ? '' : 's'} left today. One at a time — recall first, then reveal.`,
    };
  } else if (!practised) {
    cta = { label: "Practice today's words", to: 'practice', sub: 'All new words learned. Lock them in with synonym, antonym and sentence questions.' };
  } else if (due.length) {
    cta = { label: `Review ${due.length} due word${due.length === 1 ? '' : 's'}`, to: 'review', sub: 'Spaced repetition brings back words just before you forget them.' };
  } else {
    cta = { label: 'Practice again', to: 'practice', sub: "Today's goal is complete. Come back tomorrow for a fresh set." };
  }

  return (
    <div className="page">
      <div className="topbar mobile-only">
        <Brand />
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" onClick={() => go('library')} aria-label="Word bank">
            <IconLibrary />
          </button>
          <button className="icon-btn" onClick={() => go('toolkit')} aria-label="Toolkit">
            <IconToolkit />
          </button>
        </div>
      </div>

      <div>
        <p className="eyebrow">{prettyDate(today)}</p>
        <h2 style={{ fontSize: 26, marginTop: 4 }}>Assalam-o-Alaikum 👋</h2>
        <p className="muted small" style={{ marginTop: 2 }}>
          NPFTAS CBT vocabulary · Islamabad Police · NCCIA · FIA · FPSC
        </p>
      </div>

      {!state.settings.onboarded && (
        <div className="card">
          <h3 style={{ fontSize: 18 }}>How many new words a day?</h3>
          <p className="muted small" style={{ margin: '4px 0 12px' }}>
            Each day Burki Vocab picks the highest-likelihood exam words, spread across different letters, and keeps practice focused on just
            that set. You can change this any time.
          </p>
          <div className="row wrap">
            {PRESETS.map((p) => (
              <button
                key={p}
                className={`btn ${p === target ? 'btn-soft' : 'btn-outline'}`}
                onClick={() => {
                  setTarget(p);
                  updateSettings({ onboarded: true });
                }}
              >
                {p} words
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="hero" aria-label="Today's goal">
        <Ring value={learned.length} max={Math.max(1, words.length)} label={`${learned.length}/${words.length}`} sub="learned" light />
        <div className="stack">
          <div>
            <h2>Today's goal: {words.length} new words</h2>
            <p style={{ marginTop: 4 }}>{cta.sub}</p>
          </div>
          <div>
            <button className="btn btn-primary" onClick={() => go(cta.to)}>
              {cta.label} <IconArrowRight />
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Daily target</h3>
          <span className="muted small">new words per day</span>
        </div>
        <TargetPicker />
        <p className="muted small" style={{ marginTop: 10 }}>
          Changing the target updates today's list straight away — words you've already learned stay.
        </p>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Today's words</h3>
          <span className="muted small">{todayLetters.size} letters</span>
        </div>
        {words.length === 0 ? (
          <p className="muted">No new words left — the whole bank is learned.</p>
        ) : (
          <div className="today-words">
            {words.map((id) => {
              const w = WORD_BY_ID[id];
              const done = learned.includes(id);
              return (
                <button key={id} className={`tw ${done ? 'done' : ''}`} onClick={() => openWord(id)} title={done ? 'Learned' : 'Not learned yet'}>
                  <span className="lt">{w.word[0]}</span>
                  {w.word}
                </button>
              );
            })}
          </div>
        )}
        <p className="muted small" style={{ marginTop: 12 }}>
          Picked for you: the highest exam-likelihood unlearned word from each of {Math.min(todayLetters.size, 26)} different letters. Practice
          today covers only these words.
        </p>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Alphabet coverage</h3>
          <span className="muted small">
            {coveredLetters.size}/26 letters started
          </span>
        </div>
        <div className="az" role="list" aria-label="Letters A to Z">
          {LETTERS.map((l) => (
            <div
              key={l}
              role="listitem"
              className={`cell ${todayLetters.has(l) ? 'today' : ''} ${coveredLetters.has(l) ? 'covered' : ''}`}
              title={todayLetters.has(l) ? `${l}: in today's set` : coveredLetters.has(l) ? `${l}: started` : `${l}: not started`}
            >
              {l}
            </div>
          ))}
        </div>
        <div className="legend" style={{ marginTop: 12 }}>
          <span>
            <i style={{ background: 'var(--primary)' }} />
            Today
          </span>
          <span>
            <i style={{ background: 'var(--success-soft)', border: '1px solid #bfe8dc' }} />
            Started
          </span>
          <span>
            <i style={{ background: 'var(--line-2)', border: '1px solid var(--line)' }} />
            Not yet
          </span>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          At {target} a day, letters rotate so every letter A–Z is touched every {lettersCycleDays(target)} day
          {lettersCycleDays(target) === 1 ? '' : 's'}.
        </p>
      </section>

      <section className="grid-4" aria-label="Stats">
        <div className="stat">
          <span className="l">Streak</span>
          <span className="v row" style={{ gap: 6 }}>
            <IconFlame width={22} height={22} style={{ color: '#e08a1e' }} />
            {st}
          </span>
          <span className="sub">day{st === 1 ? '' : 's'} in a row</span>
        </div>
        <button className="stat" style={{ border: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }} onClick={() => go('review')}>
          <span className="l">Due for review</span>
          <span className="v">{due.length}</span>
          <span className="sub">{due.length ? 'tap to review' : 'all caught up'}</span>
        </button>
        <div className="stat">
          <span className="l">Exam readiness</span>
          <span className="v">{ready}%</span>
          <span className="sub">likelihood-weighted</span>
        </div>
        <div className="stat">
          <span className="l">Words learned</span>
          <span className="v">{c.learned + c.known}</span>
          <span className="sub">of {WORDS.length}</span>
        </div>
      </section>

      <section className="grid-2">
        <button className="card flat tight" style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }} onClick={() => go('toolkit')}>
          <div className="row" style={{ marginBottom: 6, color: 'var(--primary)' }}>
            <IconToolkit width={20} height={20} />
            <b style={{ color: 'var(--ink)' }}>Exam toolkit</b>
          </div>
          <p className="muted small">Roots & prefixes, sentence connectors, 30 confusable pairs + drill.</p>
        </button>
        <button className="card flat tight" style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }} onClick={() => go('library')}>
          <div className="row" style={{ marginBottom: 6, color: 'var(--primary)' }}>
            <IconLibrary width={20} height={20} />
            <b style={{ color: 'var(--ink)' }}>Word bank</b>
          </div>
          <p className="muted small">All {WORDS.length} words with mnemonics, Urdu meanings and search.</p>
        </button>
      </section>
    </div>
  );
}
