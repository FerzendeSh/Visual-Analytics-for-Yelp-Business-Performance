import React from 'react';
import { Layout } from '../components/layout';

const Analytics: React.FC = () => {
  return (
    <Layout
      title="Analytics"
      subtitle="Detailed visual analytics and data insights"
      showSidebar={true}
    >
      <div style={{ padding: '1rem' }}>
        <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
          This is the analytics page where you'll see detailed visual analytics.
        </p>
        {/* Analytics content will be added here */}
      </div>
    </Layout>
  );
};

export default Analytics;
