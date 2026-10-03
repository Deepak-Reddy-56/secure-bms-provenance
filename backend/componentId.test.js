'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildComponentId,
  parseComponentId,
  validateComponentIdFormat,
} = require('./componentId');

test('builds the canonical Component ID', () => {
  assert.equal(
    buildComponentId({
      typeCode: 'MOTH',
      componentNumber: '01',
      manufactureDate: '2026-09-30',
      serialNumber: '001',
    }),
    'BMS-MOTH-01300926001'
  );
});

test('parses a valid Component ID', () => {
  const result = parseComponentId('BMS-MOTH-01300926001');

  assert.equal(result.typeCode, 'MOTH');
  assert.equal(result.componentNumber, '01');
  assert.equal(result.datePart, '300926');
  assert.equal(result.serial, '001');
  assert.equal(result.validDate, true);
});

test('accepts only non-zero component numbers and serials', () => {
  assert.equal(validateComponentIdFormat('BMS-MOTH-01300926001').valid, true);
  assert.equal(validateComponentIdFormat('BMS-MOTH-00300926001').valid, false);
  assert.equal(validateComponentIdFormat('BMS-MOTH-01300926000').valid, false);
});

test('rejects invalid date values', () => {
  const result = validateComponentIdFormat('BMS-MOTH-01310226001');

  assert.equal(result.valid, false);
  assert.equal(result.status, 'INVALID_DATE');
});

test('rejects a non-canonical component ID', () => {
  const result = validateComponentIdFormat('BMS-2026-001');

  assert.equal(result.valid, false);
  assert.equal(result.status, 'INVALID');
});
