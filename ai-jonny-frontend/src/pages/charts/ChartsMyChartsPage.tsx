import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Search,
  PlusCircle,
  ExternalLink,
  Trash2,
  Workflow,
  Calendar,
  Tag,
  LayoutTemplate,
  Copy,
  Edit2,
  AlertTriangle
} from 'lucide-react';
import { ChartsNavHeader } from './ChartsNavHeader';
import { storageService } from '../../services/storageService';
import { apiClient } from '../../services/apiClient';
import { SavedLibraryItem } from '../../types';
import { useApp } from '../../context/AppContext';
import './ChartsPage.css';

export const ChartsMyChartsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast, user } = useApp();

  const [charts, setCharts] = useState<SavedLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModuleDisabled, setIsModuleDisabled] = useState(false);

  // Hydrate user's charts from real MySQL backend library and check module status
  const fetchCharts = async () => {
    setIsLoading(true);
    try {
      const [items, statusRes] = await Promise.all([
        storageService.listAssets('CHART'),
        apiClient.getChartsStatus().catch(() => null)
      ]);
      setCharts(items || []);
      if (statusRes?.success && typeof statusRes.enabled === 'boolean') {
        if (!statusRes.enabled && user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
          setIsModuleDisabled(true);
        }
      }
    } catch (err) {
      console.warn('Charts hydration notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCharts();
  }, [user]);

  const handleDelete = async (id: string, title: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete chart "${title}"?`)) return;

    try {
      await storageService.deleteAsset(id);
      setCharts((prev) => prev.filter((c) => c.id !== id));
      showToast(`Removed "${title}"`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      showToast(msg, 'error');
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const cloned = await storageService.duplicateChartAsset(id);
      setCharts((prev) => [cloned, ...prev]);
      showToast(`Duplicated diagram as "${cloned.title}"`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Duplicate failed';
      showToast(msg, 'error');
    }
  };

  const handleRename = async (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newTitle = window.prompt('Enter new diagram title:', currentTitle);
    if (!newTitle || !newTitle.trim() || newTitle.trim() === currentTitle) return;

    try {
      await storageService.renameChartAsset(id, newTitle.trim());
      setCharts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim() } : c))
      );
      showToast(`Renamed to "${newTitle.trim()}"`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rename failed';
      showToast(msg, 'error');
    }
  };

  const filteredCharts = charts.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.previewText && c.previewText.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="charts-module-container">
      <ChartsNavHeader
        activeTab="my-charts"
        actionButton={
          <NavLink
            to="/user/charts/editor"
            className="btn btn-primary btn-sm"
            style={{ padding: '8px 16px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <PlusCircle size={15} />
            <span>Create New Diagram</span>
          </NavLink>
        }
      />

      {/* Module Availability Warning Banner */}
      {isModuleDisabled && (
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
            EgoLytics BFOV Charts is currently disabled for maintenance by platform administrators. Diagram editing and saving are restricted.
          </span>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={15} color="#8C97B0" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved diagrams..."
            style={{ width: '100%', paddingLeft: '32px', fontSize: '13px' }}
          />
        </div>

        <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>
          {filteredCharts.length} diagram{filteredCharts.length === 1 ? '' : 's'} stored in database
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
          Loading saved charts from database...
        </div>
      ) : filteredCharts.length > 0 ? (
        <div className="charts-templates-grid">
          {filteredCharts.map((item) => (
            <div
              key={item.id}
              className="chart-template-card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/user/charts/editor?chartId=${item.id}`)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span className="template-badge" style={{ background: '#F4F1FD', color: '#6E56CF' }}>
                    EgoLytics Chart
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 6px', color: '#475569' }}
                      onClick={(e) => handleRename(item.id, item.title, e)}
                      title="Rename diagram"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 6px', color: '#475569' }}
                      onClick={(e) => handleDuplicate(item.id, e)}
                      title="Duplicate diagram"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 6px', color: '#EF4444' }}
                      onClick={(e) => handleDelete(item.id, item.title, e)}
                      title="Delete diagram"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111625', margin: '0 0 6px' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '12.5px', color: '#5F6B85', margin: '0 0 16px', lineHeight: '1.4' }}>
                  {item.previewText || 'Saved EgoLytics flowchart specification.'}
                </p>

                {item.tags && item.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {item.tags.map((t) => (
                      <span
                        key={t}
                        style={{ fontSize: '11px', background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F4F9', paddingTop: '12px', fontSize: '12px', color: '#8C97B0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={13} />
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
                <span style={{ color: '#6E56CF', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span>Open</span>
                  <ExternalLink size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Real, professional empty state without fake records */
        <div className="charts-empty-state">
          <div className="charts-empty-icon">
            <FolderOpen size={28} />
          </div>
          <h3 className="charts-empty-title">
            {search ? 'No Matching Diagrams Found' : 'No Saved Charts in Your Library'}
          </h3>
          <p className="charts-empty-desc">
            {search
              ? `No diagrams matched "${search}". Clear the search query to view all items.`
              : 'You have not saved any EgoLytics diagrams yet. Create a new diagram from scratch or launch one from the starter templates.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <NavLink to="/user/charts/editor" className="btn btn-primary btn-sm" style={{ borderRadius: '8px', padding: '8px 16px' }}>
              <PlusCircle size={14} />
              <span>Create New Diagram</span>
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
