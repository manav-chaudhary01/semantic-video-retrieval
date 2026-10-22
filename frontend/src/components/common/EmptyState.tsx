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
      className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-white/15 bg-neutral-950 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white mb-4">
        <Icon className="w-5 h-5 stroke-[1.5]" />
      </div>
      <h4 className="text-base sm:text-lg font-semibold font-display tracking-tight text-white uppercase">
        {title}
      </h4>
      <p className="text-xs sm:text-sm text-neutral-400 max-w-md mt-1.5 mb-5 leading-relaxed font-sans">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};
