import React from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout';

const NotFound: React.FC = () => {
  return (
    <Layout
      title="404 - Page Not Found"
      subtitle="The page you're looking for doesn't exist"
      showSidebar={true}
    >
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <Link
          to="/"
          style={{
            fontSize: '1.1rem',
            color: '#667eea',
            textDecoration: 'none',
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'rgba(102, 126, 234, 0.3)',
            borderRadius: '4px',
            marginTop: '2rem',
            transition: 'all 0.2s'
          }}
        >
          Go back to Home
        </Link>
      </div>
    </Layout>
  );
};

export default NotFound;
