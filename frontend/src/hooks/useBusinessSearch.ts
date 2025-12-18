import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';
import { api } from '@/lib/api';

export function useBusinessSearch(query: string) {
  const debouncedQuery = useDebounce(query, 500); // Debounce for 500ms

  return useQuery({
    queryKey: ['businessSearch', debouncedQuery],
    queryFn: () => api.businesses.search({ q: debouncedQuery }),
    enabled: !!debouncedQuery && debouncedQuery.length > 2, // Only query if debounced query exists and is long enough
  });
}
