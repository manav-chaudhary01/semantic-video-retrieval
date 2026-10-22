import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorAlertProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  title = 'System Alert',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex items-start justify-between p-4 sm:p-5 rounded-2xl border border-rose-900/60 bg-rose-950/30 text-rose-200 backdrop-blur-sm ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="p-1.5 rounded-lg bg-rose-900/40 border border-rose-800/60 text-rose-400 shrink-0 mt-0.5">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div>
          <h5 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-rose-100 font-sans">
            {title}
          </h5>
          <p className="text-xs text-rose-300/80 mt-1 font-mono leading-relaxed">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          className="border-rose-800 text-rose-200 hover:border-rose-400 hover:text-white hover:bg-rose-950/80 shrink-0 ml-4"
          onClick={onRetry}
          leftIcon={<RotateCcw className="w-3 h-3" />}
        >
          Retry
        </Button>
      )}
    </div>
  );
};
