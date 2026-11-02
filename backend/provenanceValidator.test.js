'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProvenance } = require('./provenanceValidator');

function event(eventType, overrides = {}) {
  const base = {
    eventType,
    timestamp: '2026-09-30T10:00:00.000Z',
    actor: 'actor1',
    location: 'Bengaluru',
  };

  const dataByType = {
    MANUFACTURED: { manufacturer: 'EVTech Manufacturing' },
    CERTIFIED: { certificateID: 'CERT-BMS-2026-001', complianceReference: 'ISO-9001' },
    SHIPPED: { from: 'Bengaluru', to: 'Mysuru', shipmentID: 'SHIP-TEST-001', shipmentDate: '2026-09-30' },
    RECEIVED: { receivedDate: '2026-09-30' },
    TRANSFERRED: { from: 'warehouse1', to: 'assembler1', transferDate: '2026-09-30' },
    ASSEMBLED: { assemblyID: 'ASSY-001' },
  };

  return { ...base, ...(dataByType[eventType] || {}), ...overrides };
}

const validHistory = [
  event('MANUFACTURED'),
  event('CERTIFIED'),
  event('SHIPPED'),
  event('RECEIVED'),
  event('TRANSFERRED'),
  event('ASSEMBLED'),
];

test('accepts a complete ordered provenance history', () => {
  const result = validateProvenance(validHistory);
  assert.equal(result.valid, true);
  assert.equal(result.status, 'PROVENANCE VALID');
  assert.equal(result.condition, 'VALID');
  assert.equal(result.warning, null);
  assert.equal(result.completedStages, 6);
});

test('rejects an incomplete provenance history', () => {
  const result = validateProvenance(validHistory.slice(0, 4));
  assert.equal(result.valid, false);
  assert.equal(result.checks.requiredEventsPresent, false);
  assert.match(result.issues[0], /Missing lifecycle events/);
});

test('rejects an out-of-order provenance history', () => {
  const result = validateProvenance([
    event('MANUFACTURED'),
    event('SHIPPED'),
    event('CERTIFIED'),
    event('RECEIVED'),
    event('TRANSFERRED'),
    event('ASSEMBLED'),
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.checks.sequenceValid, false);
});

test('rejects missing actor, timestamp and location data', () => {
  const result = validateProvenance([
    event('MANUFACTURED', { actor: '', timestamp: '', location: '' }),
    event('CERTIFIED'),
    event('SHIPPED'),
    event('RECEIVED'),
    event('TRANSFERRED'),
    event('ASSEMBLED'),
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.checks.actorDataComplete, false);
  assert.equal(result.checks.timestampsValid, false);
  assert.equal(result.checks.locationsComplete, false);
});


test('classifies missing lifecycle data as incomplete provenance', () => {
  const result = validateProvenance(validHistory.slice(0, 3));
  assert.equal(result.condition, 'INCOMPLETE');
  assert.equal(result.warning?.title, 'Incomplete provenance');
  assert.match(result.warning?.message || '', /Required lifecycle events/);
});

test('classifies an unexpected event order as provenance inconsistency', () => {
  const result = validateProvenance([
    event('MANUFACTURED'),
    event('CERTIFIED'),
    event('RECEIVED'),
    event('SHIPPED'),
    event('TRANSFERRED'),
    event('ASSEMBLED'),
  ]);
  assert.equal(result.condition, 'INCONSISTENT');
  assert.equal(result.warning?.title, 'Provenance inconsistency detected');
});

test('classifies missing required provenance fields as incomplete provenance', () => {
  const result = validateProvenance(
    validHistory.map((item, index) =>
      index === 1 ? event('CERTIFIED', { complianceReference: '' }) : item
    )
  );
  assert.equal(result.condition, 'INCOMPLETE');
  assert.equal(result.warning?.title, 'Incomplete provenance');
});
