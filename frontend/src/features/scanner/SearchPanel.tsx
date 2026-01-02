import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Check } from 'lucide-react';
import { Command } from '@/components/ui/command';
import { useBusinessSearch } from '@/hooks/useBusinessSearch';
import { Business } from '@/lib/api';
import { useAppStore, MAGGIANOS_TAMPA_BUSINESS_ID } from '@/stores/useAppStore';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBusiness: (business: Business) => void;
}

const SearchPanelComponent = ({ isOpen, onClose, onSelectBusiness }: SearchPanelProps) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { data: searchResults, isLoading: isLoadingSearchResults } = useBusinessSearch(searchQuery);
  const comparisonIds = useAppStore((state) => state.comparisonIds);
  const toggleComparison = useAppStore((state) => state.toggleComparison);

  const handleSelectBusiness = (business: Business) => {
    onSelectBusiness(business);
    setSearchQuery('');
    onClose();
  };

  const handleToggleComparison = (e: React.MouseEvent, businessId: string) => {
    e.stopPropagation();
    toggleComparison(businessId);
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
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
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
                    {searchResults.map((business) => {
                      const isMaggianosMyBusiness = business.business_id === MAGGIANOS_TAMPA_BUSINESS_ID;
                      const isInComparison = comparisonIds.includes(business.business_id);
                      const canAddMore = comparisonIds.length < 3;

                      return (
                        <div
                          key={business.business_id}
                          className="w-full flex items-center gap-2 p-3 hover:bg-slate-700/50 transition-colors will-change-transform"
                        >
                          {/* Add to Comparison Button */}
                          {!isMaggianosMyBusiness && (
                            <button
                              onClick={(e) => handleToggleComparison(e, business.business_id)}
                              disabled={!canAddMore && !isInComparison}
                              className={`flex-shrink-0 p-1.5 rounded-md transition-colors cursor-pointer ${
                                isInComparison
                                  ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                                  : canAddMore
                                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                  : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                              }`}
                              title={
                                isInComparison
                                  ? 'Remove from comparison'
                                  : canAddMore
                                  ? 'Add to comparison'
                                  : 'Max 3 comparisons'
                              }
                            >
                              {isInComparison ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </button>
                          )}

                          {/* Business Info - Clickable */}
                          <button
                            className="flex-1 min-w-0 text-left cursor-pointer"
                            onClick={() => handleSelectBusiness(business)}
                          >
                            <p className="text-sm font-medium text-white truncate">
                              {business.name}
                              {isMaggianosMyBusiness && (
                                <span className="ml-2 text-xs text-yellow-400">(My Business)</span>
                              )}
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
                          </button>
                        </div>
                      );
                    })}
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
};

// Memoized export
export const SearchPanel = memo(SearchPanelComponent);
