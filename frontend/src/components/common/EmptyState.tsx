import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, message, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4 p-6 text-center">
      {Icon && (
        <div className="p-3 rounded-full glass">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{message}</p>
        {subtitle && (
          <p className="text-muted-foreground text-xs opacity-70 max-w-md">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 glass rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
