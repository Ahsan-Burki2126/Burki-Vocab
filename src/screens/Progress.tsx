import { useRef, useState } from 'react';
import { Bar, useUI } from '../components/UI';
import { Pol } from '../components/WordParts';
import { WORD_BY_ID, WORDS } from '../lib/data';
import { prettyDate } from '../lib/dates';
import { accuracy, counts, dueIds, lastNDays, letterCoverage, readiness, streak, weakWords } from '../lib/metrics';
import { useStore } from '../lib/store';
import { TargetPicker } from './Home';

export default function Progress() {
  const { state, today, updateSettings, resetAll, importState } = useStore();
  const { openWord, toast } = useUI();
  const c = counts(state);
  const due = dueIds(state, today).length;
  const ready = readiness(state, today);
  const acc = accuracy(state);
  const days = lastNDays(state, today, 14);
  const maxDay = Math.max(1, ...days.map((d) => d.learned + d.reviewed));
  const cover = letterCoverage(state);
  const weak = weakWords(state);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `burki-vocab-progress-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="page">
      <div className="learn-head">
        <h2 style={{ fontSize: 24 }}>Progress</h2>
        <span className="muted small">
          {streak(state, today)}-day streak
        </span>
      </div>

      <section className="grid-4">
        <div className="stat">
          <span className="l">Words learned</span>
          <span className="v">{c.learned}</span>
          <span className="sub">+{c.known} marked known</span>
        </div>
        <div className="stat">
          <span className="l">Mastered</span>
          <span className="v">{c.mastered}</span>
          <span className="sub">memory ≥ 3 weeks</span>
        </div>
        <div className="stat">
          <span className="l">Due today</span>
          <span className="v">{due}</span>
          <span className="sub">in review queue</span>
        </div>
        <div className="stat">
          <span className="l">Exam readiness</span>
          <span className="v">{ready}%</span>
          <span className="sub">likelihood-weighted recall</span>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Word bank mastery</h3>
          <span className="muted small">
            {c.learned + c.known} of {WORDS.length}
          </span>
        </div>
        <Bar value={c.learned + c.known} max={WORDS.length} />
        <p className="muted small" style={{ marginTop: 8 }}>
          {c.remaining} words left. At {state.settings.dailyTarget} a day that's about {Math.ceil(c.remaining / state.settings.dailyTarget)} more
          days.
        </p>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Words studied per day</h3>
          <span className="muted small">last 14 days · new + reviewed</span>
        </div>
        <div className="bars" role="img" aria-label="Bar chart of words studied in the last 14 days">
          {days.map((d) => {
            const v = d.learned + d.reviewed;
            return (
              <div className="b" key={d.key}>
                <span className="tip">
                  {prettyDate(d.key, { day: 'numeric', month: 'short' })}: {d.learned} new · {d.reviewed} reviewed · {d.answered} practice Qs
                </span>
                <i className={v === 0 ? 'zero' : ''} style={{ height: `${(v / maxDay) * 100}%` }} />
              </div>
            );
          })}
        </div>
        <div className="bars-axis" aria-hidden>
          {days.map((d, i) => (
            <span key={d.key}>{i % 2 === 1 || i === days.length - 1 ? prettyDate(d.key, { day: 'numeric' }) : ''}</span>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          Practice accuracy: <b style={{ color: 'var(--ink)' }}>{acc.answered ? Math.round((acc.correct / acc.answered) * 100) : 0}%</b> across{' '}
          {acc.answered} questions.
        </p>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Alphabet coverage</h3>
          <span className="muted small">learned / total per letter</span>
        </div>
        <div className="az-full">
          {cover.map((l) => (
            <div className="c" key={l.letter} title={`${l.letter}: ${l.done} of ${l.total}`}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{l.letter}</b>
                <span>
                  {l.done}/{l.total}
                </span>
              </div>
              <Bar value={l.done} max={l.total} success />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Weak words</h3>
          <span className="muted small">most missed or forgotten</span>
        </div>
        {weak.length === 0 ? (
          <p className="muted small">No weak words yet. Words you miss in practice or forget in review will collect here.</p>
        ) : (
          <div className="list">
            {weak.map((id) => {
              const w = WORD_BY_ID[id];
              const st = state.stats[id];
              return (
                <button key={id} className="list-item" onClick={() => openWord(id)}>
                  <Pol p={w.polarity} />
                  <div className="body">
                    <div className="w">{w.word}</div>
                    <div className="m">{w.meaning}</div>
                  </div>
                  <span className="pill error">
                    {st ? `${st.correct}/${st.seen}` : '—'} · {state.cards[id].lapses} forgot
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card stack">
        <h3 style={{ fontSize: 17 }}>Settings</h3>
        <div className="field">
          <span className="eyebrow">Daily target</span>
          <TargetPicker />
        </div>
        <label className="toggle">
          <span>
            <b>Show Urdu meanings</b>
          </span>
          <input type="checkbox" checked={state.settings.showUrdu} onChange={(e) => updateSettings({ showUrdu: e.target.checked })} />
        </label>
        <label className="toggle">
          <span>
            <b>Timed practice</b> <span className="muted small">({state.settings.timerSeconds}s per question)</span>
          </span>
          <input type="checkbox" checked={state.settings.timed} onChange={(e) => updateSettings({ timed: e.target.checked })} />
        </label>
        <div>
          <span className="eyebrow">Your data</span>
          <p className="muted small" style={{ margin: '4px 0 10px' }}>
            Progress is saved in this browser. Export it to move to another phone or computer.
          </p>
          <div className="row wrap">
            <button className="btn btn-outline" onClick={exportData}>
              Export progress
            </button>
            <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>
              Import progress
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const ok = importState(await f.text());
                toast(ok ? 'Progress imported.' : 'That file is not a Burki Vocab export.');
                e.target.value = '';
              }}
            />
            {confirmReset ? (
              <>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    resetAll();
                    setConfirmReset(false);
                    toast('All progress cleared.');
                  }}
                >
                  Yes, erase everything
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" style={{ color: 'var(--error)' }} onClick={() => setConfirmReset(true)}>
                Reset progress
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card flat stack">
        <h3 style={{ fontSize: 17 }}>How Burki Vocab chooses your words</h3>
        <p className="small muted">
          The bank holds <b>{WORDS.filter((w) => w.source === 'pdf').length}</b> words from the NPFTAS vocabulary list (with their original memory
          hooks) plus <b>{WORDS.filter((w) => w.source === 'extra').length}</b> extra words that recur in Pakistani competitive-test papers
          (FPSC, PPSC, FIA, NTS and police CBTs), so every letter A–Z is covered.
        </p>
        <p className="small muted">
          Each word carries an exam-likelihood rating. It is an estimate based on how often the word turns up in past papers — not an official
          NPFTAS figure. Each day's picks are the highest-rated unlearned words, one per letter, scattered across the whole alphabet
          rather than in A–Z order, with a balanced mix of adjectives, verbs and nouns and of positive and negative words. Letters rotate so
          the whole alphabet is covered within a few days. Reviews are scheduled with the FSRS spaced-repetition algorithm.
        </p>
      </section>
    </div>
  );
}
