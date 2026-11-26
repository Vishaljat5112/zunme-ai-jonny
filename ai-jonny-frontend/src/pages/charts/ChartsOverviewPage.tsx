import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Sparkles,
  LayoutTemplate,
  FolderOpen,
  ArrowRight,
  Clock,
  ExternalLink,
  Layers,
  ChevronRight,
  Workflow,
  AlertTriangle
} from 'lucide-react';
import { ChartsNavHeader } from './ChartsNavHeader';
import { STARTER_TEMPLATES } from './sampleTemplates';
import { storageService } from '../../services/storageService';
import { apiClient } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import { SavedLibraryItem } from '../../types';
import './ChartsPage.css';

export const ChartsOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useApp();
  const [recentCharts, setRecentCharts] = useState<SavedLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModuleEnabled, setIsModuleEnabled] = useState(true);

  // Fetch real user saved charts from MySQL library backend and check module availability
  useEffect(() => {
    let isMounted = true;
    async function loadRecent() {
      try {
        const [items, statusRes] = await Promise.all([
          storageService.listAssets('CHART'),
          apiClient.getChartsStatus().catch(() => null)
        ]);
        if (isMounted) {
          setRecentCharts(items || []);
          if (statusRes?.success && typeof statusRes.enabled === 'boolean') {
            setIsModuleEnabled(statusRes.enabled);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Charts hydration notice:', err);
        if (isMounted) setIsLoading(false);
      }
    }
    loadRecent();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="charts-module-container">
      {/* Module Navigation Header */}
      <ChartsNavHeader
        activeTab="overview"
        actionButton={
          <NavLink
            to="/user/charts/editor"
            className="btn btn-primary btn-sm"
            style={{ padding: '8px 18px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <PlusCircle size={15} />
            <span>New Diagram</span>
          </NavLink>
        }
      />

      {/* Module Availability Warning Banner */}
      {!isModuleEnabled && user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN' && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '10px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#991B1B'
          }}
        >
          <AlertTriangle size={18} color="#DC2626" />
          <span style={{ fontSize: '13px', fontWeight: '600' }}>
            EgoLytics BFOV Charts is currently disabled for maintenance by platform administrators. New diagram creation and saving are restricted.
          </span>
        </div>
      )}

      {/* 1. Main Action Grid: The 4 Core Capabilities */}
      <div className="charts-action-grid">
        {/* Create New Diagram */}
        <NavLink to="/user/charts/editor" className="chart-action-card highlight">
          <div>
            <div className="chart-action-icon" style={{ background: '#F4F1FD', color: '#6E56CF' }}>
              <PlusCircle size={22} />
            </div>
            <h2 className="chart-action-title">Create New Diagram</h2>
            <p className="chart-action-desc">
              Open a fresh canvas with draggable process nodes, decision forks, and automatic dagre layout.
            </p>
          </div>
          <div className="chart-action-footer">
            <span>Launch Canvas</span>
            <ArrowRight size={15} />
          </div>
        </NavLink>

        {/* Generate with AI */}
        <NavLink to="/user/charts/ai-generator" className="chart-action-card">
          <div>
            <div className="chart-action-icon" style={{ background: '#E0F2FE', color: '#0284C7' }}>
              <Sparkles size={22} />
            </div>
            <h2 className="chart-action-title">Generate with AI</h2>
            <p className="chart-action-desc">
              Convert plain-text descriptions, code architectures, or tabular CSV into auto-arranged diagrams.
            </p>
          </div>
          <div className="chart-action-footer" style={{ color: '#0284C7' }}>
            <span>AI Synthesizer</span>
            <ArrowRight size={15} />
          </div>
        </NavLink>

        {/* Templates */}
        <NavLink to="/user/charts/templates" className="chart-action-card">
          <div>
            <div className="chart-action-icon" style={{ background: '#E8F8F0', color: '#059669' }}>
              <LayoutTemplate size={22} />
            </div>
            <h2 className="chart-action-title">Browse Templates</h2>
            <p className="chart-action-desc">
              Explore 4+ pre-configured blueprints for microservices, OAuth auth flows, and ETL pipelines.
            </p>
          </div>
          <div className="chart-action-footer" style={{ color: '#059669' }}>
            <span>View Templates</span>
            <ArrowRight size={15} />
          </div>
        </NavLink>

        {/* My Charts */}
        <NavLink to="/user/charts/my-charts" className="chart-action-card">
          <div>
            <div className="chart-action-icon" style={{ background: '#FEF3E2', color: '#D97706' }}>
              <FolderOpen size={22} />
            </div>
            <h2 className="chart-action-title">My Charts</h2>
            <p className="chart-action-desc">
              Manage saved diagrams, review version histories, export PNG/SVG, and sync with your library.
            </p>
          </div>
          <div className="chart-action-footer" style={{ color: '#D97706' }}>
            <span>View Saved ({recentCharts.length})</span>
            <ArrowRight size={15} />
          </div>
        </NavLink>
      </div>

      {/* 2. Featured Templates Section */}
      <div className="charts-section-header">
        <div>
          <h2 className="charts-section-title">Starter Blueprint Templates</h2>
          <span style={{ fontSize: '13px', color: '#5F6B85' }}>
            Production-tested topologies ready to customize in 1 click
          </span>
        </div>
        <NavLink to="/user/charts/templates" className="charts-section-link">
          <span>All Templates</span>
          <ChevronRight size={14} />
        </NavLink>
      </div>

      <div className="charts-templates-grid">
        {STARTER_TEMPLATES.slice(0, 3).map((tpl) => (
          <div key={tpl.id} className="chart-template-card">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="template-badge" style={{ background: '#F4F1FD', color: '#6E56CF' }}>
                  {tpl.category}
                </span>
                <span style={{ fontSize: '11px', color: '#8C97B0', fontWeight: '600' }}>
                  {tpl.nodeCount} nodes • {tpl.complexity}
                </span>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111625', margin: '0 0 6px' }}>
                {tpl.title}
              </h3>
              <p style={{ fontSize: '12.5px', color: '#5F6B85', margin: '0 0 16px', lineHeight: '1.45' }}>
                {tpl.description}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ width: '100%', justifyContent: 'center', borderRadius: '8px' }}
              onClick={() => navigate(`/user/charts/editor?template=${tpl.id}`)}
            >
              <span>Use Blueprint</span>
              <ArrowRight size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* 3. Recent Charts Section */}
      <div className="charts-section-header">
        <div>
          <h2 className="charts-section-title">Recent Diagrams</h2>
          <span style={{ fontSize: '13px', color: '#5F6B85' }}>
            Your recent work backed by local MySQL database persistence
          </span>
        </div>
        <NavLink to="/user/charts/my-charts" className="charts-section-link">
          <span>Open Library</span>
          <ChevronRight size={14} />
        </NavLink>
      </div>

      {isLoading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
          Loading saved diagrams...
        </div>
      ) : recentCharts.length > 0 ? (
        <div className="charts-list-panel">
          {recentCharts.slice(0, 5).map((item) => (
            <NavLink
              key={item.id}
              to={`/user/charts/editor?chartId=${item.id}`}
              className="chart-row-item"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#F4F1FD', color: '#6E56CF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Workflow size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#111625' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#5F6B85' }}>
                    {item.previewText || 'EgoLytics Chart Specification'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '12px', color: '#8C97B0' }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
                <ExternalLink size={14} color="#8C97B0" />
              </div>
            </NavLink>
          ))}
        </div>
      ) : (
        /* Real, professional empty state without fake records */
        <div className="charts-empty-state">
          <div className="charts-empty-icon">
            <Workflow size={28} />
          </div>
          <h3 className="charts-empty-title">No Saved Diagrams Yet</h3>
          <p className="charts-empty-desc">
            You haven't created or saved any EgoLytics diagrams to your library. Start from a fresh canvas, choose a template, or generate one with AI.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <NavLink to="/user/charts/editor" className="btn btn-primary btn-sm" style={{ borderRadius: '8px', padding: '8px 16px' }}>
              <PlusCircle size={14} />
              <span>Create First Diagram</span>
            </NavLink>
            <NavLink to="/user/charts/templates" className="btn btn-outline btn-sm" style={{ borderRadius: '8px', padding: '8px 16px' }}>
              <LayoutTemplate size={14} />
              <span>Explore Templates</span>
            </NavLink>
          </div>
        </div>
      )}
    </div>
  );
};
