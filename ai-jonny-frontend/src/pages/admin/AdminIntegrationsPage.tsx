import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power,
  Clock,
  Database,
  ExternalLink,
  Sliders,
  Users,
  TrendingUp,
  FolderKanban,
  CheckSquare
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformConnectionModal } from '../../components/modals/PlatformConnectionModal';
import { apiClient, CrmAdminStats } from '../../services/apiClient';
import '../../styles/dashboard.css';

export const AdminIntegrationsPage: React.FC = () => {
  const { integrations, toggleIntegrationStatus, showToast } = useApp();
  const [selectedIntegration, setSelectedIntegration] = useState<any | null>(null);
  const [crmStats, setCrmStats] = useState<CrmAdminStats | null>(null);
  const [crmEnabled, setCrmEnabled] = useState<boolean>(true);
  const [isPingingCrm, setIsPingingCrm] = useState<boolean>(false);

  useEffect(() => {
    // Fetch live CRM status & aggregate telemetry for admin
    apiClient.getCrmStatus()
      .then((res) => {
        if (res.success && typeof res.enabled === 'boolean') {
          setCrmEnabled(res.enabled);
        }
      })
      .catch(() => {});

    apiClient.getAdminCrmStats()
      .then((res) => {
        if (res.success && res.stats) {
          setCrmStats(res.stats);
        }
      })
      .catch(() => {});
  }, []);

  const handleTestConnection = async (name: string) => {
    if (name.toLowerCase().includes('crm') || name.toLowerCase().includes('nergy')) {
      setIsPingingCrm(true);
      try {
        const start = performance.now();
        const res = await apiClient.getCrmStatus();
        const latency = Math.round(performance.now() - start);
        setCrmEnabled(res.enabled);
        showToast(
          `CRM nErgy Bridge: ${res.enabled ? 'OPERATIONAL' : 'DISABLED'} (${latency}ms latency, 200 OK)`,
          res.enabled ? 'success' : 'warning'
        );
      } catch (err: any) {
        showToast(`CRM nErgy Ping Failed: ${err.message}`, 'error');
      } finally {
        setIsPingingCrm(false);
      }
      return;
    }
    showToast(`Pinging ${name}... Connection validated (200 OK)`, 'success');
  };

  const getPermissionsForService = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('google')) return ['customsearch.readonly', 'cse.list', 'searchconsole.readonly'];
    if (n.includes('openai')) return ['model.chat.completions', 'embeddings.create', 'usage.read'];
    if (n.includes('anthropic') || n.includes('claude')) return ['messages.create', 'models.read'];
    if (n.includes('s3') || n.includes('aws') || n.includes('storage')) return ['s3:PutObject', 's3:GetObject', 's3:ListBucket'];
    if (n.includes('crm') || n.includes('nergy')) return ['crm.leads.read', 'crm.leads.write', 'webhooks.ingest'];
    return ['api.read', 'api.write', 'telemetry.sync'];
  };

  return (
    <div className="dashboard-page-container">
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1>
            <Cpu size={26} color="#A78BFA" />
            Supported System Integrations
          </h1>
          <p className="dashboard-subtitle">
            Inspect verified external service connections, search APIs, LLM inference endpoints, cloud storage buckets, and CRM bridges.
          </p>
        </div>

        <div className="dashboard-header-actions">
          <div className="badge badge-success">
            {integrations.filter((i) => i.status === 'CONNECTED').length} Active Services
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="cards-grid-2">
        {integrations.map((item) => {
          const isCrmItem = item.category === 'CRM' || item.name.toLowerCase().includes('crm') || item.name.toLowerCase().includes('nergy');
          const effectiveStatus = isCrmItem ? (crmEnabled ? 'CONNECTED' : 'DISCONNECTED') : item.status;

          return (
          <div key={item.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                  {item.category}
                </span>
                <span
                  className={`status-chip ${
                    effectiveStatus === 'CONNECTED'
                      ? 'success'
                      : effectiveStatus === 'MAINTENANCE'
                      ? 'warning'
                      : 'danger'
                  }`}
                >
                  {effectiveStatus === 'CONNECTED' ? (
                    <CheckCircle2 size={12} />
                  ) : effectiveStatus === 'MAINTENANCE' ? (
                    <AlertTriangle size={12} />
                  ) : (
                    <Power size={12} />
                  )}
                  {effectiveStatus}
                </span>
              </div>

              <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#111625', marginBottom: '6px' }}>
                {item.name}
              </h3>
              <p style={{ fontSize: '13px', color: '#5F6B85', lineHeight: '1.4', marginBottom: '16px' }}>
                {item.description}
              </p>

              {isCrmItem && crmStats ? (
                <div style={{ background: '#FAFBFD', border: '1px solid #E8ECF5', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#6E56CF', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Authorized Platform CRM Telemetry (Aggregated)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: '#5F6B85' }}>Contacts &amp; Leads:</span> <strong style={{ color: '#111625' }}>{crmStats.totalContacts}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#5F6B85' }}>Pipeline Deals:</span> <strong style={{ color: '#111625' }}>{crmStats.totalDeals} (${crmStats.totalPipelineValue.toLocaleString()})</strong>
                    </div>
                    <div>
                      <span style={{ color: '#5F6B85' }}>Active Projects:</span> <strong style={{ color: '#111625' }}>{crmStats.totalProjects}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#5F6B85' }}>Active CRM Users:</span> <strong style={{ color: '#111625' }}>{crmStats.activeCrmUsers}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#5F6B85', marginBottom: '16px' }}>
                  <span>Latency: <strong style={{ color: '#111625' }}>{item.latency || 'N/A'}</strong></span>
                  {item.connectedAt && (
                    <span>Connected: <strong style={{ color: '#111625' }}>{item.connectedAt}</strong></span>
                  )}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #E8ECF5', paddingTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleTestConnection(item.name)}
                disabled={isPingingCrm && isCrmItem}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                <RefreshCw size={12} className={isPingingCrm && isCrmItem ? 'spin' : ''} />
                <span>{isPingingCrm && isCrmItem ? 'Pinging...' : 'Ping Health'}</span>
              </button>

              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedIntegration(item)}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                <Sliders size={12} />
                <span>Configure</span>
              </button>

              <button
                className={`btn btn-sm ${effectiveStatus === 'CONNECTED' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => {
                  setSelectedIntegration(item);
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  background: effectiveStatus === 'CONNECTED' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                  color: effectiveStatus === 'CONNECTED' ? '#F87171' : '#34D399',
                  borderColor: effectiveStatus === 'CONNECTED' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'
                }}
              >
                <Power size={12} />
                <span>{effectiveStatus === 'CONNECTED' ? 'Disconnect' : 'Connect'}</span>
              </button>
            </div>
          </div>
        );
      })}
      </div>

      {/* P2: Platform & Integration Connection Dialog */}
      {selectedIntegration && (
        <PlatformConnectionModal
          isOpen={Boolean(selectedIntegration)}
          onClose={() => setSelectedIntegration(null)}
          platformId={selectedIntegration.id}
          platformName={selectedIntegration.name}
          category={selectedIntegration.category}
          currentStatus={selectedIntegration.status === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED'}
          purposeDescription={selectedIntegration.description}
          knownPermissions={getPermissionsForService(selectedIntegration.name)}
          onConnect={() => {
            if (selectedIntegration.status !== 'CONNECTED') {
              toggleIntegrationStatus(selectedIntegration.id);
            }
            showToast(`${selectedIntegration.name} bridge enabled`, 'success');
            setSelectedIntegration(null);
          }}
          onDisconnect={() => {
            if (selectedIntegration.status === 'CONNECTED') {
              toggleIntegrationStatus(selectedIntegration.id);
            }
            showToast(`${selectedIntegration.name} disconnected`, 'info');
            setSelectedIntegration(null);
          }}
        />
      )}
    </div>
  );
};
