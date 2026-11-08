import { useMemo, useState } from 'react';
import { useUI } from '../components/UI';
import { IconSearch } from '../components/Icons';
import { Likelihood, Pol } from '../components/WordParts';
import { LETTERS, WORDS } from '../lib/data';
import { MASTERED_STABILITY } from '../lib/fsrs';
import { useStore } from '../lib/store';

type Filter = 'all' | 'new' | 'learning' | 'mastered' | 'saved' | 'extra';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'Not learned' },
  { id: 'learning', label: 'Learning' },
  { id: 'mastered', label: 'Mastered' },
  { id: 'saved', label: 'Bookmarked' },
  { id: 'extra', label: 'Extra words' },
];

export default function Library() {
  const { state } = useStore();
  const { openWord } = useUI();
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'az' | 'likely'>('az');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = WORDS.filter((w) => {
      if (letter && w.word[0].toUpperCase() !== letter) return false;
      const c = state.cards[w.id];
      if (filter === 'new' && c) return false;
      if (filter === 'learning' && !(c?.state === 'review' && c.s < MASTERED_STABILITY)) return false;
      if (filter === 'mastered' && !(c && (c.state === 'known' || c.s >= MASTERED_STABILITY))) return false;
      if (filter === 'saved' && !state.bookmarks.includes(w.id)) return false;
      if (filter === 'extra' && w.source !== 'extra') return false;
      if (!needle) return true;
      return (
        w.word.toLowerCase().includes(needle) ||
        w.meaning.toLowerCase().includes(needle) ||
        w.synonyms.some((s) => s.toLowerCase().includes(needle)) ||
        w.antonyms.some((s) => s.toLowerCase().includes(needle)) ||
        w.urdu.includes(q.trim())
      );
    });
    return sort === 'likely' ? out.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word)) : out;
  }, [q, letter, filter, sort, state.cards, state.bookmarks]);

  return (
    <div className="page">
      <div className="learn-head">
        <h2 style={{ fontSize: 24 }}>Word bank</h2>
        <span className="muted small">{list.length} words</span>
      </div>
      <label className="search">
        <IconSearch />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search word, meaning, synonym or اردو" aria-label="Search words" />
      </label>
      <div className="letter-strip" role="group" aria-label="Filter by letter">
        <button className={!letter ? 'on' : ''} onClick={() => setLetter(null)} style={{ padding: '0 10px' }}>
          All
        </button>
        {LETTERS.map((l) => (
          <button key={l} className={letter === l ? 'on' : ''} onClick={() => setLetter(letter === l ? null : l)}>
            {l}
          </button>
        ))}
      </div>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div className="seg">
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="seg">
          <button className={sort === 'az' ? 'on' : ''} onClick={() => setSort('az')}>
            A–Z
          </button>
          <button className={sort === 'likely' ? 'on' : ''} onClick={() => setSort('likely')}>
            Most likely
          </button>
        </div>
      </div>
      <div className="card tight">
        {list.length === 0 ? (
          <p className="muted center row" style={{ padding: 24 }}>
            No words match.
          </p>
        ) : (
          <div className="list">
            {list.map((w) => {
              const c = state.cards[w.id];
              const status = !c ? null : c.state === 'known' ? 'Known' : c.s >= MASTERED_STABILITY ? 'Mastered' : 'Learning';
              return (
                <button key={w.id} className="list-item" onClick={() => openWord(w.id)}>
                  <Pol p={w.polarity} />
                  <div className="body">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="w">{w.word}</span>
                      {w.source === 'extra' && <span className="pill" style={{ height: 20, fontSize: 11 }}>extra</span>}
                    </div>
                    <div className="m">
                      {w.meaning} · {w.synonyms[0]} ↔ {w.antonyms[0]}
                    </div>
                  </div>
                  {status && <span className={`pill ${status === 'Learning' ? 'primary' : 'success'}`}>{status}</span>}
                  <Likelihood w={w} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
