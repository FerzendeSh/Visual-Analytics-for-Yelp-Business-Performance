import { memo } from 'react';
import { ComparisonLayout } from './ComparisonLayout';

const ComparisonModeComponent = () => {
  return <ComparisonLayout />;
};

// Memoized export
export const ComparisonMode = memo(ComparisonModeComponent);
