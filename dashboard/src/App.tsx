import { useEffect, useState } from 'react';
import { Overview } from './Overview';
import { PrDetail } from './PrDetail';
import type { DashboardData } from './types';
import { Logo } from './ui';

export const REPO_URL = 'https://github.com/WalRol/storefront-guardian';

/** Ruteo por hash: funciona en GitHub Pages sin configurar el servidor. */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '');
}

export function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const route = useHashRoute();

  useEffect(() => {
    fetch('data.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  const prId = route.startsWith('pr/') ? route.slice(3) : null;
  const pr = prId && data ? data.cases.find((c) => c.id === prId) : undefined;

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <a href="#/" className="brand">
            <Logo />
            <span>Storefront Guardian</span>
          </a>
          <nav className="topnav">
            <a href="#/">Panel</a>
            <a href={`${REPO_URL}/blob/main/DECISIONES.md`} target="_blank" rel="noreferrer">
              Decisiones
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn btn-ghost">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="container">
        {error && <p className="state">No se pudieron cargar los datos ({error}).</p>}
        {!data && !error && <p className="state">Cargando…</p>}
        {data && !prId && <Overview data={data} />}
        {data && prId && (pr ? <PrDetail pr={pr} /> : <p className="state">No existe el PR {prId}.</p>)}
      </main>

      <footer className="footer">
        <div className="container">
          Datos reales: 13 Pull Requests del eval, revisados con Gemini (tier gratuito). El detalle de cada PR se
          reproduce desde las respuestas grabadas; typecheck, tests y validación de fixes se ejecutaron de verdad.
          {data && <> Generado el {new Date(data.generatedAt).toLocaleDateString('es-AR')}.</>}
        </div>
      </footer>
    </>
  );
}
