import React from 'react';
import { Layout } from '../components/layout';

const Dashboard: React.FC = () => {
  return (
    <Layout
      title="Dashboard"
      subtitle="Business performance metrics and key insights"
      showSidebar={true}
    >
      <div style={{ padding: '1rem' }}>
        <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
          This is the dashboard page where you'll see business performance metrics.
        </p>
        {/* Dashboard content will be added here */}
      </div>
    </Layout>
  );
};

export default Dashboard;
