import { useEffect, useState } from 'react';
import { clearAuthSession, getStoredRole, getStoredUser, saveAuthSession } from './lib/authStorage';
import { LoginPage } from './pages/login/LoginPage';
import { ManagerPage } from './pages/manager/ManagerPage';
import { WorkerPage } from './pages/worker/WorkerPage';
import type { AuthUser, RouteName, UserRole } from './types/navigation';

function getRouteFromPath(): RouteName {
  if (window.location.pathname.startsWith('/login')) {
    return 'login';
  }

  return window.location.pathname.startsWith('/worker') ? 'worker' : 'manager';
}

function App() {
  const [route, setRoute] = useState<RouteName>(getRouteFromPath);
  const [role, setRole] = useState<UserRole | null>(getStoredRole);
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextRoute: RouteName) => {
    window.history.pushState({}, '', `/${nextRoute}`);
    setRoute(nextRoute);
  };

  useEffect(() => {
    if (!role || route === 'login') return;

    if (role === 'worker' && route !== 'worker') {
      navigate('worker');
    }

    if (role !== 'worker' && route !== 'manager') {
      navigate('manager');
    }
  }, [role, route]);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const payload = (await response.json()) as { user?: AuthUser; error?: string };

      if (!response.ok || !payload.user) {
        return payload.error ?? 'Unable to sign in';
      }

      saveAuthSession(payload.user);
      setUser(payload.user);
      setRole(payload.user.role);
      navigate(payload.user.role === 'worker' ? 'worker' : 'manager');
      return null;
    } catch {
      return 'Unable to reach login server';
    }
  };

  const logout = () => {
    clearAuthSession();
    setUser(null);
    setRole(null);
    navigate('login');
  };

  if (!role || route === 'login') {
    return (
      <main className="min-h-screen bg-[#F1F2F7] font-sans text-[#2F2C2A]">
        <LoginPage onLogin={login} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F1F2F7] font-sans text-[#2F2C2A]">
      {route === 'worker' ? <WorkerPage user={user} onLogout={logout} /> : <ManagerPage onLogout={logout} />}
    </main>
  );
}

export default App;
