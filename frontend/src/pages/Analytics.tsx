import React from 'react';
import { Link } from 'react-router-dom';

const Analytics: React.FC = () => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Analytics</h1>
      <p>This is the analytics page where you'll see detailed visual analytics.</p>
      <nav style={{ marginTop: '2rem' }}>
        <Link to="/">Back to Home</Link>
      </nav>
    </div>
  );
};

export default Analytics;
