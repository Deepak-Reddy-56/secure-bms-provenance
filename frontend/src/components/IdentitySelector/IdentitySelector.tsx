import { useIdentity, ALL_IDENTITIES } from '../../context/IdentityContext';
import './IdentitySelector.css';

export function IdentitySelector() {
  const { identity, setIdentityById, roleLabel } = useIdentity();

  return (
    <div className="identity-selector" aria-label="Development identity selector">
      <span className="identity-selector-label">Development Identity</span>
      <div className="identity-selector-row">
        <select
          id="identity-select"
          className="identity-select"
          value={identity.id}
          onChange={e => setIdentityById(e.target.value)}
          aria-label="Select development identity"
        >
          {ALL_IDENTITIES.map(i => (
            <option key={i.id} value={i.id}>{i.id}</option>
          ))}
        </select>
        <span
          className={`role-badge ${identity.role}`}
          aria-label={`Role: ${roleLabel}`}
        >
          {roleLabel}
        </span>
      </div>
    </div>
  );
}
