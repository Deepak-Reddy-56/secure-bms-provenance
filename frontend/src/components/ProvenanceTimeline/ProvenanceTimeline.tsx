import './ProvenanceTimeline.css';

interface TimelineStage {
  label: string;
  implemented: boolean;
  note?: string;
}

const DAY1_STAGES: TimelineStage[] = [
  { label: 'Manufacturer',           implemented: true  },
  { label: 'Component Registered',   implemented: true  },
  { label: 'Certification',          implemented: false, note: 'Not implemented — Day 1 scope' },
  { label: 'Transportation',         implemented: false, note: 'Not implemented — Day 1 scope' },
  { label: 'Warehouse',              implemented: false, note: 'Not implemented — Day 1 scope' },
  { label: 'Assembly',               implemented: false, note: 'Not implemented — Day 1 scope' },
];

export function ProvenanceTimeline() {
  return (
    <aside className="timeline-card" aria-label="Provenance lifecycle stages">
      <div className="timeline-card-header">
        <div className="timeline-card-title">Provenance Lifecycle</div>
        <div className="timeline-card-subtitle">Day 1 — Registration scope only</div>
      </div>

      <div className="timeline-body">
        <ol className="timeline-stages" aria-label="Component lifecycle stages">
          {DAY1_STAGES.map((stage, index) => (
            <li
              key={index}
              className={`timeline-stage ${stage.implemented ? 'active' : ''}`}
            >
              <div
                className={`timeline-stage-indicator ${stage.implemented ? 'done' : 'pending'}`}
                aria-hidden="true"
              >
                {stage.implemented ? '✓' : '○'}
              </div>
              <div className="timeline-stage-content">
                <div className={`timeline-stage-label ${stage.implemented ? '' : 'pending'}`}>
                  {stage.label}
                  {!stage.implemented && (
                    <span className="sr-only"> (not implemented)</span>
                  )}
                </div>
                {stage.note && (
                  <div className="timeline-stage-note" aria-hidden="true">
                    {stage.note}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
