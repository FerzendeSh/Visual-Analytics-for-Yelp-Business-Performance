import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-3">
      <Loader2 className={`${sizeMap[size]} animate-spin text-primary`} />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
