import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Command } from '@/components/ui/command';
import { useBusinessSearch } from '@/hooks/useBusinessSearch';
import { Business } from '@/lib/api';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBusiness: (business: Business) => void;
}

export function SearchPanel({ isOpen, onClose, onSelectBusiness }: SearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { data: searchResults, isLoading: isLoadingSearchResults } = useBusinessSearch(searchQuery);

  const handleSelectBusiness = (business: Business) => {
    onSelectBusiness(business);
    setSearchQuery('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
          className="absolute top-20 right-6 z-30 w-full max-w-md"
        >
          <div className="glass rounded-lg shadow-2xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Search Businesses</h3>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors"
                title="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search Input */}
            <div
              onFocus={(e) => e.stopPropagation()}
              onBlur={(e) => e.stopPropagation()}
            >
              <Command
                onSearch={setSearchQuery}
                value={searchQuery}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    onClose();
                  }
                }}
              />
            </div>

            {/* Search Results - Optimized with CSS containment for performance */}
            {(isLoadingSearchResults || (searchResults && searchResults.length > 0)) && (
              <div className="mt-3 rounded-md border border-slate-700 bg-slate-800/50">
                {isLoadingSearchResults && (
                  <p className="text-sm text-slate-400 p-3">Searching...</p>
                )}
                {!isLoadingSearchResults && searchResults && searchResults.length > 0 && (
                  <div
                    className="max-h-96 overflow-y-auto divide-y divide-slate-700 overscroll-contain will-change-scroll"
                    style={{ contain: 'layout style paint' }} // CSS containment for better rendering performance
                  >
                    {searchResults.map((business) => (
                      <button
                        key={business.business_id}
                        className="w-full flex items-start justify-between p-3 hover:bg-slate-700/50 active:bg-slate-700 cursor-pointer text-left transition-colors will-change-transform"
                        onClick={() => handleSelectBusiness(business)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {business.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-slate-400">
                              {business.city}, {business.state}
                            </p>
                            <span className="text-xs text-slate-500">•</span>
                            <p className="text-xs text-amber-400">
                              ⭐ {business.stars.toFixed(1)}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {!isLoadingSearchResults && searchQuery.length > 2 && searchResults?.length === 0 && (
                  <p className="text-sm text-slate-400 p-3">No results found for "{searchQuery}"</p>
                )}
              </div>
            )}

            {/* Helper Text */}
            {!searchQuery && (
              <p className="text-xs text-slate-500 mt-3">
                Type at least 3 characters to search for businesses by name, city, or category
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
