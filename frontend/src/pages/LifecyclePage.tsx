import { useState } from 'react';
import { useComponentSearch } from '../hooks/useComponent';
import { useIdentity } from '../context/IdentityContext';
import type { ComponentStatus } from '../types/component';

const STAGES: ComponentStatus[] = ['MANUFACTURED','CERTIFIED','SHIPPED','RECEIVED','TRANSFERRED','ASSEMBLED'];

const STAGE_DESCRIPTIONS: Record<string, string> = {
  MANUFACTURED: 'Component registered on the Fabric ledger by the manufacturer.',
  CERTIFIED:    'Quality and compliance certification recorded by a certified inspector.',
  SHIPPED:      'Component dispatched to warehouse by a registered transporter.',
  RECEIVED:     'Component received and logged at the destination warehouse.',
  TRANSFERRED:  'Custody transferred from warehouse to the assembly entity.',
  ASSEMBLED:    'Component installed in a final assembly unit.',
};

const STAGE_ACTORS: Record<string, string> = {
  MANUFACTURED: 'MANUFACTURER',
  CERTIFIED:    'CERTIFIER',
  SHIPPED:      'TRANSPORTER',
  RECEIVED:     'WAREHOUSE',
  TRANSFERRED:  'WAREHOUSE',
  ASSEMBLED:    'ASSEMBLER',
};

function getStageState(stage: ComponentStatus, current: string): 'completed' | 'current' | 'pending' {
  const order = STAGES;
  const stageIdx   = order.indexOf(stage);
  const currentIdx = order.indexOf(current as ComponentStatus);
  if (stageIdx < currentIdx)  return 'completed';
  if (stageIdx === currentIdx) return 'current';
  return 'pending';
}

export function LifecyclePage() {
  const { identity } = useIdentity();
  const search = useComponentSearch();
  const [searchInput, setSearchInput] = useState('');

  const component = search.component;
  const currentStatus = component?.status ?? '';

  return (
    <div>
      <div className="page-heading">
        <h1>Component Lifecycle</h1>
        <p>Track the lifecycle progression of a component from manufacture to assembly.</p>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-8)' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="lifecycle-search">Component ID</label>
          <input id="lifecycle-search" type="text" className="form-input mono"
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && searchInput.trim()) search.search(searchInput.trim(), identity.id); }}
            placeholder="e.g. BMS-2026-001" />
        </div>
        <button className="btn btn-primary" style={{ height: 40, marginTop: 20 }}
          disabled={!searchInput.trim() || search.state === 'searching'}
          onClick={() => search.search(searchInput.trim(), identity.id)}
          id="btn-lifecycle-search">
          {search.state === 'searching' ? <><span className="spinner spinner-sm spinner-white" /> Loading…</> : 'Load Lifecycle'}
        </button>
        {component && <button className="btn btn-ghost" style={{ height: 40, marginTop: 20 }} onClick={search.clear}>Clear</button>}
      </div>

      {!component && search.state !== 'searching' && (
        <div className="panel">
          <div className="panel-body">
            <p className="section-heading">Lifecycle Stages</p>
            <div className="lifecycle-tracker">
              {STAGES.map((stage, idx) => (
                <div key={stage} className="lifecycle-step pending">
                  <div className="lifecycle-step-marker">{idx + 1}</div>
                  <div className="lifecycle-step-label">{stage}</div>
                </div>
              ))}
            </div>
            <div className="empty-state" style={{ paddingTop: 'var(--space-8)' }}>
              <p className="empty-state-title">No component loaded</p>
              <p className="empty-state-desc">Enter a component ID above to view its actual lifecycle state.</p>
            </div>
          </div>
        </div>
      )}

      {component && (
        <>
          {/* Component header */}
          <div className="panel" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 600 }}>{component.componentID}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>{component.componentType}</div>
              </div>
              <span className={`status-badge ${component.status}`}>
                <span className={`status-dot ${component.status}`} />
                {component.status}
              </span>
            </div>
          </div>

          {/* Horizontal lifecycle tracker */}
          <div className="panel" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="panel-header">
              <span className="panel-title">Lifecycle Progress</span>
            </div>
            <div className="panel-body">
              <div className="lifecycle-tracker">
                {STAGES.map((stage, idx) => {
                  const state = getStageState(stage, currentStatus);
                  return (
                    <div key={stage} className={`lifecycle-step ${state}`}>
                      <div className="lifecycle-step-marker">
                        {state === 'completed' ? '✓' : idx + 1}
                      </div>
                      <div className="lifecycle-step-label">{stage}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stage detail table */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Stage Details</span>
            </div>
            <table className="data-table" aria-label="Lifecycle stage details">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Stage</th>
                  <th>Required Role</th>
                  <th>Status</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {STAGES.map((stage, idx) => {
                  const state = getStageState(stage, currentStatus);
                  return (
                    <tr key={stage}>
                      <td style={{ color: 'var(--text-placeholder)', fontSize: 'var(--text-xs)' }}>{idx + 1}</td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          {stage}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        {STAGE_ACTORS[stage]}
                      </td>
                      <td>
                        {state === 'completed' && <span style={{ color: 'var(--success)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>✓ Complete</span>}
                        {state === 'current'   && <span style={{ color: 'var(--interactive)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>● Current</span>}
                        {state === 'pending'   && <span style={{ color: 'var(--text-placeholder)', fontSize: 'var(--text-xs)' }}>○ Pending</span>}
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{STAGE_DESCRIPTIONS[stage]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
