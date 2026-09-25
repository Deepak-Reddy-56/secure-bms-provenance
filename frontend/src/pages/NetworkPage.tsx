import type { NetworkStatus } from '../types/component';

interface NetworkPageProps {
  networkStatus: NetworkStatus;
}

const NETWORK_LABELS: Record<NetworkStatus, string> = {
  connected:    'Connected',
  connecting:   'Connecting',
  disconnected: 'Offline',
};

const STATUS_COLORS: Record<NetworkStatus, string> = {
  connected:    'var(--success)',
  connecting:   'var(--status-shipped)',
  disconnected: 'var(--error)',
};

export function NetworkPage({ networkStatus }: NetworkPageProps) {
  return (
    <div>
      <div className="page-heading">
        <h1>Network Status</h1>
        <p>Hyperledger Fabric network connectivity and ledger configuration.</p>
      </div>

      {/* Status banner */}
      <div className="panel" style={{ marginBottom: 'var(--space-6)', borderLeft: `3px solid ${STATUS_COLORS[networkStatus]}` }}>
        <div className="panel-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span className={`network-dot ${networkStatus}`} style={{ width: 12, height: 12 }} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Fabric Network {NETWORK_LABELS[networkStatus]}
            </div>
            {networkStatus === 'disconnected' && (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--error)', marginTop: 4 }}>
                Unable to reach the Hyperledger Fabric gateway. Verify the backend service is running.
              </div>
            )}
            {networkStatus === 'connecting' && (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
                Establishing connection to the Fabric gateway…
              </div>
            )}
          </div>
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
