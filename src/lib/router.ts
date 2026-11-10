import { useEffect, useState } from 'react';

export type Route = 'home' | 'learn' | 'practice' | 'review' | 'progress' | 'library' | 'toolkit' | 'account';
const ROUTES: Route[] = ['home', 'learn', 'practice', 'review', 'progress', 'library', 'toolkit', 'account'];

function read(): Route {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Route;
  return ROUTES.includes(h) ? h : 'home';
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(route: Route) {
  if (read() === route) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.location.hash = route;
}
