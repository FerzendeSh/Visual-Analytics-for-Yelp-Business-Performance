import React, { ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { Business } from '../../api';
import { useMyBusiness } from '../../context/BusinessContext';
import Sidebar from './Sidebar';
import MainContent from './MainContent';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showSidebar?: boolean;
  businesses?: Business[];
  selectedCity?: string;
  selectedCategory?: string;
  selectedNeighborhood?: string;
  minRating?: number;
  maxRating?: number;
  selectedStatus?: number | null;
  period?: 'month' | 'year';
  startYear?: number;
  endYear?: number;
  availableYears?: number[];
  onCityChange?: (city: string) => void;
  onCategoryChange?: (category: string) => void;
  onNeighborhoodChange?: (neighborhood: string) => void;
  onMinRatingChange?: (rating: number) => void;
  onMaxRatingChange?: (rating: number) => void;
  onStatusChange?: (status: number | null) => void;
  onPeriodChange?: (period: 'month' | 'year') => void;
  onYearRangeChange?: (startYear: number, endYear: number) => void;
  onResetFilters?: () => void;
  onBusinessSelect?: (business: Business | null) => void;
  comparisonBusinesses?: Business[];
}

const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  subtitle,
  showSidebar = true,
  businesses = [],
  selectedCity = "",
  selectedCategory = "",
  selectedNeighborhood = "",
  minRating = 1,
  maxRating = 5,
  selectedStatus = null,
  period = 'year',
  startYear = new Date().getFullYear(),
  endYear = new Date().getFullYear(),
  availableYears = [],
  onCityChange,
  onCategoryChange,
  onNeighborhoodChange,
  onMinRatingChange,
  onMaxRatingChange,
  onStatusChange,
  onPeriodChange,
  onYearRangeChange,
  onResetFilters,
  onBusinessSelect,
  comparisonBusinesses,
}) => {
  const dispatch = useAppDispatch();
  const isSidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed);
  const { myBusiness } = useMyBusiness();

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  return (
    <div className="layout">
      {showSidebar && (
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={handleToggleSidebar}
          businesses={businesses}
          selectedCity={selectedCity}
          selectedCategory={selectedCategory}
          selectedNeighborhood={selectedNeighborhood}
          minRating={minRating}
          maxRating={maxRating}
          selectedStatus={selectedStatus}
          period={period}
          startYear={startYear}
          endYear={endYear}
          availableYears={availableYears}
          onCityChange={onCityChange}
          onCategoryChange={onCategoryChange}
          onNeighborhoodChange={onNeighborhoodChange}
          onMinRatingChange={onMinRatingChange}
          onMaxRatingChange={onMaxRatingChange}
          onStatusChange={onStatusChange}
          onPeriodChange={onPeriodChange}
          onYearRangeChange={onYearRangeChange}
          onResetFilters={onResetFilters}
          onBusinessSelect={onBusinessSelect}
          comparisonBusinesses={comparisonBusinesses}
        />
      )}
      <MainContent
        title={title}
        subtitle={subtitle}
        myBusinessName={myBusiness?.name}
        isSidebarCollapsed={showSidebar ? isSidebarCollapsed : false}
      >
        {children}
      </MainContent>
    </div>
  );
};

export default Layout;
