import React, { ReactNode } from 'react';
import './MainContent.css';

interface MainContentProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  myBusinessName?: string;
  isSidebarCollapsed?: boolean;
}

const MainContent: React.FC<MainContentProps> = ({
  children,
  title,
  subtitle,
  myBusinessName,
  isSidebarCollapsed = false
}) => {
  return (
    <main className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {(title || subtitle || myBusinessName) && (
        <div className="main-header">
          {title && <h2 className="main-title">{title}</h2>}
          {myBusinessName && (
            <p className="main-business-subtitle">
              My Business: <span className="main-business-name">{myBusinessName}</span>
            </p>
          )}
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
