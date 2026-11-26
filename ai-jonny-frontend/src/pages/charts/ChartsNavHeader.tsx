import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart2,
  PlusCircle,
  Sparkles,
  LayoutTemplate,
  FolderOpen
} from 'lucide-react';

interface ChartsNavHeaderProps {
  activeTab?: 'overview' | 'editor' | 'ai-generator' | 'templates' | 'my-charts';
  actionButton?: React.ReactNode;
}

export const ChartsNavHeader: React.FC<ChartsNavHeaderProps> = ({
  actionButton
}) => {
  return (
    <div className="charts-header-card">
      <div className="charts-title-row">
        <div>
          <div className="charts-title-badge">
            <BarChart2 size={13} />
            <span>EgoLytics BFOV Engine</span>
          </div>
          <h1 className="charts-main-title">EgoLytics BFOV Charts</h1>
          <p className="charts-subtitle">
            Interactive system architecture, decision flows, and analytical data diagrams powered by React Flow &amp; AI.
          </p>
        </div>
        {actionButton && <div>{actionButton}</div>}
      </div>

      <nav className="charts-nav-tabs" aria-label="EgoLytics Charts Navigation">
        <NavLink
          to="/user/charts"
          end
          className={({ isActive }) => `charts-nav-tab ${isActive ? 'active' : ''}`}
        >
          <BarChart2 size={15} />
          <span>Module Overview</span>
        </NavLink>

        <NavLink
          to="/user/charts/editor"
          className={({ isActive }) => `charts-nav-tab ${isActive ? 'active' : ''}`}
        >
          <PlusCircle size={15} />
          <span>Create New Diagram</span>
        </NavLink>

        <NavLink
          to="/user/charts/ai-generator"
          className={({ isActive }) => `charts-nav-tab ${isActive ? 'active' : ''}`}
        >
          <Sparkles size={15} />
          <span>Generate with AI</span>
        </NavLink>

        <NavLink
          to="/user/charts/templates"
          className={({ isActive }) => `charts-nav-tab ${isActive ? 'active' : ''}`}
        >
          <LayoutTemplate size={15} />
          <span>Templates</span>
        </NavLink>

        <NavLink
          to="/user/charts/my-charts"
          className={({ isActive }) => `charts-nav-tab ${isActive ? 'active' : ''}`}
        >
          <FolderOpen size={15} />
          <span>My Charts</span>
        </NavLink>
      </nav>
    </div>
  );
};
