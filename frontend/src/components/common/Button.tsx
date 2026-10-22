import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'lime';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium tracking-wide uppercase font-sans transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#D2FF00]/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none';

  const sizeStyles = {
    sm: 'text-[11px] px-3 py-1.5 gap-1.5 rounded-lg tracking-wider font-semibold',
    md: 'text-xs px-4 py-2 gap-2 rounded-xl font-bold tracking-wider',
    lg: 'text-sm px-6 py-3 gap-2.5 rounded-xl font-extrabold tracking-wider',
  };

  const variantStyles = {
    primary:
      'bg-[#D2FF00] hover:bg-[#b8e000] text-[#0B0C0A] shadow-[0_0_20px_rgba(210,255,0,0.2)] hover:shadow-[0_0_25px_rgba(210,255,0,0.4)] active:scale-[0.98]',
    lime:
      'bg-[#D2FF00] hover:bg-[#b8e000] text-[#0B0C0A] shadow-[0_0_20px_rgba(210,255,0,0.2)] hover:shadow-[0_0_25px_rgba(210,255,0,0.4)] active:scale-[0.98]',
    secondary:
      'bg-[#1A1E14] hover:bg-[#282C20] text-[#EBEEE0] border border-[#282C20] hover:border-[#38402A] active:scale-[0.98]',
    outline:
      'border border-[#282C20] hover:border-[#D2FF00] bg-transparent text-[#EBEEE0] hover:text-[#D2FF00] active:scale-[0.98]',
    danger:
      'bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-800/60 shadow-sm active:scale-[0.98]',
    ghost:
      'hover:bg-[#1A1E14] text-[#A5A89C] hover:text-[#EBEEE0]',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
