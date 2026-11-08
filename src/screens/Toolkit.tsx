import { useMemo, useState } from 'react';
import { IconArrowRight, IconBulb, IconCheck, IconX } from '../components/Icons';
import { TOOLKIT } from '../lib/data';
import type { Confusable } from '../types';

type Tab = 'roots' | 'connectors' | 'confusables';

export default function Toolkit() {
  const [tab, setTab] = useState<Tab>('roots');
  return (
    <div className="page">
      <div className="learn-head">
        <h2 style={{ fontSize: 24 }}>Exam toolkit</h2>
      </div>
      <p className="muted small" style={{ marginTop: -8 }}>
        From the NPFTAS vocabulary notes: tools that answer questions even when you have never seen the word.
      </p>
      <div className="seg">
        <button className={tab === 'roots' ? 'on' : ''} onClick={() => setTab('roots')}>
          Roots
        </button>
        <button className={tab === 'connectors' ? 'on' : ''} onClick={() => setTab('connectors')}>
          Connectors
        </button>
        <button className={tab === 'confusables' ? 'on' : ''} onClick={() => setTab('confusables')}>
          Confusables
        </button>
      </div>
      {tab === 'roots' && <Roots />}
      {tab === 'connectors' && <Connectors />}
      {tab === 'confusables' && <Confusables />}
    </div>
  );
}

function Roots() {
  return (
    <>
      <section className="card">
        <div className="section-title">
          <h3>Prefixes</h3>
          <span className="muted small">{TOOLKIT.prefixes.length}</span>
        </div>
        <table className="tk-table">
          <thead>
            <tr>
              <th>Prefix</th>
              <th>Meaning</th>
              <th>Examples</th>
            </tr>
          </thead>
          <tbody>
            {TOOLKIT.prefixes.map((p) => (
              <tr key={p.part}>
                <td>{p.part}</td>
                <td>{p.meaning}</td>
                <td className="muted">{p.examples}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <div className="section-title">
          <h3>Roots</h3>
          <span className="muted small">{TOOLKIT.roots.length}</span>
        </div>
        <table className="tk-table">
          <thead>
            <tr>
              <th>Root</th>
              <th>Meaning</th>
              <th>Examples</th>
            </tr>
          </thead>
          <tbody>
            {TOOLKIT.roots.map((p) => (
              <tr key={p.part}>
                <td>{p.part}</td>
                <td>{p.meaning}</td>
                <td className="muted">{p.examples}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Connectors() {
  return (
    <section className="card stack">
      <div className="hook">
        <IconBulb />
        <div className="field">
          <span className="eyebrow">Sentence completion shortcut</span>
          <p>Find the connector, decide whether the sentence continues or turns, then pick a blank with the matching + or − polarity.</p>
        </div>
      </div>
      {TOOLKIT.connectors.map((c) => (
        <div key={c.direction} className="card flat tight">
          <h4 style={{ fontSize: 16 }}>{c.direction}</h4>
          <p style={{ margin: '6px 0', fontWeight: 500 }}>{c.words}</p>
          <p className="muted small">{c.rule}</p>
        </div>
      ))}
    </section>
  );
}

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function Confusables() {
  const [drill, setDrill] = useState<Confusable[] | null>(null);
  if (drill) return <Drill items={drill} onExit={() => setDrill(null)} />;
  return (
    <>
      <section className="card row wrap" style={{ justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 17 }}>Confusable pairs drill</h3>
          <p className="muted small">10 sentences — pick the right word. Common in spelling and sentence-correction questions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setDrill(shuffle(TOOLKIT.confusables).slice(0, 10))}>
          Start drill <IconArrowRight />
        </button>
      </section>
      <section className="card">
        <div className="list">
          {TOOLKIT.confusables.map((c) => (
            <div key={c.pair} className="list-item" style={{ cursor: 'default', alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
              <span className="w">{c.pair}</span>
              <span className="small">{c.difference}</span>
              <span className="small" style={{ color: 'var(--review-ink)' }}>
                💡 {c.hook}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Drill({ items, onExit }: { items: Confusable[]; onExit: () => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const item = items[i];
  const parts = useMemo(() => item?.sentence.split('___') ?? ['', ''], [item]);

  if (!item) {
    return (
      <section className="card stack" style={{ textAlign: 'center' }}>
        <p className="eyebrow">Drill complete</p>
        <div className="score-big">
          {score}/{items.length}
        </div>
        <div className="grid-2">
          <button className="btn btn-outline" onClick={() => { setI(0); setScore(0); setPicked(null); }}>
            Try again
          </button>
          <button className="btn btn-outline" onClick={onExit}>
            Back to list
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="q-card">
      <div className="row">
        <span className="pill primary">Confusable pair</span>
        <span className="spacer" />
        <span className="muted small">
          {i + 1} of {items.length} · {score} correct
        </span>
      </div>
      <p className="q-sentence">
        {parts[0]}
        <span className="blank">{picked ? item.answer : ' '}</span>
        {parts[1]}
      </p>
      <div className="opts">
        {item.options.map((o) => {
          const st = !picked ? '' : o === item.answer ? 'correct' : o === picked ? 'wrong' : '';
          return (
            <button
              key={o}
              className={`opt ${st} ${picked ? 'locked' : ''}`}
              onClick={() => {
                if (picked) return;
                setPicked(o);
                if (o === item.answer) setScore((s) => s + 1);
              }}
            >
              <span className="k">{st === 'correct' ? <IconCheck width={16} height={16} /> : st === 'wrong' ? <IconX width={16} height={16} /> : o[0]}</span>
              {o}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className={`feedback ${picked === item.answer ? 'ok' : 'bad'}`}>
          <h4>{picked === item.answer ? 'Correct!' : `It's “${item.answer}”`}</h4>
          <p className="small">{item.difference}</p>
          <p className="small" style={{ color: 'var(--review-ink)' }}>
            💡 {item.hook}
          </p>
        </div>
      )}
      {picked && (
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            setPicked(null);
            setI((x) => x + 1);
          }}
        >
          Next <IconArrowRight />
        </button>
      )}
      <button className="btn btn-ghost" onClick={onExit}>
        Exit drill
      </button>
    </section>
  );
}
