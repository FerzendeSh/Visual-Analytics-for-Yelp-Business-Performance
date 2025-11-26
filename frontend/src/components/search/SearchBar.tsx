import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Business } from '../../api/types';
import { searchBusinesses } from '../../api/endpoints/businesses';
import './SearchBar.css';

interface SearchBarProps {
  onBusinessSelect: (business: Business | null) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onBusinessSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Business[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length === 0) {
      setResults([]);
      setError(null);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedIndex(-1);

    try {
      const searchResults = await searchBusinesses(searchQuery, { limit: 10 });
      setResults(searchResults);
      setIsOpen(true);
    } catch (err) {
      setError('Failed to search businesses');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle result selection
  const handleSelectResult = (business: Business) => {
    setSelectedIndex(-1);
    setQuery(business.name); // Update query to show the selected business name
    onBusinessSelect(business);
    // Keep results visible - only user can clear with the X button
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="search-bar-wrapper" ref={searchRef}>
      <div className="search-bar-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name, city, category... (e.g., 'Pizza Philadelphia' or 'Coffee NYC')"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length > 0 && setIsOpen(true)}
        />
        {query && (
          <button
            className="search-clear-btn"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              onBusinessSelect(null);
            }}
            title="Clear search"
          >
            ✕
          </button>
        )}
        {isLoading && <div className="search-spinner"></div>}
      </div>

      {isOpen && (
        <div className="search-results-container">
          {isLoading && (
            <div className="search-loading">Searching...</div>
          )}
          {error && (
            <div className="search-error">{error}</div>
          )}
          {!isLoading && results.length === 0 && query.trim().length > 0 && (
            <div className="search-no-results">No businesses found</div>
          )}
          {results.length > 0 && (
            <ul className="search-results-list">
              {results.map((business, index) => (
                <li
                  key={business.business_id}
                  className={`search-result-item ${index === selectedIndex ? 'active' : ''}`}
                  onClick={() => handleSelectResult(business)}
                >
                  <div className="result-content">
                    <div className="result-name">{business.name}</div>
                    <div className="result-meta">
                      <span className="result-location">
                        {business.city}, {business.state}
                      </span>
                      <span className="result-rating">
                        ★ {business.stars.toFixed(1)} ({business.review_count} reviews)
                      </span>
                      {business.categories && (
                        <span className="result-category">{business.categories.split(',')[0].trim()}</span>
                      )}
                    </div>
                  </div>
                  <div className="result-status">
                    <span className={`status-badge ${business.is_open ? 'open' : 'closed'}`}>
                      {business.is_open ? 'Open' : 'Closed'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
