import type { ReactNode } from 'react';

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  disabled?: boolean;
};

export function Button({ children, onClick, variant = 'secondary', className = '', disabled = false }: ButtonProps) {
  const styles = {
    primary: 'bg-[#FD7124] text-white hover:bg-[#E85F18]',
    secondary: 'border border-[#F3D7C8] bg-white text-[#3D3835] hover:bg-[#FFEFE6]',
    ghost: 'text-[#746A64] hover:bg-[#FFEFE6] hover:text-[#2F2C2A]'
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-65 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
