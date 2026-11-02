'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  __test: {
    formatChaincodeArgs,
    buildInvokeArgs,
    buildQueryArgs,
    buildPeerEnvironment,
  },
} = require('./fabricGateway');

test('serializes chaincode arguments as one JSON CLI argument', () => {
  const hostileLookingValue = "BMS-001'; touch /tmp/should-not-run; '";

  const args = buildQueryArgs('GetComponent', [hostileLookingValue]);
  const jsonIndex = args.indexOf('-c') + 1;

  assert.ok(jsonIndex > 0);
  assert.equal(
    args[jsonIndex],
    JSON.stringify({
      Args: ['GetComponent', hostileLookingValue],
    })
  );
  assert.equal(args.filter(value => value === '-c').length, 1);
});

test('builds invoke arguments with separate flags and configured TLS paths', () => {
  const args = buildInvokeArgs('CreateComponent', [
    'BMS-MOTH-01101026001',
    'Motherboard',
    'Manufacturer',
    '2026-10-30',
    'Bengaluru',
  ]);

  assert.equal(args[0], 'chaincode');
  assert.equal(args[1], 'invoke');
  assert.equal(args.filter(value => value === '--peerAddresses').length, 2);
  assert.ok(args.includes('--tls'));
  assert.ok(args.includes('--cafile'));
  assert.ok(args.includes('--tlsRootCertFiles'));

  const chaincodeArgs = JSON.parse(args[args.indexOf('-c') + 1]);
  assert.equal(chaincodeArgs.Args[0], 'CreateComponent');
  assert.equal(chaincodeArgs.Args[1], 'BMS-MOTH-01101026001');
});

test('builds query arguments without shell command interpolation', () => {
  const args = buildQueryArgs('GetComponentHistory', ['BMS-MOTH-01101026001']);

  assert.deepEqual(args.slice(0, 2), ['chaincode', 'query']);
  assert.equal(args[args.indexOf('-C') + 1], 'mychannel');
  assert.equal(args[args.indexOf('-n') + 1], 'bmsprovenance');
  assert.equal(
    JSON.parse(args[args.indexOf('-c') + 1]).Args[0],
    'GetComponentHistory'
  );
});

test('builds peer environment only for configured Fabric identities', () => {
  const env = buildPeerEnvironment('auditor1');

  assert.equal(env.CORE_PEER_TLS_ENABLED, 'true');
  assert.equal(env.CORE_PEER_LOCALMSPID, 'Org1MSP');
  assert.ok(env.CORE_PEER_MSPCONFIGPATH.endsWith(
    '/organizations/peerOrganizations/org1.example.com/users/auditor1@org1.example.com/msp'
  ));
  assert.ok(env.CORE_PEER_TLS_ROOTCERT_FILE.endsWith(
    '/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt'
  ));

  assert.throws(
    () => buildPeerEnvironment('unknown'),
    /Unknown Fabric identity/
  );
});

test('rejects invalid chaincode function names and argument types', () => {
  assert.throws(
    () => formatChaincodeArgs('Get Component', []),
    /Invalid chaincode function name/
  );

  assert.throws(
    () => formatChaincodeArgs('GetComponent', [null]),
    /Chaincode arguments must be strings or primitive values/
  );
});
