import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="header-logo">
          <h1>Yelp Analytics</h1>
        </Link>
        <nav className="header-nav">
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/analytics" className="nav-link">Analytics</Link>
        </nav>
        <div className="header-actions">
          <button className="header-button">Settings</button>
          <button className="header-button">Profile</button>
        </div>
      </div>
    </header>
  );
};

export default Header;
