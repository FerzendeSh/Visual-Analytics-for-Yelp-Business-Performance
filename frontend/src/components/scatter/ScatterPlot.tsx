import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Business } from '../../api/types';
import './ScatterPlot.css';

// Custom scatter dot component to handle variable sizes and highlighting
const ScatterDot = (props: any) => {
  const { cx, cy, payload, selectedBusiness, getColor, getPointRadius } = props;

  if (!payload || !payload.business) {
    return null;
  }

  const business = payload.business;
  const radius = getPointRadius(business);
  const color = getColor(business);
  const isSelected = selectedBusiness && business.business_id === selectedBusiness.business_id;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={color}
      fillOpacity={isSelected ? 1 : 0.7}
      stroke={isSelected ? '#fff' : 'none'}
      strokeWidth={isSelected ? 2 : 0}
      style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
    />
  );
};

interface ScatterPlotProps {
  businesses: Business[];
  selectedCity?: string;
  selectedCategory?: string;
  selectedRating?: number | null;
  selectedStatus?: number | null;
  selectedBusiness?: Business | null;
  onBusinessSelect?: (business: Business) => void;
}

/**
 * ScatterPlot component that displays photo frequency (X-axis) vs average rating (Y-axis)
 * Each dot represents one business
 */
const ScatterPlot: React.FC<ScatterPlotProps> = ({
  businesses,
  selectedCity = '',
  selectedCategory = '',
  selectedRating = null,
  selectedStatus = null,
  selectedBusiness = null,
  onBusinessSelect,
}) => {
  // Filter businesses based on the same criteria as the map
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((b) => {
      const cityMatch = selectedCity ? b.city === selectedCity : true;
      const categoryMatch = selectedCategory
        ? b.categories?.toLowerCase().includes(selectedCategory.toLowerCase())
        : true;
      const ratingMatch = selectedRating ? b.stars === selectedRating : true;
      const statusMatch = selectedStatus !== null ? b.is_open === selectedStatus : true;

      return cityMatch && categoryMatch && ratingMatch && statusMatch;
    });
  }, [businesses, selectedCity, selectedCategory, selectedRating, selectedStatus]);

  // Prepare data for scatter chart
  const chartData = useMemo(() => {
    return filteredBusinesses
      .filter(
        (b) =>
          b.stars !== undefined &&
          b.photo_count !== undefined &&
          !isNaN(b.stars) &&
          !isNaN(b.photo_count)
      )
      .map((b) => ({
        x: b.photo_count || 0,
        y: parseFloat(b.stars.toFixed(2)),
        business: b,
        name: b.name,
      }));
  }, [filteredBusinesses]);

  // Determine color based on business status and selection
  const getColor = (business: Business) => {
    const baseColor = business.is_open === 1 ? '#10b981' : '#ef4444'; // Green for open, red for closed
    // If this is the selected business, make it brighter and more opaque
    if (selectedBusiness && business.business_id === selectedBusiness.business_id) {
      return baseColor; // Use base color but render with larger size in Cell
    }
    return baseColor;
  };

  // Determine point radius based on selection
  const getPointRadius = (business: Business) => {
    if (selectedBusiness && business.business_id === selectedBusiness.business_id) {
      return 10; // Larger radius for selected business
    }
    return 6; // Default radius
  };

  // Custom tooltip to show business details
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      payload: {
        business: Business;
        name: string;
        x: number;
        y: number;
      };
    }>;
  }) => {
    if (active && payload && payload.length) {
      const { business, name, x, y } = payload[0].payload;
      return (
        <div className="scatter-tooltip">
          <p className="tooltip-name">{name}</p>
          <p className="tooltip-city">{business.city}, {business.state}</p>
          <p className="tooltip-metric">
            Rating: <span className="metric-value">{y}★</span>
          </p>
          <p className="tooltip-metric">
            Photos: <span className="metric-value">{x}</span>
          </p>
          <p className="tooltip-metric">
            Reviews: <span className="metric-value">{business.review_count}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const hasData = chartData.length > 0;

  return (
    <div className="scatter-plot-container">
      <div className="scatter-header">
        <h3>Business Photo Frequency vs Ratings</h3>
        <p className="scatter-description">
          Each dot represents one business: X-axis shows number of photos uploaded, Y-axis shows
          average rating (1-5 stars)
        </p>
        <div className="scatter-stats">
          <span className="stat-item">
            <span className="stat-dot" style={{ backgroundColor: '#10b981' }}></span>
            Open Businesses: {chartData.filter((d) => d.business.is_open === 1).length}
          </span>
          <span className="stat-item">
            <span className="stat-dot" style={{ backgroundColor: '#ef4444' }}></span>
            Closed Businesses: {chartData.filter((d) => d.business.is_open === 0).length}
          </span>
        </div>
      </div>

      {hasData ? (
        <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
              data={chartData}
            >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(134, 131, 131, 0.2)" />
            <XAxis
              type="number"
              dataKey="x"
              label={{
                value: 'Number of Photos',
                position: 'insideBottomRight',
                offset: -10,
                fill: 'rgba(255, 255, 255, 0.9)',
                fontSize: 12,
                fontWeight: 600,
              }}
              tick={{ fill: 'rgba(255, 255, 255, 0.9)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              label={{
                value: 'Average Rating (Stars)',
                angle: -90,
                position: 'insideLeft',
                fill: 'rgba(255, 255, 255, 0.9)',
                fontSize: 12,
                fontWeight: 600,
              }}
              domain={[0, 5]}
              ticks={[0, 1, 2, 3, 4, 5]}
              tick={{ fill: 'rgba(255, 255, 255, 0.9)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter
              name="Businesses"
              data={chartData}
              fill="rgba(59, 130, 246, 0.6)"
              onClick={(data: any) => {
                if (onBusinessSelect && data.business) {
                  onBusinessSelect(data.business);
                }
              }}
              shape={<ScatterDot selectedBusiness={selectedBusiness} getColor={getColor} getPointRadius={getPointRadius} />}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.business)} />
              ))}
            </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="scatter-empty-state">
          <p>No businesses match the current filters</p>
        </div>
      )}
    </div>
  );
};

export default ScatterPlot;
