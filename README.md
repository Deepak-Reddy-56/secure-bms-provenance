# Secure BMS Component Provenance

Day 1 implementation for the **Secure Blockchain for Component Provenance** problem using Hyperledger Fabric.

The Day 1 goal is simple:

```text
Create Component
      ↓
Store on Fabric Ledger
      ↓
Get Component
      ↓
Display Component
```

## Day 1 Component

| Field | Value |
|---|---|
| Component ID | `BMS-2026-001` |
| Component Type | BMS Controller |
| Manufacturer | EVTech Manufacturing |
| Manufacturing Date | 24-09-2026 |
| Location | Bengaluru |
| Status | MANUFACTURED |

## Technology

- Hyperledger Fabric 2.5.16
- Hyperledger Fabric CA 1.5.17
- JavaScript chaincode
- Node.js 20.x
- npm
- Docker Desktop
- Fabric test network
- Channel: `mychannel`

**Go is not required for this project.** We are using JavaScript chaincode.

---

# Setup for Windows

## Step 1: Install WSL2

Open **PowerShell as Administrator** and run:

```powershell
wsl --install -d Ubuntu-24.04
```

Restart Windows if prompted.

After restarting, open **Ubuntu** from the Start menu and complete the first-time setup by creating your Linux username and password.

Check that WSL is using version 2:

```powershell
wsl -l -v
```

Your Ubuntu distribution should show **VERSION 2**.

Microsoft documents `wsl --install` for installing WSL and allows a distribution to be selected with `-d`. urlMicrosoft WSL installation guidehttps://learn.microsoft.com/en-us/windows/wsl/install

## Step 2: Install Docker Desktop

Download and install **Docker Desktop for Windows**.

After installation:

1. Open Docker Desktop.
2. Go to **Settings → General**.
3. Make sure **Use WSL 2 based engine** is enabled.
4. Go to **Settings → Resources → WSL Integration**.
5. Enable integration for your Ubuntu distribution.

Docker's Windows documentation recommends Docker Desktop with the WSL 2 backend and WSL integration. urlDocker Desktop + WSL2https://docs.docker.com/desktop/features/wsl/

Close and reopen Ubuntu after enabling integration.

## Step 3: Install Git, cURL and jq inside Ubuntu

Run these commands **inside Ubuntu**, not PowerShell:

```bash
sudo apt update
sudo apt install -y git curl jq
```

Check:

```bash
git --version
curl --version
jq --version
docker --version
docker compose version
```

## Step 4: Install Node.js 20

We use NVM so Node is installed inside WSL rather than using the Windows Node installation.

Run:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
source ~/.bashrc
```

Verify NVM:

```bash
command -v nvm
```

Install Node 20:

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

Verify:

```bash
node --version
npm --version
which node
which npm
```

The Node path should point to your WSL/NVM installation, for example:

```text
/home/<username>/.nvm/versions/node/v20.x.x/bin/node
```

NVM supports macOS, Unix/Linux and Windows WSL. urlNVM projecthttps://github.com/nvm-sh/nvm

## Step 5: Install Hyperledger Fabric

Create the Fabric workspace:

```bash
mkdir -p ~/fabric
cd ~/fabric
```

Download the official Fabric installer:

```bash
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
```

Install Fabric binaries, Docker images and samples:

```bash
./install-fabric.sh docker binary samples
```

The current installer defaults to Fabric **2.5.16** and Fabric CA **1.5.17**. It also detects the machine architecture automatically. urlOfficial Fabric installerhttps://github.com/hyperledger/fabric/blob/main/scripts/install-fabric.sh

The installer may print:

```text
fabric-samples v2.5.16 does not exist, defaulting to main
```

This is expected with the current installer. For this project, use the normal Raft test-network commands below and **do not use the BFT option**.

Verify Fabric:

```bash
cd ~/fabric/fabric-samples
./bin/peer version
```

Expected:

```text
Version: v2.5.16
```

---

# Setup for MacBook

These instructions work for both **Apple Silicon (M1/M2/M3/M4)** and **Intel** Macs. The Fabric installer automatically detects the architecture.

## Step 1: Install Homebrew

Open **Terminal**:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install the basic tools:

```bash
brew install git curl jq
```

Check:

```bash
brew --version
git --version
curl --version
jq --version
```

Hyperledger Fabric's prerequisites documentation recommends Homebrew for macOS. urlFabric prerequisites for macOShttps://github.com/hyperledger/fabric/blob/main/docs/source/prereqs.md

## Step 2: Install Docker Desktop

Install **Docker Desktop for Mac**.

You can use Homebrew:

```bash
brew install --cask docker
```

Open Docker Desktop:

```bash
open -a Docker
```

Wait until Docker Desktop reports that Docker is running.

Verify:

```bash
docker --version
docker compose version
```

Docker provides separate downloads for Apple Silicon and Intel Macs; use the build matching the Mac's processor. urlDocker Desktop for Machttps://docs.docker.com/desktop/setup/install/mac-install/

## Step 3: Install Node.js 20

Install NVM:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```

Close and reopen Terminal, or load the shell configuration:

```bash
source ~/.zshrc
```

Verify:

```bash
command -v nvm
```

Install Node 20:

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

Verify:

```bash
node --version
npm --version
which node
which npm
```

## Step 4: Install Hyperledger Fabric

Create the workspace:

```bash
mkdir -p ~/fabric
cd ~/fabric
```

Download the installer:

```bash
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
```

Install Fabric:

```bash
./install-fabric.sh docker binary samples
```

Verify:

```bash
cd ~/fabric/fabric-samples
./bin/peer version
```

Expected:

```text
Version: v2.5.16
```

The official installer detects Intel `x86_64` and Apple Silicon `arm64` automatically. urlOfficial Fabric installerhttps://github.com/hyperledger/fabric/blob/main/scripts/install-fabric.sh

---

# After the setup: Get this project

These steps are the same on **Windows/WSL and Mac**.

Create or use the Fabric workspace:

```bash
mkdir -p ~/fabric
cd ~/fabric
```

Clone this repository:

```bash
git clone https://github.com/Deepak-Reddy-56/secure-bms-provenance.git bms-provenance
```

Enter the project:

```bash
cd ~/fabric/bms-provenance
```

Your workspace should look like:

```text
~/fabric/
├── fabric-samples/
└── bms-provenance/
    ├── chaincode/
    ├── .gitignore
    └── README.md
```

**Do not put the project under `/mnt/c/...` when using WSL.** Keep it under `~/fabric`.

---

# Install the project dependencies

Go to the JavaScript chaincode directory:

```bash
cd ~/fabric/bms-provenance/chaincode/javascript
```

Install npm dependencies:

```bash
npm install
```

Verify:

```bash
npm list fabric-contract-api fabric-shim
```

The project currently uses the Fabric 2.5 Node packages.

---

# Start the Fabric network

Go to the Fabric test network:

```bash
cd ~/fabric/fabric-samples/test-network
```

Start the network, create the channel and enable Certificate Authorities:

```bash
./network.sh up createChannel -c mychannel -ca
```

Verify that Fabric is running:

```bash
docker ps
```

You should see Fabric containers for the peers, orderer and Certificate Authorities.

Optional health check for Org1 peer:

```bash
curl -s http://localhost:9444/healthz
```

A healthy peer returns a response containing:

```json
{"status":"OK"}
```

The Fabric test network provides two peer organizations and an ordering service, and it can be used to deploy and test your own chaincode. urlFabric test network documentationhttps://github.com/hyperledger/fabric-samples/blob/main/test-network/README.md

---

# Deploy the BMS chaincode

From the Fabric test-network directory:

```bash
cd ~/fabric/fabric-samples/test-network
```

Deploy:

```bash
./network.sh deployCC \
  -ccn bmsprovenance \
  -ccp ../../bms-provenance/chaincode/javascript \
  -ccl javascript
```

The Fabric test-network script packages the chaincode, installs it on the peers, approves it for the organizations and commits the chaincode definition to the channel. urlFabric chaincode deployment documentationhttps://github.com/hyperledger/fabric/blob/main/docs/source/write_first_app.rst

---

# Day 1 Chaincode

## CreateComponent()

Inputs:

```text
componentID
componentType
manufacturer
manufactureDate
location
```

The smart contract automatically sets:

```text
status = MANUFACTURED
```

## GetComponent()

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

---

# Required Day 1 Test Cases

## Test 1: Register the component

Use:

```text
Component ID: BMS-2026-001
Component Type: BMS Controller
Manufacturer: EVTech Manufacturing
Manufacturing Date: 24-09-2026
Location: Bengaluru
```

Expected:

```text
SUCCESS
Component registered.
```

## Test 2: Retrieve the component

```text
GetComponent("BMS-2026-001")
```

Expected:

```text
Component ID       : BMS-2026-001
Component Type     : BMS Controller
Manufacturer       : EVTech Manufacturing
Manufacturing Date : 24-09-2026
Location            : Bengaluru
Status              : MANUFACTURED
```

## Test 3: Duplicate ID

Try to register:

```text
BMS-2026-001
```

again.

Expected:

```text
ERROR
Component already exists.
```

## Test 4: Component not found

Search for:

```text
BMS-999
```

Expected:

```text
ERROR
Component not found.
```

---

# Useful Commands

### Check Fabric

```bash
cd ~/fabric/fabric-samples
./bin/peer version
```

### Check Docker

```bash
docker ps
```

### Stop the Fabric test network

```bash
cd ~/fabric/fabric-samples/test-network
./network.sh down
```

### Start it again

```bash
cd ~/fabric/fabric-samples/test-network
./network.sh up createChannel -c mychannel -ca
```

### Check project Git status

```bash
cd ~/fabric/bms-provenance
git status
```

---

# Files that must NOT be committed

Do not commit:

```text
node_modules/
.env
organizations/
channel-artifacts/
*.tar.gz
```

Each developer should generate their own local Fabric network and cryptographic material.

The repository contains our **BMS application and chaincode source**. Hyperledger Fabric itself is installed separately on each developer's machine.

---

# Official References

- Hyperledger Fabric: https://github.com/hyperledger/fabric
- Fabric Samples: https://github.com/hyperledger/fabric-samples
- Fabric prerequisites: https://github.com/hyperledger/fabric/blob/main/docs/source/prereqs.md
- Fabric test network: https://github.com/hyperledger/fabric-samples/tree/main/test-network
- Docker Desktop for Windows + WSL2: https://docs.docker.com/desktop/features/wsl/
- Docker Desktop for Mac: https://docs.docker.com/desktop/setup/install/mac-install/
- Microsoft WSL: https://learn.microsoft.com/en-us/windows/wsl/install
- NVM: https://github.com/nvm-sh/nvm
