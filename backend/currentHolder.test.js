'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getCurrentHolder } = require('./currentHolder');

test('uses manufacturer as holder before shipment', () => {
  assert.equal(
    getCurrentHolder({
      status: 'CERTIFIED',
      manufacturerActor: 'manufacturer1',
      manufacturer: 'EVTech Manufacturing',
    }),
    'manufacturer1'
  );
});

test('uses transporter as holder while shipped', () => {
  assert.equal(
    getCurrentHolder({ status: 'SHIPPED', transporter: 'transporter1' }),
    'transporter1'
  );
});

test('uses warehouse as holder after receipt', () => {
  assert.equal(
    getCurrentHolder({ status: 'RECEIVED', warehouse: 'warehouse1' }),
    'warehouse1'
  );
});

test('uses custody recipient as holder after transfer', () => {
  assert.equal(
    getCurrentHolder({ status: 'TRANSFERRED', custodyTo: 'assembler1' }),
    'assembler1'
  );
});

test('uses assembler as holder after assembly', () => {
  assert.equal(
    getCurrentHolder({ status: 'ASSEMBLED', assembler: 'assembler1' }),
    'assembler1'
  );
});

test('returns null when the holder is not recorded', () => {
  assert.equal(getCurrentHolder({ status: 'ASSEMBLED' }), null);
});
