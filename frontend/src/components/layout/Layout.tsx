import React, { ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleSidebar } from '../../store/slices/uiSlice';
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
  const dispatch = useAppDispatch();
  const isSidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
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
