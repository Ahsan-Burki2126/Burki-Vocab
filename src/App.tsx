import type { ReactNode } from 'react';
import { IconHome, IconLearn, IconLibrary, IconPractice, IconProgress, IconReview, IconToolkit } from './components/Icons';
import { UIProvider } from './components/UI';
import { dueIds } from './lib/metrics';
import { go, useRoute, type Route } from './lib/router';
import { StoreProvider, useStore } from './lib/store';
import Home from './screens/Home';
import Learn from './screens/Learn';
import Library from './screens/Library';
import Practice from './screens/Practice';
import Progress from './screens/Progress';
import Review from './screens/Review';
import Toolkit from './screens/Toolkit';

export function Brand() {
  return (
    <a
      className="brand"
      href="#/home"
      onClick={(e) => {
        e.preventDefault();
        go('home');
      }}
    >
      <span className="brand-mark">B</span>
      <span>
        Burki Vocab
        <small>NPFTAS vocabulary trainer</small>
      </span>
    </a>
  );
}

const NAV: { route: Route; label: string; icon: ReactNode }[] = [
  { route: 'home', label: 'Home', icon: <IconHome /> },
  { route: 'learn', label: 'Learn', icon: <IconLearn /> },
  { route: 'practice', label: 'Practice', icon: <IconPractice /> },
  { route: 'review', label: 'Review', icon: <IconReview /> },
  { route: 'progress', label: 'Progress', icon: <IconProgress /> },
];
const EXTRA_NAV: { route: Route; label: string; icon: ReactNode }[] = [
  { route: 'library', label: 'Word bank', icon: <IconLibrary /> },
  { route: 'toolkit', label: 'Exam toolkit', icon: <IconToolkit /> },
];

function Shell() {
  const route = useRoute();
  const { state, today } = useStore();
  const due = dueIds(state, today).length;
  const log = state.days[today];
  const learnLeft = log ? log.words.length - log.learned.length : 0;

  const badge = (r: Route) => (r === 'review' ? due : r === 'learn' ? learnLeft : 0);

  let screen: ReactNode;
  switch (route) {
    case 'learn':
      screen = <Learn />;
      break;
    case 'practice':
      screen = <Practice />;
      break;
    case 'review':
      screen = <Review />;
      break;
    case 'progress':
      screen = <Progress />;
      break;
    case 'library':
      screen = <Library />;
      break;
    case 'toolkit':
      screen = <Toolkit />;
      break;
    default:
      screen = <Home />;
  }

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <Brand />
        {NAV.map((n) => (
          <button key={n.route} className={`side-link ${route === n.route ? 'active' : ''}`} onClick={() => go(n.route)} aria-current={route === n.route ? 'page' : undefined}>
            {n.icon}
            {n.label}
            {badge(n.route) > 0 && <span className="count">{badge(n.route)}</span>}
          </button>
        ))}
        <div className="side-sep" />
        {EXTRA_NAV.map((n) => (
          <button key={n.route} className={`side-link ${route === n.route ? 'active' : ''}`} onClick={() => go(n.route)} aria-current={route === n.route ? 'page' : undefined}>
            {n.icon}
            {n.label}
          </button>
        ))}
        <p className="side-foot">
          Made for NPFTAS CBT prep — Islamabad Police, NCCIA, FIA &amp; more.
        </p>
      </nav>

      <main className="main" key={route}>
        {route !== 'home' && (
          <div className="topbar mobile-only" style={{ marginBottom: 8 }}>
            <Brand />
            {(route === 'library' || route === 'toolkit') && (
              <button className="btn btn-ghost" onClick={() => go('home')}>
                Home
              </button>
            )}
          </div>
        )}
        {screen}
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <button key={n.route} className={`tab ${route === n.route ? 'active' : ''}`} onClick={() => go(n.route)} aria-current={route === n.route ? 'page' : undefined}>
            {n.icon}
            {n.label}
            {badge(n.route) > 0 && <span className="dot">{badge(n.route)}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <UIProvider>
        <Shell />
      </UIProvider>
    </StoreProvider>
  );
}
