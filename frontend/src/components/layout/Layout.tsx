import React, { useState, ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showSidebar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  subtitle,
  showSidebar = true
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="layout">
      <Header />
      {showSidebar && (
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={handleToggleSidebar}
        />
      )}
      <MainContent
        title={title}
        subtitle={subtitle}
        isSidebarCollapsed={showSidebar ? isSidebarCollapsed : false}
      >
        {children}
      </MainContent>
    </div>
  );
};

export default Layout;
