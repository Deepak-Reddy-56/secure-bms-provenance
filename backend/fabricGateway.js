'use strict';

const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const CHANNEL_NAME = process.env.FABRIC_CHANNEL || 'mychannel';
const CHAINCODE_NAME = process.env.FABRIC_CHAINCODE || 'bmsprovenance';
const HEALTH_IDENTITY = 'auditor1';

function requiredSafeName(value, label) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  ) {
    throw new Error(`Invalid ${label} configuration.`);
  }

  return value;
}

requiredSafeName(CHANNEL_NAME, 'Fabric channel');
requiredSafeName(CHAINCODE_NAME, 'Fabric chaincode');

const FABRIC_SAMPLES_DIR = path.resolve(
  process.env.FABRIC_SAMPLES_DIR ||
  path.join(os.homedir(), 'fabric', 'fabric-samples')
);
const FABRIC_BIN_DIR = path.resolve(
  process.env.FABRIC_BIN_DIR || path.join(FABRIC_SAMPLES_DIR, 'bin')
);
const FABRIC_CONFIG_PATH = path.resolve(
  process.env.FABRIC_CONFIG_PATH ||
  path.join(FABRIC_SAMPLES_DIR, 'config')
);
const FABRIC_TEST_NETWORK_DIR = path.resolve(
  process.env.FABRIC_TEST_NETWORK_DIR ||
  path.join(FABRIC_SAMPLES_DIR, 'test-network')
);
const PEER_BINARY = path.join(
  FABRIC_BIN_DIR,
  process.platform === 'win32' ? 'peer.exe' : 'peer'
);

const ORDERER_ADDRESS =
  process.env.FABRIC_ORDERER_ADDRESS || 'localhost:7050';
const ORDERER_TLS_HOSTNAME =
  process.env.FABRIC_ORDERER_TLS_HOSTNAME || 'orderer.example.com';
const ORG1_PEER_ADDRESS =
  process.env.FABRIC_ORG1_PEER_ADDRESS || 'localhost:7051';
const ORG2_PEER_ADDRESS =
  process.env.FABRIC_ORG2_PEER_ADDRESS || 'localhost:9051';
const ORDERER_CA = path.resolve(
  process.env.FABRIC_ORDERER_CA ||
  path.join(
    FABRIC_TEST_NETWORK_DIR,
    'organizations',
    'ordererOrganizations',
    'example.com',
    'orderers',
    'orderer.example.com',
    'msp',
    'tlscacerts',
    'tlsca.example.com-cert.pem'
  )
);
const ORG1_PEER_TLS_CERT = path.resolve(
  process.env.FABRIC_ORG1_PEER_TLS_CERT ||
  path.join(
    FABRIC_TEST_NETWORK_DIR,
    'organizations',
    'peerOrganizations',
    'org1.example.com',
    'peers',
    'peer0.org1.example.com',
    'tls',
    'ca.crt'
  )
);
const ORG2_PEER_TLS_CERT = path.resolve(
  process.env.FABRIC_ORG2_PEER_TLS_CERT ||
  path.join(
    FABRIC_TEST_NETWORK_DIR,
    'organizations',
    'peerOrganizations',
    'org2.example.com',
    'peers',
    'peer0.org2.example.com',
    'tls',
    'ca.crt'
  )
);

const IDENTITY_MAP = Object.freeze({
  manufacturer1: 'manufacturer1@org1.example.com',
  certifier1: 'certifier1@org1.example.com',
  transporter1: 'transporter1@org1.example.com',
  warehouse1: 'warehouse1@org1.example.com',
  assembler1: 'assembler1@org1.example.com',
  auditor1: 'auditor1@org1.example.com',
});

const COMMAND_TIMEOUT_MS = Number.isSafeInteger(
  Number(process.env.FABRIC_COMMAND_TIMEOUT_MS)
) && Number(process.env.FABRIC_COMMAND_TIMEOUT_MS) >= 1_000 &&
  Number(process.env.FABRIC_COMMAND_TIMEOUT_MS) <= 300_000
  ? Number(process.env.FABRIC_COMMAND_TIMEOUT_MS)
  : 60_000;
const COMMAND_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const WAIT_FOR_EVENT_TIMEOUT =
  process.env.FABRIC_WAIT_FOR_EVENT_TIMEOUT || '30s';

if (!/^\d+[smh]$/.test(WAIT_FOR_EVENT_TIMEOUT)) {
  throw new Error('Invalid Fabric wait-for-event timeout configuration.');
}

function buildPeerEnvironment(identity) {
  if (!identity) {
    throw new Error('Fabric identity is required.');
  }

  const userName = IDENTITY_MAP[identity];

  if (!userName) {
    throw new Error('Unknown Fabric identity.');
  }

  const mspPath = path.join(
    FABRIC_TEST_NETWORK_DIR,
    'organizations',
    'peerOrganizations',
    'org1.example.com',
    'users',
    userName,
    'msp'
  );

  return {
    ...process.env,
    FABRIC_CFG_PATH: FABRIC_CONFIG_PATH,
    CORE_PEER_TLS_ENABLED: 'true',
    CORE_PEER_LOCALMSPID: 'Org1MSP',
    CORE_PEER_TLS_ROOTCERT_FILE: ORG1_PEER_TLS_CERT,
    CORE_PEER_MSPCONFIGPATH: mspPath,
    CORE_PEER_ADDRESS: ORG1_PEER_ADDRESS,
  };
}

function formatChaincodeArgs(fcn, argsArray = []) {
  if (
    typeof fcn !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9]*$/.test(fcn)
  ) {
    throw new Error('Invalid chaincode function name.');
  }

  if (!Array.isArray(argsArray)) {
    throw new Error('Chaincode arguments must be an array.');
  }

  if (argsArray.some(value =>
    typeof value !== 'string' && typeof value !== 'number' &&
    typeof value !== 'boolean'
  )) {
    throw new Error('Chaincode arguments must be strings or primitive values.');
  }

  return JSON.stringify({
    Args: [fcn, ...argsArray.map(value => String(value))],
  });
}

function buildInvokeArgs(fcn, argsArray) {
  return [
    'chaincode',
    'invoke',
    '-o', ORDERER_ADDRESS,
    '--ordererTLSHostnameOverride', ORDERER_TLS_HOSTNAME,
    '--tls',
    '--cafile', ORDERER_CA,
    '-C', CHANNEL_NAME,
    '-n', CHAINCODE_NAME,
    '--peerAddresses', ORG1_PEER_ADDRESS,
    '--tlsRootCertFiles', ORG1_PEER_TLS_CERT,
    '--peerAddresses', ORG2_PEER_ADDRESS,
    '--tlsRootCertFiles', ORG2_PEER_TLS_CERT,
    '--waitForEvent',
    '--waitForEventTimeout', WAIT_FOR_EVENT_TIMEOUT,
    '-c', formatChaincodeArgs(fcn, argsArray),
  ];
}

function buildQueryArgs(fcn, argsArray) {
  return [
    'chaincode',
    'query',
    '-C', CHANNEL_NAME,
    '-n', CHAINCODE_NAME,
    '-c', formatChaincodeArgs(fcn, argsArray),
  ];
}

function execFabricPeer(args, identity) {
  if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string')) {
    return Promise.reject(new Error('Invalid Fabric CLI argument list.'));
  }

  return new Promise((resolve, reject) => {
    execFile(
      PEER_BINARY,
      args,
      {
        cwd: FABRIC_SAMPLES_DIR,
        env: buildPeerEnvironment(identity),
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: COMMAND_MAX_BUFFER_BYTES,
        killSignal: 'SIGTERM',
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          const details = String(stderr || stdout || error.message || '')
            .trim();
          const failure = new Error(details || 'Fabric CLI command failed.');
          failure.code = error.code;
          failure.signal = error.signal;
          return reject(failure);
        }

        resolve(String(stdout || '').trim());
      }
    );
  });
}

/**
 * Check Fabric Network and Chaincode Health.
 * Queries the configured Fabric peer and channel.
 */
async function checkFabricConnection() {
  try {
    const output = await execFabricPeer(
      ['lifecycle', 'chaincode', 'querycommitted', '-C', CHANNEL_NAME],
      HEALTH_IDENTITY
    );

    if (output.includes(CHAINCODE_NAME)) {
      return {
        connected: true,
        network: CHANNEL_NAME,
        chaincode: CHAINCODE_NAME,
        identity: HEALTH_IDENTITY,
        details: FABRIC_DETAILS,
      };
    }

    return {
      connected: false,
      error: `Chaincode '${CHAINCODE_NAME}' is not deployed on channel '${CHANNEL_NAME}'. Committed chaincodes: ${output || 'None'}`,
      network: CHANNEL_NAME,
      chaincode: CHAINCODE_NAME,
      details: FABRIC_DETAILS,
    };
  } catch (err) {
    return {
      connected: false,
      error: `Fabric Peer connection failed: ${err.message}`,
      network: CHANNEL_NAME,
      chaincode: CHAINCODE_NAME,
      details: FABRIC_DETAILS,
    };
  }
}

const FABRIC_DETAILS = {
  peer: ORG1_PEER_ADDRESS,
  mspId: 'Org1MSP',
  orderer: ORDERER_ADDRESS,
  channel: CHANNEL_NAME,
  chaincode: CHAINCODE_NAME,
};

async function createComponentOnLedger(
  { componentID, componentType, manufacturer, manufactureDate, location },
  identity
) {
  const output = await execFabricPeer(
    buildInvokeArgs('CreateComponent', [
      componentID,
      componentType,
      manufacturer,
      manufactureDate,
      location,
    ]),
    identity
  );

  if (output.includes('status:500') || output.includes('Error:')) {
    if (output.includes('already exists')) {
      throw new Error(`Component already exists: ${componentID}`);
    }

    throw new Error(`Chaincode invocation failed: ${output}`);
  }

  let txId;

  // The invoke waits for commit before returning. Resolve the committed
  // transaction from immutable component history for evidence display.
  try {
    txId = await getLatestTransactionId(componentID, identity);
  } catch (err) {
    // Do not make a committed registration appear unsuccessful because
    // the follow-up evidence lookup was temporarily unavailable.
    console.warn(
      `Fabric transaction evidence lookup failed for ${componentID}:`,
      err.message
    );
  }

  return {
    componentID,
    componentType,
    manufacturer,
    manufactureDate,
    location,
    status: 'MANUFACTURED',
    txId,
  };
}

async function getComponentFromLedger(componentID, identity) {
  const output = await execFabricPeer(
    buildQueryArgs('GetComponent', [componentID]),
    identity
  );

  if (!output || output.includes('Error:') || output.includes('not found')) {
    throw new Error(`Component not found: ${componentID}`);
  }

  try {
    return JSON.parse(output);
  } catch {
    return { componentID, raw: output };
  }
}

async function invokeChaincode(fcn, argsArray, identity) {
  if (!Array.isArray(argsArray) || !argsArray[0]) {
    throw new Error('Component ID was not provided.');
  }

  const output = await execFabricPeer(
    buildInvokeArgs(fcn, argsArray),
    identity
  );

  let txId;

  try {
    txId = await getLatestTransactionId(argsArray[0], identity);
  } catch (err) {
    // The ledger mutation has already committed; transaction evidence lookup
    // must not make the mutation itself appear unsuccessful.
    console.warn(
      `Fabric transaction evidence lookup failed for ${fcn} / ${argsArray[0]}:`,
      err.message
    );
  }

  return {
    output,
    txId,
  };
}

async function queryChaincode(fcn, argsArray, identity) {
  return execFabricPeer(
    buildQueryArgs(fcn, argsArray),
    identity
  );
}

async function getLatestTransactionId(componentID, identity) {
  const attempts = 5;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const historyOutput = await queryChaincode(
        'GetComponentHistory',
        [componentID],
        identity
      );

      const history = JSON.parse(historyOutput);

      if (!Array.isArray(history) || history.length === 0) {
        throw new Error('Fabric transaction history was not returned.');
      }

      const latest = [...history]
        .filter(entry => entry && entry.txId)
        .sort((a, b) => {
          const aTime = Date.parse(a.timestamp || '') || 0;
          const bTime = Date.parse(b.timestamp || '') || 0;
          return bTime - aTime;
        })[0];

      if (!latest?.txId) {
        throw new Error('Fabric transaction ID was not returned.');
      }

      return latest.txId;
    } catch (err) {
      lastError = err;

      if (attempt < attempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 250));
      }
    }
  }

  throw lastError || new Error('Fabric transaction evidence was not available.');
}

module.exports = {
  checkFabricConnection,
  createComponentOnLedger,
  getComponentFromLedger,
  invokeChaincode,
  queryChaincode,
  getLatestTransactionId,
  // Exported for unit tests; these are pure argument/environment builders.
  __test: {
    formatChaincodeArgs,
    buildInvokeArgs,
    buildQueryArgs,
    buildPeerEnvironment,
  },
};
