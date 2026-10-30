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
    'inline-flex items-center justify-center font-medium tracking-tight font-sans transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none rounded-full';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-xs sm:text-sm px-5 py-2 gap-2',
    lg: 'text-sm sm:text-base px-6 py-2.5 gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-white text-black hover:bg-neutral-200 active:scale-[0.98] shadow-sm',
    lime:
      'bg-white text-black hover:bg-neutral-200 active:scale-[0.98] shadow-sm',
    secondary:
      'bg-neutral-900/90 text-white border border-white/10 hover:border-white/20 hover:bg-neutral-800 active:scale-[0.98]',
    outline:
      'border border-white/15 bg-transparent text-white hover:border-white/40 hover:bg-white/5 active:scale-[0.98]',
    danger:
      'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 active:scale-[0.98]',
    ghost:
      'hover:bg-white/5 text-neutral-400 hover:text-white',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
