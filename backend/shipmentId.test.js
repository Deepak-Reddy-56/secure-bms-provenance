'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildShipmentId, validateShipmentId } = require('./shipmentId');

test('builds the canonical shipment ID with component, shipment date and route', () => {
  assert.equal(
    buildShipmentId({
      componentID: 'BMS-MOTH-01300926001',
      shipmentDate: '2026-09-30',
      fromCode: 'BNG',
      toCode: 'MYS',
    }),
    'SHIP-MOTH-01300926-BNG-MYS'
  );
});

test('validates a system-generated shipment ID', () => {
  assert.equal(
    validateShipmentId({
      shipmentID: 'SHIP-MOTH-01300926-BNG-MYS',
      componentID: 'BMS-MOTH-01300926001',
      shipmentDate: '2026-09-30',
      fromCode: 'BNG',
      toCode: 'MYS',
    }),
    'SHIP-MOTH-01300926-BNG-MYS'
  );
});

test('rejects a manually altered shipment ID', () => {
  assert.throws(
    () => validateShipmentId({
      shipmentID: 'SHIP-MOTH-01300926-BNG-BLR',
      componentID: 'BMS-MOTH-01300926001',
      shipmentDate: '2026-09-30',
      fromCode: 'BNG',
      toCode: 'MYS',
    }),
    /system-generated/
  );
});

test('rejects identical origin and destination', () => {
  assert.throws(
    () => buildShipmentId({
      componentID: 'BMS-MOTH-01300926001',
      shipmentDate: '2026-09-30',
      fromCode: 'BNG',
      toCode: 'BNG',
    }),
    /different/
  );
});

test('rejects legacy component IDs for governed shipment generation', () => {
  assert.throws(
    () => buildShipmentId({
      componentID: 'BMS-2026-001',
      shipmentDate: '2026-09-30',
      fromCode: 'BNG',
      toCode: 'MYS',
    }),
    /canonical BMS component ID/
  );
});
