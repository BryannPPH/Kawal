import type { ReactNode } from 'react';
import type { RouteName } from '../../types/navigation';

type RouteLinkProps = {
  to: RouteName;
  children: ReactNode;
  onNavigate: (route: RouteName) => void;
  variant?: 'primary' | 'secondary';
};

export function RouteLink({ to, children, onNavigate, variant = 'secondary' }: RouteLinkProps) {
  return (
    <a
      href={`/${to}`}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(to);
      }}
      className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition ${
        variant === 'primary'
          ? 'bg-[#FD7124] text-white hover:bg-[#E85F18]'
          : 'border border-[#F3D7C8] bg-white text-[#3D3835] hover:bg-[#FFEFE6]'
      }`}
    >
      {children}
    </a>
  );
}
