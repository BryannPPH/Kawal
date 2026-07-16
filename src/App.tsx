import { useEffect, useState } from 'react';
import { LoginPage } from './pages/login/LoginPage';
import { ManagerPage } from './pages/manager/ManagerPage';
import { WorkerPage } from './pages/worker/WorkerPage';
import type { AuthUser, RouteName, UserRole } from './types/navigation';

const authStorageKey = 'garudie-auth-role';
const authUserStorageKey = 'garudie-auth-user';

function getRouteFromPath(): RouteName {
  if (window.location.pathname.startsWith('/login')) {
    return 'login';
  }

  return window.location.pathname.startsWith('/worker') ? 'worker' : 'manager';
}

function getStoredRole(): UserRole | null {
  const role = localStorage.getItem(authStorageKey);
  return role === 'manager' || role === 'worker' ? role : null;
}

function getStoredUser(): AuthUser | null {
  const user = localStorage.getItem(authUserStorageKey);

  if (!user) return null;

  try {
    return JSON.parse(user) as AuthUser;
  } catch {
    return null;
  }
}

function App() {
  const [route, setRoute] = useState<RouteName>(getRouteFromPath);
  const [role, setRole] = useState<UserRole | null>(getStoredRole);
  const [, setUser] = useState<AuthUser | null>(getStoredUser);

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

    if (role === 'manager' && route !== 'manager') {
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

      localStorage.setItem(authStorageKey, payload.user.role);
      localStorage.setItem(authUserStorageKey, JSON.stringify(payload.user));
      setRole(payload.user.role);
      setUser(payload.user);
      navigate(payload.user.role);
      return null;
    } catch {
      return 'Unable to reach login server';
    }
  };

  const logout = () => {
    localStorage.removeItem(authStorageKey);
    localStorage.removeItem(authUserStorageKey);
    setRole(null);
    setUser(null);
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
      {route === 'worker' ? <WorkerPage onLogout={logout} /> : <ManagerPage onLogout={logout} />}
    </main>
  );
}

export default App;
