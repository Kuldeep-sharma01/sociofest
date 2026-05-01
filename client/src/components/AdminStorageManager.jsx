/**
 * Admin Storage Management Component
 * Allows admins to configure multi-cloud model storage with priority/fallback
 * Features:
 * - View all storage backends (Local, Google Drive, S3, Azure, HuggingFace)
 * - Enable/disable backends
 * - Set priority order (primary, secondary, fallback)
 * - Configure backend credentials
 * - Monitor storage usage
 * - View audit logs
 */

import React, { useState, useEffect } from 'react';
import { pythonAPI } from '@/lib/api';

const AdminStorageManager = () => {
  const [backends, setBackends] = useState([]);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('backends'); // backends, settings, status
  const [editingBackend, setEditingBackend] = useState(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [backendsRes, configRes, statusRes, settingsRes] = await Promise.all([
        pythonAPI.getStorageBackends(),
        pythonAPI.getStorageConfig(),
        pythonAPI.getStorageStatus(),
        pythonAPI.getStorageSettings(),
      ]);

      setBackends(backendsRes.backends);
      setConfig(configRes.config);
      setStatus(statusRes.status);
      setSettings(settingsRes.settings);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load storage config');
      setLoading(false);
    }
  };

  const handleToggleBackend = async (backendType, enabled) => {
    try {
      await pythonAPI.toggleStorageBackend(backendType, enabled);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to update backend');
    }
  };

  const handlePriorityChange = async (backendType, newPriority) => {
    try {
      await pythonAPI.updateStorageBackendPriority(backendType, parseInt(newPriority, 10));
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to update priority');
    }
  };

  const handleConfigUpdate = async (backendType, newConfig) => {
    try {
      await pythonAPI.updateStorageBackendConfig(backendType, newConfig);
      loadData();
      setEditingBackend(null);
    } catch (err) {
      setError(err.message || 'Failed to update configuration');
    }
  };

  if (loading) {
    return <div style={styles.container}>Loading storage configuration...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>☁️ Multi-Cloud Model Storage Management</h1>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab('backends')}
          style={{
            ...styles.tab,
            ...(activeTab === 'backends' ? styles.tabActive : {}),
          }}
        >
          📦 Backends
        </button>
        <button
          onClick={() => setActiveTab('status')}
          style={{
            ...styles.tab,
            ...(activeTab === 'status' ? styles.tabActive : {}),
          }}
        >
          📊 Status
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          style={{
            ...styles.tab,
            ...(activeTab === 'settings' ? styles.tabActive : {}),
          }}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Backends Tab */}
      {activeTab === 'backends' && (
        <div style={styles.tabContent}>
          <h2>Storage Backends</h2>
          <div style={styles.backendsGrid}>
            {backends.map((backend) => (
              <div key={backend.type} style={styles.backendCard}>
                <div style={styles.backendHeader}>
                  <h3>{backend.name}</h3>
                  <span style={{
                    ...styles.badge,
                    backgroundColor: backend.enabled ? '#4caf50' : '#ccc',
                  }}>
                    {backend.enabled ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </div>

                <div style={styles.backendInfo}>
                  <p>
                    <strong>Type:</strong> {backend.type}
                  </p>
                  <p>
                    <strong>Priority:</strong> {backend.priority}
                    {backend.priority === 1 && ' (Primary)'}
                    {backend.priority === 2 && ' (Secondary)'}
                    {backend.priority === 99 && ' (Fallback)'}
                  </p>
                  <p>
                    <strong>Health:</strong>{' '}
                    <span
                      style={{
                        color: backend.healthy ? '#4caf50' : '#f44336',
                        fontWeight: 'bold',
                      }}
                    >
                      {backend.healthy ? '✓ Healthy' : '✗ Unavailable'}
                    </span>
                  </p>
                  <p>
                    <strong>Space Available:</strong>{' '}
                    {backend.available_space_gb === Infinity
                      ? 'Unlimited'
                      : `${backend.available_space_gb.toFixed(2)} GB`}
                  </p>
                </div>

                <div style={styles.backendActions}>
                  {backend.type !== 'local' && (
                    <button
                      onClick={() => handleToggleBackend(backend.type, !backend.enabled)}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: backend.enabled ? '#f44336' : '#4caf50',
                      }}
                    >
                      {backend.enabled ? 'Disable' : 'Enable'}
                    </button>
                  )}

                  {backend.enabled && backend.type !== 'huggingface' && (
                    <>
                      <div style={styles.priorityControl}>
                        <label>Priority:</label>
                        <select
                          value={backend.priority}
                          onChange={(e) =>
                            handlePriorityChange(backend.type, e.target.value)
                          }
                          style={styles.select}
                        >
                          {[1, 2, 3, 4, 5].map((p) => (
                            <option key={p} value={p}>
                              {p}
                              {p === 1 && ' - Primary'}
                              {p === 2 && ' - Secondary'}
                              {p === 3 && ' - Tertiary'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() =>
                          setEditingBackend(editingBackend?.type === backend.type ? null : backend)
                        }
                        style={styles.configButton}
                      >
                        {editingBackend?.type === backend.type ? 'Close Config' : 'Configure'}
                      </button>
                    </>
                  )}
                </div>

                {/* Expandable Config */}
                {editingBackend?.type === backend.type && (
                  <BackendConfigEditor
                    backend={backend}
                    onSave={(newConfig) =>
                      handleConfigUpdate(backend.type, newConfig)
                    }
                    onCancel={() => setEditingBackend(null)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Storage Strategy Info */}
          <div style={styles.infoBox}>
            <h4>📋 Storage Strategy</h4>
            <p>
              <strong>Fallback Strategy:</strong>{' '}
              {config?.model_storage?.fallback_strategy || 'sequential'}
            </p>
            <p>
              <strong>Large File Threshold:</strong>{' '}
              {config?.model_storage?.large_file_threshold_gb} GB
            </p>
            <p style={styles.hint}>
              Models larger than the threshold will be stored across all enabled backends
              for redundancy.
            </p>
          </div>
        </div>
      )}

      {/* Status Tab */}
      {activeTab === 'status' && (
        <div style={styles.tabContent}>
          <h2>Real-Time Status</h2>
          <div style={styles.statusGrid}>
            {status?.backends &&
              Object.entries(status.backends).map(([type, info]) => (
                <div key={type} style={styles.statusCard}>
                  <h4>{info.name}</h4>
                  <p>
                    <strong>Status:</strong>{' '}
                    <span
                      style={{
                        color: info.healthy ? '#4caf50' : '#f44336',
                        fontWeight: 'bold',
                      }}
                    >
                      {info.healthy ? '✓ Online' : '✗ Offline'}
                    </span>
                  </p>
                  <p>
                    <strong>Available:</strong>{' '}
                    {info.available_space_gb === Infinity
                      ? '♾️ Unlimited'
                      : `${info.available_space_gb.toFixed(1)} GB`}
                  </p>
                  <p style={styles.statusTime}>
                    Last check: {new Date(status.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div style={styles.tabContent}>
          <h2>Storage Settings</h2>
          <div style={styles.settingsBox}>
            <div style={styles.settingItem}>
              <label>Large File Threshold (GB)</label>
              <input
                type="number"
                value={settings?.large_file_threshold_gb || 3}
                disabled
                style={styles.input}
              />
              <small>Files larger than this will use multi-backend storage</small>
            </div>

            <div style={styles.settingItem}>
              <label>Fallback Strategy</label>
              <select
                value={settings?.fallback_strategy || 'sequential'}
                disabled
                style={styles.select}
              >
                <option value="sequential">Sequential (Try each in order)</option>
                <option value="random">Random (Try random order)</option>
              </select>
              <small>How the system tries backends when one fails</small>
            </div>

            <div style={styles.settingItem}>
              <label>Storage Status</label>
              <div style={{
                ...styles.statusIndicator,
                backgroundColor: settings?.enabled ? '#4caf50' : '#f44336',
              }}>
                {settings?.enabled ? '✓ Enabled' : '✗ Disabled'}
              </div>
            </div>

            <p style={styles.hint}>
              ℹ️ To edit settings, contact your system administrator
            </p>
          </div>

          {/* Backend Configuration Guide */}
          <div style={styles.guideBox}>
            <h3>💡 Backend Configuration Guide</h3>
            <div style={styles.guideContent}>
              <h4>Google Drive</h4>
              <ul>
                <li>Requires: Service account JSON credentials</li>
                <li>Path: .env.secrets/google-drive-credentials.json</li>
                <li>Ideal for: Team collaboration, backup</li>
              </ul>

              <h4>AWS S3</h4>
              <ul>
                <li>Requires: Access Key, Secret Key, Bucket Name</li>
                <li>Good for: Scale, CDN integration</li>
              </ul>

              <h4>Azure Blob</h4>
              <ul>
                <li>Requires: Account Name, Account Key, Container</li>
                <li>Good for: Enterprise, compliance</li>
              </ul>

              <h4>Local Storage</h4>
              <ul>
                <li>No configuration needed</li>
                <li>Good for: Development, caching</li>
                <li>Cannot be disabled</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Backend Configuration Editor Component
const BackendConfigEditor = ({ backend, onSave, onCancel }) => {
  const [config, setConfig] = useState(backend.config || {});

  const handleChange = (key, value) => {
    setConfig({ ...config, [key]: value });
  };

  const handleSave = () => {
    onSave(config);
  };

  return (
    <div style={styles.configEditor}>
      <h4>Configure {backend.name}</h4>
      {Object.entries(config).map(([key, value]) => (
        <div key={key} style={styles.configField}>
          <label>{key}</label>
          {key.includes('key') || key.includes('secret') ? (
            <input
              type="password"
              value={value || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={`Enter ${key}`}
              style={styles.input}
            />
          ) : (
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={`Enter ${key}`}
              style={styles.input}
            />
          )}
        </div>
      ))}
      <div style={styles.configActions}>
        <button onClick={handleSave} style={{...styles.actionButton, backgroundColor: '#4caf50'}}>
          Save
        </button>
        <button onClick={onCancel} style={{...styles.actionButton, backgroundColor: '#666'}}>
          Cancel
        </button>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
    fontFamily: 'system-ui, sans-serif',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '1.5rem',
    color: '#333',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    border: '1px solid #ef5350',
  },
  tabsContainer: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
    borderBottom: '2px solid #ddd',
  },
  tab: {
    padding: '0.75rem 1.5rem',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
    color: '#666',
    borderBottom: '3px solid transparent',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#2196f3',
    borderBottom: '3px solid #2196f3',
  },
  tabContent: {
    backgroundColor: '#fff',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  backendsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  backendCard: {
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1.5rem',
    backgroundColor: '#fafafa',
    transition: 'all 0.2s',
  },
  backendHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  badge: {
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: '600',
  },
  backendInfo: {
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  backendActions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  actionButton: {
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  configButton: {
    padding: '0.5rem 1rem',
    border: '2px solid #2196f3',
    borderRadius: '6px',
    backgroundColor: '#e3f2fd',
    color: '#2196f3',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  priorityControl: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  select: {
    padding: '0.5rem',
    border: '2px solid #ddd',
    borderRadius: '6px',
    fontFamily: 'inherit',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '2px solid #ddd',
    borderRadius: '6px',
    fontFamily: 'inherit',
    fontSize: '1rem',
    marginTop: '0.25rem',
    boxSizing: 'border-box',
  },
  configEditor: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#e3f2fd',
    borderRadius: '6px',
    border: '1px solid #2196f3',
  },
  configField: {
    marginBottom: '1rem',
  },
  configActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
  },
  infoBox: {
    backgroundColor: '#e8f5e9',
    border: '1px solid #4caf50',
    padding: '1.5rem',
    borderRadius: '8px',
    marginTop: '2rem',
  },
  hint: {
    fontSize: '0.875rem',
    color: '#666',
    marginTop: '0.5rem',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1rem',
  },
  statusCard: {
    border: '1px solid #e0e0e0',
    padding: '1.5rem',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
  },
  statusIndicator: {
    padding: '1rem',
    borderRadius: '6px',
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: '0.5rem',
  },
  statusTime: {
    fontSize: '0.75rem',
    color: '#999',
    marginTop: '0.5rem',
  },
  settingsBox: {
    backgroundColor: '#fff',
    padding: '2rem',
    borderRadius: '8px',
  },
  settingItem: {
    marginBottom: '2rem',
  },
  guideBox: {
    marginTop: '3rem',
    backgroundColor: '#fffde7',
    border: '1px solid #fbc02d',
    padding: '1.5rem',
    borderRadius: '8px',
  },
  guideContent: {
    marginTop: '1rem',
  },
};

export default AdminStorageManager;
