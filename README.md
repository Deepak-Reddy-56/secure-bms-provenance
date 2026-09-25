# Secure BMS Component Provenance

Day 1 implementation for the **Secure Blockchain for Component Provenance** problem statement using Hyperledger Fabric.

## Day 1 Scope

Today's implementation covers only:

```text
Manufacturer
    ↓
CreateComponent()
    ↓
Fabric Ledger
    ↓
GetComponent()
    ↓
Display Component Details
```

Later milestones will add certification, transportation, warehouse custody, assembly, and full provenance verification.

## Technology Stack

- Hyperledger Fabric 2.5.16
- Hyperledger Fabric CA 1.5.17
- JavaScript chaincode
- Node.js 20.x
- npm
- Docker Desktop + WSL2
- Fabric test network
- Channel: `mychannel`

## Component Used for Day 1

| Field | Value |
|---|---|
| Component ID | `BMS-2026-001` |
| Component Type | BMS Controller |
| Manufacturer | EVTech Manufacturing |
| Manufacturing Date | 24-09-2026 |
| Location | Bengaluru |
| Initial Status | MANUFACTURED |

## Prerequisites

Each team member should have:

- Windows with WSL2
- Ubuntu/Ubuntu-CloudStorm
- Docker Desktop with WSL integration enabled
- Git
- Node.js 20.x
- npm

Verify:

```bash
docker --version
docker compose version
git --version
node --version
npm --version
```

For Node.js, use Linux Node inside WSL. With NVM:

```bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

node --version
npm --version
```

The Node executable should come from the WSL/NVM installation, for example:

```text
/home/<user>/.nvm/versions/node/v20.x.x/bin/node
```

## 1. Get the Project

Clone the repository inside the WSL Linux filesystem:

```bash
mkdir -p ~/fabric
cd ~/fabric

git clone https://github.com/Deepak-Reddy-56/secure-bms-provenance.git bms-provenance
cd bms-provenance
```

Do not clone the project under `/mnt/c/...` for development.

## 2. Install Chaincode Dependencies

```bash
cd ~/fabric/bms-provenance/chaincode/javascript
npm install
```

This installs the dependencies listed in `package.json`, including:

- `fabric-contract-api`
- `fabric-shim`

The `node_modules` directory is intentionally not committed to Git.

## 3. Get Hyperledger Fabric

If Fabric is not already installed on the teammate's machine, install the same Fabric version used by this project:

```bash
mkdir -p ~/fabric
cd ~/fabric

curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh

./install-fabric.sh docker binary samples
```

Verify:

```bash
cd ~/fabric/fabric-samples
./bin/peer version
```

Expected Fabric version:

```text
v2.5.16
```

## 4. Start the Fabric Network

Use the Fabric test network supplied in `fabric-samples`:

```bash
cd ~/fabric/fabric-samples/test-network

./network.sh up createChannel -c mychannel -ca
```

Verify the network:

```bash
docker ps
```

You should see Fabric containers including peers, orderer, and CAs.

Optional peer health check:

```bash
curl -s http://localhost:9444/healthz
```

Expected:

```json
{"status":"OK", ...}
```

## 5. Deploy BMS Chaincode

From the Fabric test-network directory:

```bash
cd ~/fabric/fabric-samples/test-network

./network.sh deployCC \
  -ccn bmsprovenance \
  -ccp ../../bms-provenance/chaincode/javascript \
  -ccl javascript
```

This deploys the project's JavaScript chaincode to `mychannel`.

## 6. Chaincode Functions

### CreateComponent()

Inputs:

```text
componentID
componentType
manufacturer
manufactureDate
location
```

The chaincode automatically sets:

```text
status = MANUFACTURED
```

### GetComponent()

Input:

```text
componentID
```

Returns:

```text
componentID
componentType
manufacturer
manufactureDate
location
status
```

## 7. Required Day 1 Tests

The implementation must support these cases.

### Register Component

```text
BMS-2026-001
```

Expected:

```text
SUCCESS
Component registered.
```

### Retrieve Component

```text
GetComponent("BMS-2026-001")
```

Expected component:

```text
Component ID       : BMS-2026-001
Component Type     : BMS Controller
Manufacturer       : EVTech Manufacturing
Manufacturing Date : 24-09-2026
Location            : Bengaluru
Status              : MANUFACTURED
```

### Duplicate ID

Attempt to register `BMS-2026-001` again.

Expected:

```text
ERROR
Component already exists.
```

### Non-existent ID

Search for:

```text
BMS-999
```

Expected:

```text
ERROR
Component not found.
```

## Project Structure

```text
bms-provenance/
├── chaincode/
│   └── javascript/
│       ├── index.js
│       ├── package.json
│       ├── package-lock.json
│       └── lib/
│           └── bmsContract.js
├── .gitignore
└── README.md
```

## Important

Do not commit:

```text
node_modules/
.env
organizations/
channel-artifacts/
*.tar.gz
```

Each developer should generate their own local Fabric network and cryptographic material.

The repository contains the application/chaincode source; the Fabric network itself is created locally from `fabric-samples`.

## Useful Commands

Stop the Fabric test network:

```bash
cd ~/fabric/fabric-samples/test-network
./network.sh down
```

Check running Fabric containers:

```bash
docker ps
```

Check installed chaincode on Org1:

```bash
cd ~/fabric/fabric-samples/test-network
peer lifecycle chaincode queryinstalled
```

Check Git state:

```bash
cd ~/fabric/bms-provenance
git status
```
