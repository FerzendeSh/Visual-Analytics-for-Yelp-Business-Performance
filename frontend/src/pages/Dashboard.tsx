import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <p>This is the dashboard page where you'll see business performance metrics.</p>
      <nav style={{ marginTop: '2rem' }}>
        <Link to="/">Back to Home</Link>
      </nav>
    </div>
  );
};

export default Dashboard;
