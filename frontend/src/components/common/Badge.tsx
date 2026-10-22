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
    lime: 'bg-[#D2FF00]/10 text-[#D2FF00] border-[#D2FF00]/30',
    purple: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
    success: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
    warning: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    danger: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
    info: 'bg-sky-950/60 text-sky-300 border-sky-800/60',
    neutral: 'bg-[#12140F] text-[#A5A89C] border-[#282C20]',
  };

  const dotStyles = {
    lime: 'bg-[#D2FF00]',
    purple: 'bg-purple-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    neutral: 'bg-[#A5A89C]',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 tracking-wider font-mono font-medium',
    md: 'text-xs px-2.5 py-1 tracking-wider font-mono font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 uppercase rounded-md border ${sizeStyles[size]} ${variantStyles[variant]}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />}
      {children}
    </span>
  );
};
