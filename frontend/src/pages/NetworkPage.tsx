import { useState } from 'react';
import type { NetworkStatus, FabricHealthResult } from '../types/component';

interface NetworkPageProps {
  networkStatus: NetworkStatus;
  health: FabricHealthResult | null;
}

const NETWORK_LABELS: Record<NetworkStatus, string> = {
  connected:    'CONNECTED',
  connecting:   'CONNECTING',
  disconnected: 'OFFLINE',
};

const STATUS_COLORS: Record<NetworkStatus, string> = {
  connected:    'var(--success)',
  connecting:   'var(--status-shipped)',
  disconnected: 'var(--error)',
};

export function NetworkPage({ networkStatus, health }: NetworkPageProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  return (
    <div>
      <div className="page-heading">
        <h1>Network Status</h1>
        <p>Hyperledger Fabric network connectivity and ledger configuration.</p>
      </div>

      {/* Status banner */}
      <div className="panel" style={{ marginBottom: 'var(--space-6)', borderLeft: `3px solid ${STATUS_COLORS[networkStatus]}` }}>
        <div className="panel-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <span className={`network-dot ${networkStatus}`} style={{ width: 12, height: 12 }} aria-hidden="true" />
              <div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                  Fabric Network — {NETWORK_LABELS[networkStatus]}
                </div>
                {networkStatus === 'disconnected' && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--error)', marginTop: 4 }}>
                    {health?.error || 'Unable to establish connection to the Fabric gateway or chaincode.'}
                  </div>
                )}
                {networkStatus === 'connecting' && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Establishing connection to the Fabric gateway…
                  </div>
                )}
                {networkStatus === 'connected' && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--success)', marginTop: 4 }}>
                    Fabric peer connected. Channel: {health?.network || 'mychannel'}, Chaincode: {health?.chaincode || 'bmsprovenance'}
                  </div>
                )}
              </div>
            </div>

            {networkStatus === 'disconnected' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDiagnostics(prev => !prev)}
                aria-expanded={showDiagnostics}
              >
                {showDiagnostics ? 'Hide Diagnostic Details ▲' : 'Expand Diagnostics ▼'}
              </button>
            )}
          </div>

          {/* Expandable diagnostic panel */}
          {networkStatus === 'disconnected' && showDiagnostics && (
            <div style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              background: 'var(--bg-card)',
              border: '1px solid var(--error)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-primary)',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--error)', marginBottom: 6 }}>
                Fabric Network Diagnostic Summary
              </div>
              <div style={{ marginBottom: 4 }}><strong>Endpoint:</strong> GET /api/health/fabric</div>
              <div style={{ marginBottom: 4 }}><strong>Target Channel:</strong> {health?.network || 'mychannel'}</div>
              <div style={{ marginBottom: 4 }}><strong>Target Chaincode:</strong> {health?.chaincode || 'bmsprovenance'}</div>
              <div style={{ marginBottom: 6 }}><strong>Actual Error Message:</strong></div>
              <pre style={{
                background: 'var(--bg-main)',
                padding: 'var(--space-3)',
                borderRadius: 4,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                color: 'var(--error)',
                margin: 0
              }}>
                {health?.error || 'No response received from backend provenance service.'}
              </pre>
            </div>
          )}
        </div>
      </div>


      {/* Network details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Fabric Configuration</span>
          </div>
          <div className="panel-body">
            <div className="network-panel">
              {[
                { key: 'Channel',         value: 'mychannel' },
                { key: 'Chaincode',       value: 'bmsprovenance' },
                { key: 'Organization',    value: 'Org1MSP' },
                { key: 'Peer',            value: 'peer0.org1.example.com' },
                { key: 'Orderer',         value: 'orderer.example.com' },
                { key: 'Protocol',        value: 'Hyperledger Fabric v2.x' },
              ].map(row => (
                <div key={row.key} className="network-panel-row">
                  <span className="network-panel-key">{row.key}</span>
                  <span className="network-panel-value">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Connectivity</span>
          </div>
          <div className="panel-body">
            <div className="network-panel">
              {[
                { key: 'Gateway Status', value: NETWORK_LABELS[networkStatus] },
                { key: 'Backend API',    value: 'http://localhost:3000' },
                { key: 'Auth Model',     value: 'X-Identity (Development)' },
                { key: 'Endorsement',    value: 'Fabric Chaincode' },
                { key: 'Ledger',         value: 'Permissioned Blockchain' },
              ].map(row => (
                <div key={row.key} className="network-panel-row">
                  <span className="network-panel-key">{row.key}</span>
                  <span className="network-panel-value">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Architecture note */}
      <div className="panel" style={{ marginTop: 'var(--space-6)' }}>
        <div className="panel-header">
          <span className="panel-title">Architecture</span>
        </div>
        <div className="panel-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {['React Frontend', 'REST API (Node.js)', 'Fabric Gateway', 'Fabric Chaincode', 'Fabric Ledger'].map((node, idx, arr) => (
              <>
                <span key={node} style={{ padding: '6px 12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-ui)', fontWeight: 600 }}>
                  {node}
                </span>
                {idx < arr.length - 1 && <span key={`arr-${idx}`} style={{ color: 'var(--text-placeholder)' }}>→</span>}
              </>
            ))}
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-placeholder)', marginTop: 'var(--space-4)' }}>
            The frontend never directly accesses Fabric credentials or the wallet. All ledger interactions are proxied through the Node.js backend.
          </p>
        </div>
      </div>
    </div>
  );
}
