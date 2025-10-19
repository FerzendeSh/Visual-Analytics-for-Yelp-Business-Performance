import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="header-logo">
          <h1>Restaurants Analytics</h1>
        </Link>
      </div>
    </header>
  );
};

export default Header;
