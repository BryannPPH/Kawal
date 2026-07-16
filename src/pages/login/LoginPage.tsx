import { HardHat, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

type LoginPageProps = {
  onLogin: (email: string, password: string) => Promise<string | null>;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const loginError = await onLogin(email, password);

    if (loginError) {
      setError(loginError);
    }

    setLoading(false);
  };

  return (
    <section className="grid min-h-screen place-items-center bg-[#F1F2F7] px-4 py-8">
      <div className="w-full max-w-[430px] rounded-lg border border-[#F3D7C8] bg-white p-6 shadow-[0_24px_80px_rgba(76,48,35,0.12)]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#FD7124] text-white">
            <HardHat size={20} />
          </span>
          <div>
            <p className="text-lg font-bold text-[#2F2C2A]">GARUDIE</p>
            <p className="text-sm text-[#776B63]">Workforce OS</p>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-normal text-[#2F2C2A]">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-[#776B63]">Use your registered workforce account.</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={submitLogin}>
          <label className="block">
            <span className="text-sm font-semibold text-[#2F2C2A]">Email</span>
            <span className="mt-2 flex h-11 items-center gap-3 rounded-md border border-[#F3D7C8] bg-[#FFF8F4] px-3 text-[#776B63]">
              <Mail size={17} />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#2F2C2A] outline-none placeholder:text-[#A09188]"
                type="email"
                autoComplete="off"
                placeholder="name@company.com"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-[#2F2C2A]">Password</span>
            <span className="mt-2 flex h-11 items-center gap-3 rounded-md border border-[#F3D7C8] bg-[#FFF8F4] px-3 text-[#776B63]">
              <Lock size={17} />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#2F2C2A] outline-none placeholder:text-[#A09188]"
                type="password"
                autoComplete="new-password"
                placeholder="Enter password"
                required
              />
            </span>
          </label>

          {error ? <p className="rounded-md bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-md bg-[#FD7124] text-sm font-semibold text-white transition hover:bg-[#E85F18] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-[#F3D7C8]" />
          <span className="text-xs font-semibold text-[#A09188]">or</span>
          <span className="h-px flex-1 bg-[#F3D7C8]" />
        </div>

        <button
          type="button"
          onClick={() => setError('Google OAuth is not connected yet.')}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#F3D7C8] bg-white text-sm font-semibold text-[#3D3835] transition hover:bg-[#FFF8F4]"
        >
          <GoogleLogo />
          Continue with Google
        </button>

      </div>
    </section>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
