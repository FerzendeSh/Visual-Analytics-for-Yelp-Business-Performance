import React from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout';

const Home: React.FC = () => {
  return (
    <Layout
      title="Yelp Business Analytics Dashboard"
      subtitle="Welcome to your Visual Analytics application!"
      showSidebar={true}
    >
      <div style={{ padding: '1rem' }}>
        <nav style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Quick Navigation</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '1rem' }}>
              <Link
                to="/dashboard"
                style={{
                  fontSize: '1.1rem',
                  color: '#667eea',
                  textDecoration: 'none',
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  backgroundColor: 'rgba(102, 126, 234, 0.2)',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
              >
                Go to Dashboard →
              </Link>
            </li>
            <li>
              <Link
                to="/analytics"
                style={{
                  fontSize: '1.1rem',
                  color: '#667eea',
                  textDecoration: 'none',
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  backgroundColor: 'rgba(102, 126, 234, 0.2)',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
              >
                View Analytics →
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </Layout>
  );
};

export default Home;
