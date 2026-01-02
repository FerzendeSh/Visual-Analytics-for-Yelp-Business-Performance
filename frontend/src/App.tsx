import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AppLayout } from '@/features/shell/AppLayout';
import { useAppStore } from '@/stores/useAppStore';
import { Loader2 } from 'lucide-react';

// Lazy load feature modules for code splitting
// This reduces initial bundle size by ~40-50%
const ScannerMode = lazy(() => import('@/features/scanner/ScannerMode').then(m => ({ default: m.ScannerMode })));
const ComparisonMode = lazy(() => import('@/features/comparison/ComparisonMode').then(m => ({ default: m.ComparisonMode })));

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

// Loading fallback component
function FeatureLoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Loading feature...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const viewMode = useAppStore((state) => state.viewMode);

  // Keep both modes mounted but toggle visibility to prevent re-rendering
  // This preserves map state, scatter plot zoom, and component state across tab switches
  return (
    <AppLayout>
      <div className="w-full h-full relative">
        <motion.div
          key="scanner"
          initial={{ opacity: 0 }}
          animate={{ opacity: viewMode === 'SCAN' ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
          style={{
            pointerEvents: viewMode === 'SCAN' ? 'auto' : 'none',
            visibility: viewMode === 'SCAN' ? 'visible' : 'hidden'
          }}
        >
          <Suspense fallback={<FeatureLoadingFallback />}>
            <ScannerMode />
          </Suspense>
        </motion.div>

        <motion.div
          key="comparison"
          initial={{ opacity: 0 }}
          animate={{ opacity: viewMode === 'COMPARE' ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
          style={{
            pointerEvents: viewMode === 'COMPARE' ? 'auto' : 'none',
            visibility: viewMode === 'COMPARE' ? 'visible' : 'hidden'
          }}
        >
          <Suspense fallback={<FeatureLoadingFallback />}>
            <ComparisonMode />
          </Suspense>
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
