import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Yelp Business Analytics Dashboard</h1>
      <p>Welcome to your Visual Analytics application!</p>
      <nav style={{ marginTop: '2rem' }}>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '1rem' }}>
            <Link to="/dashboard" style={{ fontSize: '1.2rem' }}>Go to Dashboard</Link>
          </li>
          <li>
            <Link to="/analytics" style={{ fontSize: '1.2rem' }}>View Analytics</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Home;
