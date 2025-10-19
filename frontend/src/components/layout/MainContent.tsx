import React, { ReactNode } from 'react';
import './MainContent.css';

interface MainContentProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  isSidebarCollapsed?: boolean;
}

const MainContent: React.FC<MainContentProps> = ({
  children,
  title,
  subtitle,
  isSidebarCollapsed = false
}) => {
  return (
    <main className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {(title || subtitle) && (
        <div className="main-header">
          {title && <h2 className="main-title">{title}</h2>}
          {subtitle && <p className="main-subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="main-body">
        {children}
      </div>
    </main>
  );
};

export default MainContent;
