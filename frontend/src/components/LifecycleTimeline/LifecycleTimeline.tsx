import { LIFECYCLE_STAGES, getStageState } from '../../types/provenance';
import type { ProvenanceEventType } from '../../types/provenance';
import './LifecycleTimeline.css';

interface LifecycleTimelineProps {
  currentStatus?: string;
}

const STAGE_LABELS: Record<ProvenanceEventType, string> = {
  MANUFACTURED: 'Manufactured',
  CERTIFIED:    'Certified',
  SHIPPED:      'Shipped',
  RECEIVED:     'Received',
  TRANSFERRED:  'Transferred',
  ASSEMBLED:    'Assembled',
};

const STAGE_DESCRIPTIONS: Record<ProvenanceEventType, string> = {
  MANUFACTURED: 'Component registered on ledger',
  CERTIFIED:    'Quality compliance certified',
  SHIPPED:      'In transit to warehouse',
  RECEIVED:     'Received at warehouse',
  TRANSFERRED:  'Custody transferred',
  ASSEMBLED:    'Installed in assembly',
};

function StageIcon({ state }: { state: 'completed' | 'current' | 'pending' }) {
  if (state === 'completed') return <>✓</>;
  if (state === 'current')   return <>●</>;
  return <>○</>;
}

export function LifecycleTimeline({ currentStatus }: LifecycleTimelineProps) {
  return (
    <div className="lifecycle-timeline" role="list" aria-label="Component lifecycle stages">
      {LIFECYCLE_STAGES.map((stage, idx) => {
        const state = currentStatus
          ? getStageState(stage, currentStatus)
          : (idx === 0 ? 'pending' : 'pending');
        const isLast = idx === LIFECYCLE_STAGES.length - 1;

        return (
          <div
            key={stage}
            className="lifecycle-stage"
            role="listitem"
            aria-label={`${STAGE_LABELS[stage]}: ${state}`}
          >
            <div className="lifecycle-stage-connector">
              <div className={`lifecycle-stage-icon ${state}`} aria-hidden="true">
                <StageIcon state={state} />
              </div>
              {!isLast && (
                <div className={`lifecycle-line ${state}`} aria-hidden="true" />
              )}
            </div>
            <div className="lifecycle-stage-content">
              <div className={`lifecycle-stage-name ${state}`}>
                {STAGE_LABELS[stage]}
              </div>
              {state !== 'pending' && (
                <div className="lifecycle-stage-meta">
                  {STAGE_DESCRIPTIONS[stage]}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
