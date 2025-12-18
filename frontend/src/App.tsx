import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AppLayout } from '@/features/shell/AppLayout';
import { ScannerMode } from '@/features/scanner/ScannerMode';
import { ComparisonMode } from '@/features/comparison/ComparisonMode';
import { useAppStore } from '@/stores/useAppStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes default
      gcTime: 10 * 60 * 1000, // Keep unused data for 10 minutes
    },
  },
});

function AppContent() {
  const viewMode = useAppStore((state) => state.viewMode);

  // Keep both modes mounted to preserve React Query cache
  // Use CSS-based visibility instead of unmounting
  return (
    <AppLayout>
      <div className="w-full h-full relative">
        <motion.div
          initial={false}
          animate={{ opacity: viewMode === 'SCAN' ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
          style={{
            pointerEvents: viewMode === 'SCAN' ? 'auto' : 'none',
            zIndex: viewMode === 'SCAN' ? 1 : 0
          }}
        >
          <ScannerMode />
        </motion.div>
        <motion.div
          initial={false}
          animate={{ opacity: viewMode === 'COMPARE' ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
          style={{
            pointerEvents: viewMode === 'COMPARE' ? 'auto' : 'none',
            zIndex: viewMode === 'COMPARE' ? 1 : 0
          }}
        >
          <ComparisonMode />
        </motion.div>
      </div>
    </AppLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
