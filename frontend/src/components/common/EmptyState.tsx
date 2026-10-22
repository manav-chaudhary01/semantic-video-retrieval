import { FolderSearch } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = FolderSearch,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-[#282C20] bg-[#12140F]/60 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#1A1E14] border border-[#282C20] flex items-center justify-center text-[#D2FF00] mb-4 shadow-[0_0_20px_rgba(210,255,0,0.1)]">
        <Icon className="w-6 h-6 stroke-[1.5]" />
      </div>
      <h4 className="text-base sm:text-lg font-bold font-sans tracking-tight text-[#EBEEE0] uppercase">
        {title}
      </h4>
      <p className="text-xs sm:text-sm text-[#A5A89C] max-w-md mt-1.5 mb-5 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};
