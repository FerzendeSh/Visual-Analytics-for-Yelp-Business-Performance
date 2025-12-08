import React, { ReactNode } from 'react';
import './MainContent.css';

interface MainContentProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  myBusinessName?: string;
  isSidebarCollapsed?: boolean;
  metricsCards?: ReactNode;
  headerActions?: ReactNode;
}

const MainContent: React.FC<MainContentProps> = ({
  children,
  title,
  subtitle,
  myBusinessName,
  isSidebarCollapsed = false,
  metricsCards,
  headerActions
}) => {
  return (
    <main className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {(title || subtitle || myBusinessName) && (
        <div className="main-header">
          <div className="main-header__content">
            <div className="main-header__text">
              {title && <h2 className="main-title">{title}</h2>}
              {myBusinessName && (
                <p className="main-business-subtitle">
                  My Business: <span className="main-business-name">{myBusinessName}</span>
                </p>
              )}
              {subtitle && <p className="main-subtitle">{subtitle}</p>}
            </div>
            {headerActions && <div className="main-header__actions">{headerActions}</div>}
          </div>
        </div>
      )}
      {metricsCards && <div className="main-metrics">{metricsCards}</div>}
      <div className="main-body">
        {children}
      </div>
    </main>
  );
};

export default MainContent;
