import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check } from 'lucide-react';
import { Command } from '@/components/ui/command';
import { useBusinessSearch } from '@/hooks/useBusinessSearch';
import { Business } from '@/lib/api';
import { useAppStore, MAGGIANOS_TAMPA_BUSINESS_ID } from '@/stores/useAppStore';

interface SearchPanelProps {
  onSelectBusiness: (business: Business) => void;
}

const SearchPanelComponent = ({ onSelectBusiness }: SearchPanelProps) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const { data: searchResults, isLoading: isLoadingSearchResults } = useBusinessSearch(searchQuery);
  const comparisonIds = useAppStore((state) => state.comparisonIds);
  const toggleComparison = useAppStore((state) => state.toggleComparison);

  const handleSelectBusiness = (business: Business) => {
    onSelectBusiness(business);
    // Set the business name in the search bar
    setSearchQuery(business.name);
    setIsFocused(false);
  };

  const handleToggleComparison = (e: React.MouseEvent, businessId: string) => {
    e.stopPropagation();
    toggleComparison(businessId);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsFocused(false);
  };

  const showResults = isFocused && (isLoadingSearchResults || (searchResults && searchResults.length > 0) || (searchQuery.length > 2 && searchResults?.length === 0));
  const showHelper = isFocused && searchQuery.length < 3 && searchQuery.length > 0;

  return (
    <>
      {/* Search Bar - Always visible like Google Maps */}
      <div className="absolute top-0.5 left-1 z-30">
        <Command
          onSearch={setSearchQuery}
          onClear={handleClearSearch}
          value={searchQuery}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              handleClearSearch();
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay blur to allow click events on results to fire first
            setTimeout(() => {
              if (!searchQuery) {
                setIsFocused(false);
              }
            }, 200);
          }}
          placeholder="Search businesses..."
          className="w-[350px]"
        />
      </div>

      {/* Helper Text - Shows when focused but less than 3 characters */}
      {isFocused && searchQuery.length === 0 && (
        <div className="absolute top-12 left-1 z-30 w-[350px]">
          <div className="glass rounded-lg shadow-2xl overflow-hidden p-3">
            <p className="text-xs text-slate-400">
              Type at least 3 characters to search for businesses by name, city, or category
            </p>
          </div>
        </div>
      )}

      {/* Search Results Dropdown - Shows when focused and has results */}
      {showResults && (
        <div className="absolute top-16 left-3 z-30 w-[350px]">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="glass rounded-lg shadow-2xl overflow-hidden"
          >
              {isLoadingSearchResults && (
                <p className="text-sm text-slate-400 p-3">Searching...</p>
              )}
              {!isLoadingSearchResults && searchResults && searchResults.length > 0 && (
                <div
                  className="max-h-96 overflow-y-auto divide-y divide-slate-700 overscroll-contain will-change-scroll"
                  style={{ contain: 'layout style paint' }}
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
          </motion.div>
        </div>
      )}

      {/* Click outside to close results or helper */}
      {(showResults || (isFocused && searchQuery.length === 0)) && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setIsFocused(false)}
        />
      )}
    </>
  );
};

// Memoized export
export const SearchPanel = memo(SearchPanelComponent);
