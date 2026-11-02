import type { ComponentStatus } from '../../types/component';
import './StatusBadge.css';

interface StatusBadgeProps {
  status: ComponentStatus;
  size?: 'default' | 'large';
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  MANUFACTURED: 'Manufactured',
  CERTIFIED:    'Certified',
  SHIPPED:      'Shipped',
  RECEIVED:     'Received',
  TRANSFERRED:  'Transferred',
  ASSEMBLED:    'Assembled',
};

export function StatusBadge({ status, size = 'default', className = '' }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`status-badge ${status} ${size === 'large' ? 'large' : ''} ${className}`}
      aria-label={`Status: ${label}`}
    >
      <span className={`status-dot ${status}`} aria-hidden="true" />
      {label}
    </span>
  );
}
