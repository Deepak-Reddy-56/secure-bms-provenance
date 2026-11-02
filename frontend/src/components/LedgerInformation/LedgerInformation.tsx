import './LedgerInformation.css';

interface LedgerInformationProps {
  /** The transaction ID returned from the last operation, if available */
  txId?: string | null;
}

const NA = <span className="ledger-value na">Not available</span>;

export function LedgerInformation({ txId }: LedgerInformationProps) {
  return (
    <aside className="ledger-card" aria-label="Ledger information">
      <div className="ledger-card-header">
        <div className="ledger-card-title">Ledger Information</div>
      </div>

      <dl className="ledger-fields">
        <div className="ledger-row">
          <dt className="ledger-label">Ledger</dt>
          <dd className="ledger-value">Hyperledger Fabric</dd>
        </div>

        <div className="ledger-row">
          <dt className="ledger-label">Network</dt>
          <dd className="ledger-value">Fabric Test Network</dd>
        </div>

        <div className="ledger-row">
          <dt className="ledger-label">Channel</dt>
          <dd className="ledger-value mono">mychannel</dd>
        </div>

        <div className="ledger-row">
          <dt className="ledger-label">Chaincode</dt>
          <dd className="ledger-value mono">bmsprovenance</dd>
        </div>

        <div className="ledger-row">
          <dt className="ledger-label">Transaction ID</dt>
          <dd className={txId ? 'ledger-value mono' : ''}>
            {txId ? txId : NA}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
