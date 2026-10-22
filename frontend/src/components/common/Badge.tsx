import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'lime' | 'purple';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
}) => {
  const variantStyles = {
    lime: 'bg-white/10 text-white border-white/20',
    purple: 'bg-purple-950/40 text-purple-300 border-purple-800/40',
    success: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40',
    warning: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
    danger: 'bg-rose-950/40 text-rose-300 border-rose-800/40',
    info: 'bg-sky-950/40 text-sky-300 border-sky-800/40',
    neutral: 'bg-neutral-900/80 text-neutral-400 border-white/10',
  };

  const dotStyles = {
    lime: 'bg-white',
    purple: 'bg-purple-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    neutral: 'bg-neutral-500',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2.5 py-0.5 tracking-wider font-mono font-medium',
    md: 'text-xs px-3 py-1 tracking-wider font-mono font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 uppercase rounded-full border ${sizeStyles[size]} ${variantStyles[variant]}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />}
      {children}
    </span>
  );
};
