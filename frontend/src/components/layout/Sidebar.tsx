import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, onToggle }) => {
  const location = useLocation();

  const menuItems = [
    {
      path: '/',
      label: 'Home',
      icon: '🏠'
    },
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: '📊'
    },
    {
      path: '/analytics',
      label: 'Analytics',
      icon: '📈'
    }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '→' : '←'}
      </button>

      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
                title={isCollapsed ? item.label : ''}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="sidebar-info">
            <p className="sidebar-version">v1.0.0</p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
