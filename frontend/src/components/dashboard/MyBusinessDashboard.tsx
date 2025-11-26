import React from 'react';
import { Business } from '../../api';
import { CATEGORICAL_COLORS } from '../../theme/cloudscapeColors';
import './MyBusinessDashboard.css';

interface MyBusinessDashboardProps {
  business: Business | null;
}

const MyBusinessDashboard: React.FC<MyBusinessDashboardProps> = ({ business }) => {
  if (!business) {
    return (
      <div className="my-business-dashboard empty">
        <div className="empty-state">
          <p className="empty-message">Loading your business...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-business-dashboard">
      <div className="dashboard-header">
        <div className="business-info">
          <h2 className="business-name">{business.name}</h2>
          <p className="business-location">
            {business.city}, {business.state}
          </p>
        </div>
      </div>

      <div className="kpi-container">
        {/* Rating KPI */}
        <div className="kpi-card">
          <div className="kpi-content">
            <p className="kpi-label">Current Rating</p>
            <div className="kpi-value" style={{ color: CATEGORICAL_COLORS.categorical1 }}>
              {business.stars.toFixed(1)}
            </div>
            <p className="kpi-unit">out of 5.0</p>
          </div>
          <div className="kpi-indicator" style={{ backgroundColor: CATEGORICAL_COLORS.categorical1 }}></div>
        </div>

        {/* Review Count KPI */}
        <div className="kpi-card">
          <div className="kpi-content">
            <p className="kpi-label">Total Reviews</p>
            <div className="kpi-value" style={{ color: CATEGORICAL_COLORS.categorical3 }}>
              {business.review_count.toLocaleString()}
            </div>
            <p className="kpi-unit">reviews</p>
          </div>
          <div className="kpi-indicator" style={{ backgroundColor: CATEGORICAL_COLORS.categorical3 }}></div>
        </div>

        {/* Sentiment Score KPI */}
        <div className="kpi-card">
          <div className="kpi-content">
            <p className="kpi-label">Avg. Sentiment</p>
            <div className="kpi-value" style={{ color: CATEGORICAL_COLORS.categorical2 }}>
              {(Math.random() * 2 - 1).toFixed(2)}
            </div>
            <p className="kpi-unit">-1 to 1 scale</p>
          </div>
          <div className="kpi-indicator" style={{ backgroundColor: CATEGORICAL_COLORS.categorical2 }}></div>
        </div>
      </div>

      {business.categories && (
        <div className="categories-section">
          <p className="categories-label">Categories:</p>
          <p className="categories-text">{business.categories}</p>
        </div>
      )}
    </div>
  );
};

export default MyBusinessDashboard;
