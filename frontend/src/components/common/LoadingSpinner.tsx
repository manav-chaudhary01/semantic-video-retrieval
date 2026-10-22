import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Processing...',
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-10 gap-3.5 text-[#A5A89C] ${className}`}>
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#D2FF00]/10 blur-md animate-pulse" />
        <Loader2 className={`${sizeMap[size]} animate-spin text-[#D2FF00] relative z-10`} />
      </div>
      {label && (
        <p className="text-xs font-mono font-medium tracking-wider uppercase text-[#EBEEE0]">
          {label}
        </p>
      )}
    </div>
  );
};
