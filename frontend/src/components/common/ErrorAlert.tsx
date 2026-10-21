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
  title = 'An error occurred',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex items-start justify-between p-4 rounded-xl border border-rose-900/60 bg-rose-950/40 text-rose-200 ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <h5 className="text-sm font-semibold text-rose-100">{title}</h5>
          <p className="text-xs text-rose-300/90 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          className="border-rose-800 text-rose-200 hover:bg-rose-900/60 shrink-0 ml-3"
          onClick={onRetry}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          Retry
        </Button>
      )}
    </div>
  );
};
