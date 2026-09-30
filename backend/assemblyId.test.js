'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAssemblyId,
  validateAssemblyId,
} = require('./assemblyId');

test('builds an Assembly ID from the canonical component ID', () => {
  assert.equal(
    buildAssemblyId('BMS-MOTH-01300926001'),
    'ASSY-MOTH-01300926001'
  );
});

test('validates the system-generated Assembly ID', () => {
  assert.equal(
    validateAssemblyId({
      componentID: 'BMS-MOTH-01300926001',
      assemblyID: 'ASSY-MOTH-01300926001',
    }),
    'ASSY-MOTH-01300926001'
  );
});

test('rejects a manually altered Assembly ID', () => {
  assert.throws(
    () => validateAssemblyId({
      componentID: 'BMS-MOTH-01300926001',
      assemblyID: 'ASSY-001',
    }),
    /system-generated/
  );
});

test('rejects legacy component IDs for governed Assembly ID generation', () => {
  assert.throws(
    () => buildAssemblyId('BMS-2026-001'),
    /canonical BMS component ID/
  );
});
