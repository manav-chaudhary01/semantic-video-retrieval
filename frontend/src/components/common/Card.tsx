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
      className={`bg-[#12140F] border border-[#22271C] rounded-2xl p-5 sm:p-6 transition-all duration-200 relative ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#22271C]">
          <div>
            {title && (
              <h3 className="text-sm sm:text-base font-bold font-display tracking-tight text-[#EBEEE0] uppercase">
                {title}
              </h3>
            )}
            {subtitle && <p className="text-xs text-[#A5A89C] mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
