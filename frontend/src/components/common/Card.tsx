import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  action,
}) => {
  return (
    <div
      className={`bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-7 transition-all duration-300 relative ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
          <div>
            {title && (
              <h3 className="text-sm sm:text-base font-semibold font-display tracking-tight text-white uppercase">
                {title}
              </h3>
            )}
            {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
