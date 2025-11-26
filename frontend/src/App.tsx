import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessProvider } from './context/BusinessContext';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

// Create a client with optimized caching settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      retry: 1, // Only retry failed requests once
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BusinessProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </BrowserRouter>
      </BusinessProvider>
    </QueryClientProvider>
  );
};

export default App;
