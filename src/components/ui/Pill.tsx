import type { ReactNode } from 'react';

export function Pill({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}
