import { useEffect, useState } from 'react';
import { ManagerPage } from './pages/manager/ManagerPage';
import { WorkerPage } from './pages/worker/WorkerPage';
import type { RouteName } from './types/navigation';

function getRouteFromPath(): RouteName {
  return window.location.pathname.startsWith('/worker') ? 'worker' : 'manager';
}

function App() {
  const [route, setRoute] = useState<RouteName>(getRouteFromPath);

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextRoute: RouteName) => {
    window.history.pushState({}, '', `/${nextRoute}`);
    setRoute(nextRoute);
  };

  return (
    <main className="min-h-screen bg-[#F1F2F7] font-sans text-[#2F2C2A]">
      {route === 'worker' ? <WorkerPage onNavigate={navigate} /> : <ManagerPage onNavigate={navigate} />}
    </main>
  );
}

export default App;
