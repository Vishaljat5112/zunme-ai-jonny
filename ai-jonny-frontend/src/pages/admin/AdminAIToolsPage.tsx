import React, { useState, useEffect, useCallback } from 'react';
import {
  Wand2,
  Search,
  Filter,
  CheckCircle2,
  Sliders,
  FileText,
  Share2,
  Briefcase,
  SearchCheck,
  Palette,
  Eye,
  ShieldCheck,
  Workflow,
  BarChart2,
  Power,
  Users2,
  Clock,
  Sparkles,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../services/apiClient';
import '../../styles/dashboard.css';

interface ToolCatalogItem {
  id: string;
  name: string;
  category: 'Writing' | 'Social' | 'Business' | 'SEO' | 'Creative';
  format: string;
  runsCount: number;
  status: 'ACTIVE' | 'EXPERIMENTAL' | 'REVIEW';
  description: string;
}

const DEFAULT_TOOLS: ToolCatalogItem[] = [
  {
    id: 'tool_1',
    name: 'Long-Form Blog Outline Generator',
    category: 'Writing',
    format: 'BLOG_OUTLINE',
    runsCount: 14200,
    status: 'ACTIVE',
    description: 'Generates structured 4-phase article outlines with hooks, subheadings, and key takeaways.'
  },
  {
    id: 'tool_2',
    name: 'High-Converting Email Newsletter',
    category: 'Marketing' as any,
    format: 'EMAIL_NEWSLETTER',
    runsCount: 18900,
    status: 'ACTIVE',
    description: 'Drafts persuasive product announcement and editorial emails with subject line options.'
  },
  {
    id: 'tool_3',
    name: 'Viral Social Media Caption & Hooks',
    category: 'Social',
    format: 'SOCIAL_CAPTION',
    runsCount: 24500,
    status: 'ACTIVE',
    description: 'Produces engagement-optimized captions with hashtag recommendations and call to action.'
  },
  {
    id: 'tool_4',
    name: 'B2B Product Ad Copy Matrix',
    category: 'Business',
    format: 'PRODUCT_AD',
    runsCount: 9200,
    status: 'ACTIVE',
    description: 'Generates multi-variant headlines and primary copy for paid social & search ads.'
  },
  {
    id: 'tool_5',
    name: 'YouTube Retention Video Script',
    category: 'Creative',
    format: 'VIDEO_SCRIPT',
    runsCount: 11400,
    status: 'ACTIVE',
    description: 'Hooks, narrative arcs, visual cue suggestions, and mid-roll transitions.'
  },
  {
    id: 'tool_6',
    name: 'SEO Semantic Content Brief & FAQ',
    category: 'SEO',
    format: 'ARTICLE_SECTION',
    runsCount: 8400,
    status: 'ACTIVE',
    description: 'Synthesizes topical authority keyword sections and people-also-ask responses.'
  }
];

export const AdminAIToolsPage: React.FC = () => {
  const { showToast } = useApp();
  const [tools, setTools] = useState<ToolCatalogItem[]>(DEFAULT_TOOLS);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // EgoLytics BFOV Charts Admin State
  const [chartsStats, setChartsStats] = useState<{
    totalCharts: number;
    uniqueCreators: number;
    lastCreatedAt: string | null;
    modeBreakdown: Record<string, number>;
    recentCharts: Array<{
      id: string;
      userId: string;
      title: string;
      diagramMode?: string;
      nodeCount?: number;
      edgeCount?: number;
      createdAt: string;
    }>;
  } | null>(null);
  const [chartsEnabled, setChartsEnabled] = useState<boolean>(true);
  const [isLoadingChartsAdmin, setIsLoadingChartsAdmin] = useState<boolean>(false);
  const [isUpdatingChartsSetting, setIsUpdatingChartsSetting] = useState<boolean>(false);

  const fetchChartsAdminData = useCallback(async () => {
    setIsLoadingChartsAdmin(true);
    try {
      const [statsRes, settingsRes] = await Promise.all([
        apiClient.getChartsStats().catch(() => null),
        apiClient.getChartsSettings().catch(() => null)
      ]);
      if (statsRes?.success && statsRes.stats) {
        setChartsStats(statsRes.stats);
      }
      if (settingsRes?.success && settingsRes.settings) {
        setChartsEnabled(settingsRes.settings.chartsEnabled);
      }
    } catch (err) {
      console.warn('Failed to fetch charts admin telemetry:', err);
    } finally {
      setIsLoadingChartsAdmin(false);
    }
  }, []);

  useEffect(() => {
    fetchChartsAdminData();
  }, [fetchChartsAdminData]);

  const handleToggleChartsModule = async () => {
    setIsUpdatingChartsSetting(true);
    const nextVal = !chartsEnabled;
    try {
      const res = await apiClient.updateChartsSettings(nextVal);
      if (res.success) {
        setChartsEnabled(nextVal);
        showToast(res.message, 'success');
        fetchChartsAdminData();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update charts availability';
      showToast(msg, 'error');
    } finally {
      setIsUpdatingChartsSetting(false);
    }
  };

  const filteredTools = tools.filter((tool) => {
    const matchesCat = selectedCategory === 'ALL' || tool.category === selectedCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const toggleToolStatus = (id: string) => {
    setTools((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'ACTIVE' ? 'REVIEW' : 'ACTIVE';
          showToast(`Tool "${t.name}" status set to ${nextStatus}`, 'info');
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  return (
    <div className="dashboard-page-container">
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1>
            <Wand2 size={26} color="#A78BFA" />
            AI Tools & Content Workflows
          </h1>
          <p className="dashboard-subtitle">
            Catalog governance for Content Studio builders, template routing rules, prompt moderation pipelines, and usage analytics.
          </p>
        </div>

        <div className="dashboard-header-actions">
          <div className="badge badge-primary">
            {tools.length} Production Tools Active
          </div>
        </div>
      </div>

      {/* EgoLytics BFOV Charts Module Governance & Real Telemetry */}
      <div className="glass-panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)', borderLeft: '4px solid #6E56CF' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(110, 86, 207, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Workflow size={22} color="#6E56CF" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111625', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>EgoLytics BFOV Charts Module Governance</span>
                <span className={`badge ${chartsEnabled ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px' }}>
                  {chartsEnabled ? 'ONLINE' : 'DISABLED'}
                </span>
              </h2>
              <p style={{ fontSize: '13px', color: '#5F6B85', margin: 0 }}>
                Real-time MySQL database telemetry, cross-user persistence statistics, and global module availability controls.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={fetchChartsAdminData}
              disabled={isLoadingChartsAdmin}
              title="Refresh telemetry metrics from database"
              style={{ fontSize: '12px', gap: '6px' }}
            >
              <RefreshCw size={13} className={isLoadingChartsAdmin ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${chartsEnabled ? 'btn-primary' : 'btn-outline'}`}
              onClick={handleToggleChartsModule}
              disabled={isUpdatingChartsSetting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13px',
                background: chartsEnabled ? '#059669' : '#EF4444',
                borderColor: chartsEnabled ? '#059669' : '#EF4444',
                color: '#FFFFFF'
              }}
              title="Toggle global availability of EgoLytics BFOV Charts module"
            >
              <Power size={14} />
              <span>{isUpdatingChartsSetting ? 'Updating...' : chartsEnabled ? 'Disable Module' : 'Enable Module'}</span>
            </button>
          </div>
        </div>

        {/* Real DB Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '18px' }}>
          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>Total Charts Saved</span>
              <BarChart2 size={16} color="#6E56CF" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#111625' }}>
              {chartsStats?.totalCharts ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
              Persisted in MySQL library_items
            </div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>Unique Creators</span>
              <Users2 size={16} color="#0284C7" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#111625' }}>
              {chartsStats?.uniqueCreators ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
              Distinct active user accounts
            </div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>Module Status</span>
              <ShieldCheck size={16} color={chartsEnabled ? '#059669' : '#EF4444'} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: chartsEnabled ? '#059669' : '#EF4444', height: '32px', display: 'flex', alignItems: 'center' }}>
              {chartsEnabled ? 'ACTIVE & ONLINE' : 'RESTRICTED / DISABLED'}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
              {chartsEnabled ? 'Accessible to all platform users' : 'Restricted by admin controls'}
            </div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>Last Chart Created</span>
              <Clock size={16} color="#D97706" />
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#111625', height: '32px', display: 'flex', alignItems: 'center' }}>
              {chartsStats?.lastCreatedAt ? new Date(chartsStats.lastCreatedAt).toLocaleString() : 'No charts yet'}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
              Latest persistence timestamp
            </div>
          </div>
        </div>

        {/* Recent Charts Records */}
        {chartsStats?.recentCharts && chartsStats.recentCharts.length > 0 && (
          <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderOpen size={14} color="#6E56CF" />
              <span>Recent Diagrams Persisted in Database:</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {chartsStats.recentCharts.slice(0, 5).map((rc) => (
                <div
                  key={rc.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontWeight: '600', color: '#0F172A' }}>{rc.title}</span>
                  <span style={{ fontSize: '10px', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', color: '#6E56CF', fontWeight: '600' }}>
                    {rc.diagramMode || 'flowchart'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                    {rc.nodeCount || 0} nodes
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search */}
      <div className="glass-panel" style={{ padding: 'var(--space-4)' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div className="search-box-wrap">
            <Search size={16} />
            <input
              type="text"
              className="input-field"
              placeholder="Search content tools and generators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-pills-row">
            {['ALL', 'Writing', 'Social', 'Business', 'SEO', 'Creative'].map((cat) => (
              <button
                key={cat}
                className={`filter-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="cards-grid-3">
        {filteredTools.map((tool) => (
          <div key={tool.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                  {tool.category}
                </span>
                <span className={`status-chip ${tool.status === 'ACTIVE' ? 'success' : 'warning'}`}>
                  {tool.status}
                </span>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111625', marginBottom: '8px' }}>
                {tool.name}
              </h3>
              <p style={{ fontSize: '12px', color: '#5F6B85', lineHeight: '1.4', marginBottom: '16px' }}>
                {tool.description}
              </p>
            </div>

            <div style={{ borderTop: '1px solid #E8ECF5', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#5F6B85' }}>
                <strong style={{ color: '#111625' }}>{tool.runsCount.toLocaleString()}</strong> runs logged
              </span>

              <button
                className={`btn btn-sm ${tool.status === 'ACTIVE' ? 'btn-outline' : 'btn-secondary'}`}
                onClick={() => toggleToolStatus(tool.id)}
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                {tool.status === 'ACTIVE' ? 'Pause Tool' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
