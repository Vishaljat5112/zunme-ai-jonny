import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutTemplate,
  Search,
  ArrowRight,
  Filter,
  Layers,
  Workflow,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { ChartsNavHeader } from './ChartsNavHeader';
import { STARTER_TEMPLATES } from './sampleTemplates';
import { apiClient } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import './ChartsPage.css';

export const ChartsTemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isModuleDisabled, setIsModuleDisabled] = useState(false);

  useEffect(() => {
    apiClient.getChartsStatus()
      .then((res) => {
        if (res.success && typeof res.enabled === 'boolean') {
          if (!res.enabled && user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
            setIsModuleDisabled(true);
          }
        }
      })
      .catch(() => {});
  }, [user]);

  const categories = ['ALL', 'ORGANIZATION', 'FLOWCHART', 'MINDMAP', 'BUSINESS', 'ARCHITECTURE', 'SEQUENCE', 'DATA_PIPELINE'];

  const filteredTemplates = STARTER_TEMPLATES.filter((tpl) => {
    const matchCat = selectedCategory === 'ALL' || tpl.category === selectedCategory;
    const matchSearch =
      tpl.title.toLowerCase().includes(search.toLowerCase()) ||
      tpl.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="charts-module-container">
      <ChartsNavHeader activeTab="templates" />

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
            EgoLytics BFOV Charts is currently disabled for maintenance by platform administrators. Template editing and saving are restricted.
          </span>
        </div>
      )}

      {/* Toolbar: Search and Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid #E2E8F0',
                background: selectedCategory === cat ? '#6E56CF' : '#FFFFFF',
                color: selectedCategory === cat ? '#FFFFFF' : '#4B5563',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {cat === 'ALL' ? 'All Templates' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={15} color="#8C97B0" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            style={{ width: '100%', paddingLeft: '32px', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Templates Grid */}
      <div className="charts-templates-grid">
        {filteredTemplates.map((tpl) => (
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
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111625', margin: '0 0 8px' }}>
                {tpl.title}
              </h3>
              <p style={{ fontSize: '13px', color: '#5F6B85', margin: '0 0 20px', lineHeight: '1.5' }}>
                {tpl.description}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ width: '100%', justifyContent: 'center', borderRadius: '10px', padding: '8px' }}
              onClick={() => navigate(`/user/charts/editor?template=${tpl.id}`)}
            >
              <span>Load into Editor</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
