const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHANNEL_NAME = process.env.FABRIC_CHANNEL || 'mychannel';
const CHAINCODE_NAME = process.env.FABRIC_CHAINCODE || 'bmsprovenance';
const DEFAULT_IDENTITY = 'manufacturer1';

// Helper function to execute WSL peer CLI commands cleanly
function execWSLPeer(command) {
  return new Promise((resolve, reject) => {
    const scriptContent = `#!/bin/bash
export FABRIC_CFG_PATH=/home/dani16/fabric-samples/config
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE=/home/dani16/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/home/dani16/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
${command}
`;
    const tmpFile = path.join(__dirname, 'tmp_cmd.sh');
    fs.writeFileSync(tmpFile, scriptContent, { encoding: 'utf8' });

    const wslScriptPath = tmpFile.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);

    exec(`wsl -d Ubuntu-22.04 bash "${wslScriptPath}"`, (error, stdout, stderr) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (error) {
        return reject(new Error(stderr || stdout || error.message));
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
    const output = await execWSLPeer(`/home/dani16/fabric-samples/bin/peer lifecycle chaincode querycommitted -C ${CHANNEL_NAME}`);

    if (output.includes(CHAINCODE_NAME)) {
      return {
        connected: true,
        network: CHANNEL_NAME,
        chaincode: CHAINCODE_NAME,
        identity: DEFAULT_IDENTITY,
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
async function createComponentOnLedger({ componentID, componentType, manufacturer, manufactureDate, location }, identity = DEFAULT_IDENTITY) {
  const cArg = formatChaincodeArgs('CreateComponent', [componentID, componentType, manufacturer, manufactureDate, location]);

  const cmd = `/home/dani16/fabric-samples/bin/peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile /home/dani16/fabric-samples/test-network/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} --peerAddresses localhost:7051 --tlsRootCertFiles /home/dani16/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt --peerAddresses localhost:9051 --tlsRootCertFiles /home/dani16/fabric-samples/test-network/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt -c ${cArg}`;

  const output = await execWSLPeer(cmd);

  if (output.includes('status:500') || output.includes('Error:')) {
    if (output.includes('already exists')) {
      throw new Error(`Component already exists: ${componentID}`);
    }
    throw new Error(`Chaincode invocation failed: ${output}`);
  }

  // Parse transaction ID from peer output if available
  let txId = 'tx-' + Date.now();
  const txMatch = output.match(/txid \[([a-f0-9]+)\]/i);
  if (txMatch) {
    txId = txMatch[1];
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
async function getComponentFromLedger(componentID, identity = DEFAULT_IDENTITY) {
  const cArg = formatChaincodeArgs('GetComponent', [componentID]);

  const cmd = `/home/dani16/fabric-samples/bin/peer chaincode query -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} -c ${cArg}`;

  const output = await execWSLPeer(cmd);

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
async function invokeChaincode(fcn, argsArray, identity = DEFAULT_IDENTITY) {
  const cArg = formatChaincodeArgs(fcn, argsArray);

  const cmd = `/home/dani16/fabric-samples/bin/peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile /home/dani16/fabric-samples/test-network/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME} --peerAddresses localhost:7051 --tlsRootCertFiles /home/dani16/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt -c ${cArg}`;

  return await execWSLPeer(cmd);
}

module.exports = {
  checkFabricConnection,
  createComponentOnLedger,
  getComponentFromLedger,
  invokeChaincode,
};
