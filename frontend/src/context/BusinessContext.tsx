import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Business, getBusinessById } from '../api';

interface BusinessContextType {
  myBusiness: Business | null;
  setMyBusiness: (business: Business | null) => void;
  comparisonBusinesses: Business[];
  addComparison: (business: Business) => void;
  removeComparison: (businessId: string) => void;
  clearComparisons: () => void;
  selectedBusiness: Business | null;
  setSelectedBusiness: (business: Business | null) => void;
  isLoading: boolean;
  maxComparisons: number;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

// Default logged-in business
const DEFAULT_BUSINESS_ID = 'IG2KelKEHCwybPl98frdgQ';
const MAX_COMPARISONS = 3;

export const BusinessProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [myBusiness, setMyBusinessState] = useState<Business | null>(null);
  const [comparisonBusinesses, setComparisonBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleSetMyBusiness = useCallback((business: Business | null) => {
    setMyBusinessState(business);
    // Persist to localStorage for persistence across sessions
    if (business) {
      localStorage.setItem('myBusiness', JSON.stringify(business));
    } else {
      localStorage.removeItem('myBusiness');
    }
  }, []);

  const addComparison = useCallback((business: Business) => {
    setComparisonBusinesses(prev => {
      // Don't add if already in comparison or if it's the my business
      if (prev.some(b => b.business_id === business.business_id) ||
          myBusiness?.business_id === business.business_id) {
        return prev;
      }
      // Don't exceed max
      if (prev.length >= MAX_COMPARISONS) {
        return prev;
      }
      return [...prev, business];
    });
  }, [myBusiness]);

  const removeComparison = useCallback((businessId: string) => {
    setComparisonBusinesses(prev => prev.filter(b => b.business_id !== businessId));
  }, []);

  const clearComparisons = useCallback(() => {
    setComparisonBusinesses([]);
  }, []);

  // Load from localStorage or fetch default business on mount
  React.useEffect(() => {
    const loadBusiness = async () => {
      try {
        const stored = localStorage.getItem('myBusiness');
        if (stored) {
          const parsed = JSON.parse(stored);
          setMyBusinessState(parsed);
        } else {
          // Fetch the default business by ID from database
          const business = await getBusinessById(DEFAULT_BUSINESS_ID);
          setMyBusinessState(business);
          localStorage.setItem('myBusiness', JSON.stringify(business));
        }
      } catch (e) {
        console.error('Failed to load business', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadBusiness();
  }, []);

  return (
    <BusinessContext.Provider value={{
      myBusiness,
      setMyBusiness: handleSetMyBusiness,
      comparisonBusinesses,
      addComparison,
      removeComparison,
      clearComparisons,
      selectedBusiness,
      setSelectedBusiness,
      isLoading,
      maxComparisons: MAX_COMPARISONS
    }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useMyBusiness = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useMyBusiness must be used within a BusinessProvider');
  }
  return context;
};
