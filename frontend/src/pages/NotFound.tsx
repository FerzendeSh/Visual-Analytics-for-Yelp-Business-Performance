import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <nav style={{ marginTop: '2rem' }}>
        <Link to="/">Go back to Home</Link>
      </nav>
    </div>
  );
};

export default NotFound;
