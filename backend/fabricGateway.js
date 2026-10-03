const { exec } = require('child_process');

const CHANNEL_NAME = process.env.FABRIC_CHANNEL || 'mychannel';
const CHAINCODE_NAME = process.env.FABRIC_CHAINCODE || 'bmsprovenance';
const HEALTH_IDENTITY = 'auditor1';

// Helper function to execute WSL peer CLI commands cleanly
function execWSLPeer(command, identity) {
  return new Promise((resolve, reject) => {
    const identityMap = {
      manufacturer1: 'manufacturer1@org1.example.com',
      certifier1: 'certifier1@org1.example.com',
      transporter1: 'transporter1@org1.example.com',
      warehouse1: 'warehouse1@org1.example.com',
      assembler1: 'assembler1@org1.example.com',
      auditor1: 'auditor1@org1.example.com',
    };

    if (!identity) {
      return reject(new Error('Fabric identity is required.'));
    }

    if (!identityMap[identity]) {
      return reject(
        new Error(`Unknown Fabric identity: ${identity}`)
      );
    }

    const mspPath =
      `/home/deepak/fabric/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/${identityMap[identity]}/msp`;

    const env = {
      ...process.env,
      FABRIC_CFG_PATH:
        '/home/deepak/fabric/fabric-samples/config',
      CORE_PEER_TLS_ENABLED: 'true',
      CORE_PEER_LOCALMSPID: 'Org1MSP',
      CORE_PEER_TLS_ROOTCERT_FILE:
        '/home/deepak/fabric/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt',
      CORE_PEER_MSPCONFIGPATH: mspPath,
      CORE_PEER_ADDRESS: 'localhost:7051',
    };

    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        return reject(
          new Error(stderr || stdout || error.message)
        );
      }

      resolve(stdout.trim());
    });
  });
}

/**
 * Check Fabric Network and Chaincode Health.
 * Actually queries the Hyperledger Fabric peer and channel.
 */
async function checkFabricConnection() {
  try {
    // 1. Query committed chaincode definition on channel
const output = await execWSLPeer(
  `/home/deepak/fabric/fabric-samples/bin/peer lifecycle chaincode querycommitted -C ${CHANNEL_NAME}`,
  HEALTH_IDENTITY
);

    if (output.includes(CHAINCODE_NAME)) {
      return {
        connected: true,
        network: CHANNEL_NAME,
        chaincode: CHAINCODE_NAME,
        identity: HEALTH_IDENTITY,
        details: {
          peer: 'peer0.org1.example.com:7051',
          mspId: 'Org1MSP',
          orderer: 'orderer.example.com:7050',
          channel: CHANNEL_NAME,
          chaincode: CHAINCODE_NAME,
        },
      };
    } else {
      return {
        connected: false,
        error: `Chaincode '${CHAINCODE_NAME}' is not deployed on channel '${CHANNEL_NAME}'. Committed chaincodes: ${output || 'None'}`,
        network: CHANNEL_NAME,
        chaincode: CHAINCODE_NAME,
      };
    }
  } catch (err) {
    return {
      connected: false,
      error: `Fabric Peer connection failed: ${err.message}`,
      network: CHANNEL_NAME,
      chaincode: CHAINCODE_NAME,
    };
  }
}

function formatChaincodeArgs(fcn, argsArray = []) {
  const jsonStr = JSON.stringify({ Args: [fcn, ...argsArray] });
  const escaped = jsonStr.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

/**
 * Create a component on the Fabric ledger by invoking CreateComponent smart contract method.
 */
async function createComponentOnLedger({ componentID, componentType, manufacturer, manufactureDate, location }, identity) {
  const cArg = formatChaincodeArgs('CreateComponent', [componentID, componentType, manufacturer, manufactureDate, location]);

  const cmd = `/home/deepak/fabric/fabric-samples/bin/peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile /home/deepak/fabric/fabric-samples/test-network/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} --peerAddresses localhost:7051 --tlsRootCertFiles /home/deepak/fabric/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt --peerAddresses localhost:9051 --tlsRootCertFiles /home/deepak/fabric/fabric-samples/test-network/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt --waitForEvent --waitForEventTimeout 30s -c ${cArg}`;

  const output = await execWSLPeer(cmd, identity);

  if (output.includes('status:500') || output.includes('Error:')) {
    if (output.includes('already exists')) {
      throw new Error(`Component already exists: ${componentID}`);
    }
    throw new Error(`Chaincode invocation failed: ${output}`);
  }

  let txId;

  // The invoke waits for commit before returning. Resolve the committed
  // transaction from the component's immutable history for evidence display.
  try {
    txId = await getLatestTransactionId(componentID, identity);
  } catch (err) {
    // Do not convert a committed registration into a failed registration
    // merely because the follow-up evidence lookup was temporarily unavailable.
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

/**
 * Retrieve a component from the Fabric ledger by querying GetComponent smart contract method.
 */
async function getComponentFromLedger(componentID, identity) {
  const cArg = formatChaincodeArgs('GetComponent', [componentID]);

  const cmd = `/home/deepak/fabric/fabric-samples/bin/peer chaincode query -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c ${cArg}`;

  const output = await execWSLPeer(cmd, identity);

  if (!output || output.includes('Error:') || output.includes('not found')) {
    throw new Error(`Component not found: ${componentID}`);
  }

  try {
    return JSON.parse(output);
  } catch {
    return { componentID, raw: output };
  }
}

/**
 * Generic chaincode invoke / query helper for Day 2 operations.
 */
async function invokeChaincode(fcn, argsArray, identity) {
  const cArg = formatChaincodeArgs(fcn, argsArray);

  const cmd = `/home/deepak/fabric/fabric-samples/bin/peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile /home/deepak/fabric/fabric-samples/test-network/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} --peerAddresses localhost:7051 --tlsRootCertFiles /home/deepak/fabric/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt --peerAddresses localhost:9051 --tlsRootCertFiles /home/deepak/fabric/fabric-samples/test-network/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt --waitForEvent --waitForEventTimeout 30s -c ${cArg}`;

  const output = await execWSLPeer(cmd, identity);
const componentID = argsArray[0];

if (!componentID) {
  throw new Error('Component ID was not provided.');
}

let txId;

try {
  txId = await getLatestTransactionId(componentID, identity);
} catch (err) {
  // The ledger mutation has already committed; transaction evidence lookup
  // should not make the mutation itself appear unsuccessful.
  console.warn(
    `Fabric transaction evidence lookup failed for ${fcn} / ${componentID}:`,
    err.message
  );
}

return {
  output,
  txId,
};
}

/**
 * Query a chaincode method without creating a ledger transaction.
 */
async function queryChaincode(fcn, argsArray, identity) {
  const cArg = formatChaincodeArgs(fcn, argsArray);

  const cmd = `/home/deepak/fabric/fabric-samples/bin/peer chaincode query -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c ${cArg}`;

  return await execWSLPeer(cmd, identity);
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
};
