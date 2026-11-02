# Secure BMS Component Provenance

A role-based component lifecycle and provenance application built with React, Node.js, MongoDB Atlas and Hyperledger Fabric.

The application records a component's lifecycle on a permissioned Fabric ledger and provides role-specific workflows for the manufacturer, certifier, transporter, warehouse, assembler and auditor.

## Contributed By
- Deepak Reddy - 2460356
  
- Richa Felix - 2460431

- Nevin John Alex - 2460414

- Karthick Raja K - 2460388

- Daniel J - 2462510 

## Under The Guidance Of 
- Dr. Jenefa J - jenefa.j@christuniversity.in
  
- Dr. Gokula Priya - r.gokulapriya@christuniversity.in

## Contents

- [Overview](#overview)
- [Architecture and technology](#architecture-and-technology)
- [Component, shipment and assembly IDs](#component-shipment-and-assembly-ids)
- [Prerequisites](#prerequisites)
- [Install Fabric and clone the project](#install-fabric-and-clone-the-project)
- [Configure MongoDB Atlas](#configure-mongodb-atlas)
- [Configure Google sign-in](#configure-google-sign-in)
- [Configure environment variables](#configure-environment-variables)
- [Create the Fabric network and identities](#create-the-fabric-network-and-identities)
- [Install dependencies and run the application](#install-dependencies-and-run-the-application)
- [GitHub Codespaces demo setup](#github-codespaces-demo-setup)
- [Resume an existing Codespace](#resume-an-existing-codespace)
- [Tests and build](#tests-and-build)
- [Troubleshooting](#troubleshooting)
- [Security and data persistence](#security-and-data-persistence)

---

## Overview

### Lifecycle workflow

~~~text
Manufacturer
    |
    | Register component
    v
MANUFACTURED
    |
    | Certifier approves
    v
CERTIFIED
    |
    | Transporter ships
    v
SHIPPED
    |
    | Warehouse receives
    v
RECEIVED
    |
    | Warehouse transfers custody to assembler
    v
TRANSFERRED
    |
    | Assigned assembler completes assembly
    v
ASSEMBLED
~~~

### Roles and responsibilities

| Role | Main capabilities |
|---|---|
| Administrator | Provision and manage operational accounts, manage component types and locations, view Fabric network status and configuration |
| Manufacturer | Register a component and view its provenance |
| Certifier | Certify a manufactured component |
| Transporter | Ship a certified component |
| Warehouse | Receive a shipment and transfer custody to the assigned assembler |
| Assembler | Assemble a component after custody has been transferred |
| Auditor | Read-only audit history and transaction evidence |

Each operational role is assigned to a Fabric identity. The current implementation permits one provisioned account per operational role because each role maps to one configured Fabric identity.

The administrator is identified by the email configured in ADMIN_EMAIL. The administrator is not an operational Fabric role.

### Main features

- Google Sign-In with server-side ID-token verification and HttpOnly session cookies.
- MongoDB-backed users, sessions, component-type registry and location registry.
- Fabric chaincode enforcement of role permissions and lifecycle transitions.
- Administrator-controlled component type codes and location codes.
- System-generated component, shipment and assembly identifiers.
- Component history, provenance validation and auditor transaction evidence.
- Role-scoped API endpoints and read-only auditor access.

## Architecture and technology

~~~text
React + TypeScript + Vite
          |
          | REST API / session cookie
          v
Node.js backend
     |             |
     |             +------ MongoDB Atlas
     |                     Users, sessions,
     |                     component types, locations
     |
     +-------------------- Hyperledger Fabric CLI
                              |
                              v
                       Fabric peers + orderer
                              |
                              v
                       BMS JavaScript chaincode
                              |
                              v
                       Permissioned ledger
~~~

| Component | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js HTTP API |
| Authentication | Google Identity Services and google-auth-library |
| Operational database | MongoDB Atlas |
| Blockchain | Hyperledger Fabric 2.5.x |
| Certificate Authority | Hyperledger Fabric CA 1.5.x |
| Smart contract | JavaScript chaincode using fabric-contract-api and fabric-shim |
| Local network | Fabric test network with Docker |
| Channel | mychannel |
| Chaincode | bmsprovenance |

The project was tested with Hyperledger Fabric 2.5.16 and Fabric CA 1.5.17. JavaScript chaincode is used; Go is not required to develop this chaincode.

## Component, shipment and assembly IDs

Identifiers are generated and validated by the application. Users cannot supply arbitrary IDs during normal component registration.

### Component ID

Canonical format:

~~~text
BMS-{TYPE4}-{NUMBER2}{DDMMYY}{SERIAL3}
~~~

Example:

~~~text
BMS-MOTH-01300926001
~~~

| Segment | Meaning |
|---|---|
| BMS | System prefix |
| MOTH | Four-letter component type code configured by the administrator |
| 01 | Two-digit component number configured by the administrator |
| 300926 | Manufacture date in DDMMYY format |
| 001 | Three-digit serial number, allocated from 001 |

The component type registry controls the type name, four-letter code and two-digit component number. Codes and component numbers must be unique.

### Shipment ID

Canonical format:

~~~text
SHIP-{TYPE4}-{NUMBER2}{DDMMYY}-{FROM}-{TO}
~~~

Example:

~~~text
SHIP-MOTH-01300926-BNG-MYS
~~~

The origin and destination codes come from the administrator-managed location registry. Each location has a name, a two-to-four-letter code and a six-digit pincode.

### Assembly ID

Assembly IDs are derived from the registered component ID:

~~~text
ASSY-{TYPE4}-{NUMBER2}{DDMMYY}{SERIAL3}
~~~

Example:

~~~text
ASSY-MOTH-01300926001
~~~

The certificate ID is generated by the backend as CERT-{COMPONENT_ID}.

---

## Prerequisites

Install the following before starting:

- Git
- Node.js 20.x and npm
- Docker Engine and Docker Compose, or Docker Desktop
- Hyperledger Fabric binaries, samples and Docker images
- MongoDB Atlas cluster and database user
- Google Cloud project with a Web OAuth client

### Windows

Use Ubuntu under WSL 2. Do not run Fabric commands from PowerShell.

~~~powershell
wsl --install -d Ubuntu-24.04
wsl -l -v
~~~

Install Docker Desktop for Windows and enable:

1. Use the WSL 2 based engine.
2. Docker Desktop Settings → Resources → WSL Integration.
3. Integration for the Ubuntu distribution being used.

Restart the Ubuntu terminal after enabling integration.

Inside Ubuntu:

~~~bash
sudo apt update
sudo apt install -y git curl jq
~~~

### macOS

Install Docker Desktop for Mac and start it. Install Git, curl and jq:

~~~bash
brew install git curl jq
~~~

### Node.js 20 using NVM

On Linux, WSL or macOS, install NVM:

~~~bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
~~~

Reload the shell configuration. Use source ~/.bashrc on Ubuntu/WSL or source ~/.zshrc on the default macOS zsh shell.

~~~bash
nvm install 20
nvm use 20
nvm alias default 20
node --version
npm --version
~~~

Use a Linux filesystem path such as ~/fabric when developing under WSL. Avoid placing the Fabric workspace under /mnt/c.

---

## Install Fabric and clone the project

Keep the Fabric samples and application repository as sibling directories:

~~~text
~/fabric/
├── fabric-samples/
└── bms-provenance/
~~~

### Install the Fabric binaries, Docker images and samples

~~~bash
mkdir -p ~/fabric
cd ~/fabric

curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh

./install-fabric.sh --fabric-version 2.5.16 --ca-version 1.5.17 docker binary samples
~~~

Verify the Fabric CLI:

~~~bash
cd ~/fabric/fabric-samples
./bin/peer version
./bin/fabric-ca-client version
~~~

The installer supports explicit Fabric and Fabric CA versions. See the [official Fabric installation guide](https://hyperledger-fabric.readthedocs.io/en/latest/install.html).

### Clone the application

~~~bash
cd ~/fabric
git clone https://github.com/Deepak-Reddy-56/secure-bms-provenance.git bms-provenance
cd ~/fabric/bms-provenance
~~~

To update an existing checkout after changes have been merged to main:

~~~bash
cd ~/fabric/bms-provenance
git checkout main
git pull origin main
~~~

---

## Configure MongoDB Atlas

MongoDB Atlas stores application data that is not part of the blockchain ledger. The backend connects using the official MongoDB Node.js driver.

### 1. Create an Atlas deployment

1. Sign in to [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a project and a database deployment. Use a free/shared tier if it is available and suitable for your use; check the Atlas plan and billing details before creating resources.
3. Open Database Access and create a database user. This is separate from your MongoDB Atlas website login.
4. Grant the application database user the minimum required database permissions, normally readWrite on the application database.
5. Open Network Access and add the public IPv4 address of the machine or Codespace that runs the backend.

Atlas requires both an authorized source IP and a database user. See [Connect to an Atlas cluster](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

Do not use 0.0.0.0/0 for a public demo. Allow only the current trusted IP address, using /32 for one IPv4 address. If a dynamic IP changes, update the access list.

### 2. Copy the connection string

In Atlas, open your deployment and select Connect → Drivers → Node.js. Copy the connection string.

It has this general format:

~~~text
mongodb+srv://<database-user>:<url-encoded-password>@<cluster-host>/?retryWrites=true&w=majority&appName=BMS-Provenance
~~~

Replace the placeholders with the database username, URL-encoded password and cluster host from Atlas. If the password contains URI-reserved characters, percent-encode them before using the connection string.

Set the database name separately with MONGODB_DB. The backend explicitly selects that database when obtaining a database handle.

### 3. What MongoDB stores

The backend uses these collections:

| Collection | Purpose |
|---|---|
| users | Provisioned Google email addresses, roles, Fabric identity mappings, active status and Google subject link |
| sessions | Hashed session tokens, session data and expiry |
| componentTypes | Administrator-defined component type names, codes and component numbers |
| locations | Administrator-defined location names, codes and pincodes |

Collections and required session indexes are created by the application when first used. No manual collection creation is required.

Session cookies are valid for eight hours. MongoDB automatically expires session records using a TTL index.

**Blockchain data is not stored in MongoDB.** Component state and lifecycle history are recorded on the Hyperledger Fabric ledger. MongoDB stores application account and configuration data.

---

## Configure Google sign-in

The application uses Google Identity Services in the React frontend. The backend verifies the Google ID token against GOOGLE_CLIENT_ID.

### 1. Create a Web OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create the project used by this application.
3. Configure Google Auth Platform branding and audience.
4. Choose External if users outside your Google Workspace organization need to sign in.
5. Create an OAuth Client ID with application type Web application.

For testing, configure the audience and test-user list according to the scopes and publishing status of your OAuth application.

### 2. Add authorized JavaScript origins

Add the exact browser origins from which the frontend will be opened.

For local development:

~~~text
http://localhost:5173
http://127.0.0.1:5173
~~~

For GitHub Codespaces, add the forwarded frontend origin:

~~~text
https://<your-codespace-name>-5173.app.github.dev
~~~

An origin contains the scheme, hostname and optional port. Do not add a path or trailing slash.

The current frontend uses the Google Identity Services sign-in button and receives an ID token in a JavaScript callback. It does not use a redirect-based OAuth callback in the current implementation.

### 3. Configure the two client ID variables

The same Web OAuth client ID must be set in both places:

- Backend: GOOGLE_CLIENT_ID
- Frontend: VITE_GOOGLE_CLIENT_ID

Set ADMIN_EMAIL to the Google account that should receive administrator access. The value is normalized to lowercase by the backend.

Google authentication alone does not grant an operational role. Every non-admin account must be provisioned by the administrator in the BMS User Management page with one of the available operational roles.

The frontend VITE_GOOGLE_CLIENT_ID is a public OAuth client identifier, not a client secret. Never put database passwords, private keys or other secrets in variables prefixed with VITE_.

See [Google Identity Services](https://developers.google.com/identity/gsi/web) for the sign-in integration documentation.

---

## Configure environment variables

The repository contains environment templates:

- backend/.env.example
- frontend/.env.example

Create local environment files:

~~~bash
cd ~/fabric/bms-provenance/backend
cp .env.example .env

cd ~/fabric/bms-provenance/frontend
cp .env.example .env
~~~

Edit each file locally. Never commit either .env file.

### Backend configuration

The backend reads its configuration from backend/.env.

At minimum, configure:

~~~dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000

MONGODB_URI=mongodb+srv://<database-user>:<url-encoded-password>@<cluster-host>/?retryWrites=true&w=majority&appName=BMS-Provenance
MONGODB_DB=bms_provenance

GOOGLE_CLIENT_ID=<web-oauth-client-id>
ADMIN_EMAIL=<admin-google-account-email>

ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

FABRIC_CHANNEL=mychannel
FABRIC_CHAINCODE=bmsprovenance
FABRIC_ORDERER_ADDRESS=localhost:7050
FABRIC_ORDERER_TLS_HOSTNAME=orderer.example.com
FABRIC_ORG1_PEER_ADDRESS=localhost:7051
FABRIC_ORG2_PEER_ADDRESS=localhost:9051
~~~

The remaining Fabric paths, TLS certificate paths and timeout settings are documented in backend/.env.example. Their defaults are derived from:

~~~text
$HOME/fabric/fabric-samples/
~~~

If Fabric is installed elsewhere, set FABRIC_SAMPLES_DIR to the absolute fabric-samples path. The backend derives the binary, config and test-network paths from that directory unless explicit overrides are supplied.

### Frontend configuration

The frontend reads its configuration from frontend/.env.

~~~dotenv
VITE_GOOGLE_CLIENT_ID=<same-web-oauth-client-id-as-backend>
VITE_API_BASE_URL=
~~~

Leave VITE_API_BASE_URL empty for the standard development setup. The frontend sends relative /api requests and Vite proxies them to http://127.0.0.1:3000.

Only set VITE_API_BASE_URL when deliberately using a different backend origin and when the backend CORS and session-cookie settings have been configured for that origin.

### Environment variable reference

| Variable | Location | Required | Purpose |
|---|---|---:|---|
| MONGODB_URI | Backend | Yes | MongoDB Atlas connection URI |
| MONGODB_DB | Backend | Recommended | Database name; defaults to bms_provenance_dev |
| GOOGLE_CLIENT_ID | Backend | Yes | Verifies Google ID tokens |
| ADMIN_EMAIL | Backend | Yes | Google account with administrator access |
| ALLOWED_ORIGINS | Backend | For non-local origins | Comma-separated exact browser origins |
| HOST | Backend | No | Backend bind address; default 127.0.0.1 |
| PORT | Backend | No | Backend port; default 3000 |
| NODE_ENV | Backend | No | Use development locally; production enables secure cookie behaviour |
| COOKIE_SECURE | Backend | No | Explicit secure-cookie setting; production mode adds Secure automatically |
| TRUST_PROXY | Backend | No | Enable only behind a trusted proxy that overwrites forwarded client IP headers |
| FABRIC_CHANNEL | Backend | No | Defaults to mychannel |
| FABRIC_CHAINCODE | Backend | No | Defaults to bmsprovenance |
| FABRIC_*_ADDRESS | Backend | No | Fabric orderer and peer endpoints |
| FABRIC_SAMPLES_DIR | Backend | No | Override the default Fabric samples directory |
| VITE_GOOGLE_CLIENT_ID | Frontend | Yes | Public Web OAuth client ID used by Google Identity Services |
| VITE_API_BASE_URL | Frontend | No | Optional direct backend URL; leave blank to use the Vite proxy |

---

## Create the Fabric network and identities

The backend invokes the Fabric CLI using the local Fabric samples installation. Fabric certificates and private keys are generated locally and are not stored in the Git repository.

### 1. Start the test network and create the channel

On a fresh setup:

~~~bash
cd ~/fabric/fabric-samples/test-network

./network.sh up createChannel -c mychannel -ca
~~~

This starts the two peer organizations, the ordering service and the Certificate Authorities, and creates mychannel.

Check the running containers:

~~~bash
docker ps
~~~

### 2. Deploy the BMS chaincode

The application repository and fabric-samples directory should be siblings under ~/fabric.

~~~bash
cd ~/fabric/fabric-samples/test-network

./network.sh deployCC \
  -ccn bmsprovenance \
  -ccp "$HOME/fabric/bms-provenance/chaincode/javascript" \
  -ccl javascript \
  -c mychannel
~~~

The deployment script packages, installs, approves and commits the chaincode definition.

Verify the committed definition:

~~~bash
peer lifecycle chaincode querycommitted -C mychannel
~~~

The command must be run with the Org1 peer CLI environment configured. For the standard test network, the following is an example Org1 administrator environment:

~~~bash
cd ~/fabric/fabric-samples/test-network

export PATH="$HOME/fabric/fabric-samples/bin:$PATH"
export FABRIC_CFG_PATH="$HOME/fabric/fabric-samples/config"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_MSPCONFIGPATH="$PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
export CORE_PEER_TLS_ROOTCERT_FILE="$PWD/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem"

peer lifecycle chaincode querycommitted -C mychannel
~~~

Expected chaincode details include:

~~~text
Name: bmsprovenance
Version: 1.0
Sequence: 1
~~~

Use localhost for these peer and orderer addresses. The test network certificates contain DNS Subject Alternative Names such as localhost and peer0.org1.example.com; they do not contain 127.0.0.1 as an IP SAN. Do not disable TLS verification to work around a hostname mismatch.

### 3. Register and enroll the six operational Fabric identities

The chaincode checks the role attribute embedded in each enrollment certificate. The backend expects these identity names and MSP directories under Org1:

| Application role | Fabric identity | Required certificate attribute |
|---|---|---|
| Manufacturer | manufacturer1 | role=manufacturer |
| Certifier | certifier1 | role=certifier |
| Transporter | transporter1 | role=transporter |
| Warehouse | warehouse1 | role=warehouse |
| Assembler | assembler1 | role=assembler |
| Auditor | auditor1 | role=auditor |

Each identity must be registered with the Org1 CA and enrolled so its MSP is created at:

~~~text
organizations/peerOrganizations/org1.example.com/users/<identity>@org1.example.com/msp
~~~

The CA registration must set the role attribute as an enrollment-certificate attribute. The enrollment must include the role attribute in the certificate. The following is a reusable Bash example for a fresh test network. Run it from the test-network directory after the CA is running.

~~~bash
cd ~/fabric/fabric-samples/test-network

ORG1_HOME="$PWD/organizations/peerOrganizations/org1.example.com"
ORG1_CA_CERT="$ORG1_HOME/ca/ca.org1.example.com-cert.pem"

# Use the already-enrolled Org1 CA administrator identity to register clients.
export FABRIC_CA_CLIENT_HOME="$ORG1_HOME/users/Admin@org1.example.com"

register_and_enroll() {
  local identity="$1"
  local role="$2"
  local secret

  read -rsp "Choose an enrollment secret for $identity: " secret
  echo

  fabric-ca-client register \
    --caname ca-org1 \
    -u https://localhost:7054 \
    --id.name "$identity" \
    --id.secret "$secret" \
    --id.type client \
    --id.affiliation org1.department1 \
    --id.attrs "role=$role:ecert" \
    --tls.certfiles "$ORG1_CA_CERT"

  fabric-ca-client enroll \
    -u "https://$identity:$secret@localhost:7054" \
    --caname ca-org1 \
    --enrollment.attrs role \
    --tls.certfiles "$ORG1_CA_CERT" \
    --mspdir "$ORG1_HOME/users/$identity@org1.example.com/msp"

  unset secret
}

register_and_enroll manufacturer1 manufacturer
register_and_enroll certifier1 certifier
register_and_enroll transporter1 transporter
register_and_enroll warehouse1 warehouse
register_and_enroll assembler1 assembler
register_and_enroll auditor1 auditor
~~~

Use unique enrollment secrets and keep them outside the repository. Run this registration procedure only once for each identity on a fresh CA. If an identity has already been registered, do not blindly register it again; inspect the existing CA identity and MSP directory first.

After enrollment, confirm that all six MSP directories exist. The chaincode reads the role attribute from the signed client identity certificate for authorization.

For more detail, see the [Fabric CA User's Guide](https://hyperledger-fabric-ca.readthedocs.io/en/latest/users-guide.html).

---

## Install dependencies and run the application

Install each package set once, from its own directory.

### 1. JavaScript chaincode dependencies

~~~bash
cd ~/fabric/bms-provenance/chaincode/javascript
npm ci
~~~

### 2. Backend dependencies and tests

~~~bash
cd ~/fabric/bms-provenance/backend
npm ci
npm test
~~~

Start the backend:

~~~bash
npm run dev
~~~

The backend listens on 127.0.0.1:3000 by default. Keep this terminal open.

Basic backend health check:

~~~bash
curl -i http://127.0.0.1:3000/api/health
~~~

This public endpoint checks that the backend process is responding. The Fabric health endpoint is administrator-authenticated; use the signed-in administrator's Network Status page to view Fabric connectivity. An unauthenticated request to /api/health/fabric returning 401 is expected.

### 3. Frontend dependencies and development server

Open another terminal:

~~~bash
cd ~/fabric/bms-provenance/frontend
npm ci
npm run dev
~~~

Open:

~~~text
http://localhost:5173
~~~

For GitHub Codespaces, bind Vite to all interfaces:

~~~bash
npm run dev -- --host 0.0.0.0
~~~

### 4. First application login and provisioning

1. Sign in using the Google account configured as ADMIN_EMAIL.
2. Open User Management and provision the operational Google accounts.
3. Assign one of the available roles: Manufacturer, Certifier, Transporter, Warehouse, Assembler or Auditor.
4. Configure the allowed component types in Component Types.
5. Configure the locations, location codes and six-digit pincodes in Locations.
6. Sign out and ask each provisioned user to sign in with their own Google account.

The administrator account is matched by ADMIN_EMAIL. Other accounts must exist as active MongoDB user records before the backend will grant them an operational session. The first successful sign-in links the Google subject to the provisioned record.

---

## GitHub Codespaces demo setup

GitHub Codespaces can run the frontend, backend and Fabric test network in one workspace. It is suitable for development and demonstrations, not as a permanent production hosting environment.

### Configure Codespaces secrets

Add the following secrets to the GitHub account or repository Codespaces secrets settings. Do not put secret values in the repository.

| Secret name | Used by |
|---|---|
| MONGODB_URI | Backend |
| MONGODB_DB | Backend |
| GOOGLE_CLIENT_ID | Backend |
| ADMIN_EMAIL | Backend |
| VITE_GOOGLE_CLIENT_ID | Frontend |

The backend and frontend must receive the same Google Web OAuth client ID through GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID.

### Configure the forwarded frontend origin

After the Codespace is created, start the frontend once and open the Ports tab. Copy the forwarded HTTPS origin for port 5173.

Add that exact origin to:

1. Google Cloud OAuth client → Authorized JavaScript origins.
2. Backend ALLOWED_ORIGINS.

The backend origin list must contain the exact frontend origin, with no path or trailing slash. For example:

~~~bash
export ALLOWED_ORIGINS="https://<your-codespace-name>-5173.app.github.dev,http://localhost:5173,http://127.0.0.1:5173"
~~~

The Vite API proxy should remain enabled. Leave VITE_API_BASE_URL empty so browser requests to /api are proxied to the backend inside the Codespace.

### Update the Atlas network access list

Codespaces outbound IP addresses can change between starts. From a Codespaces terminal:

~~~bash
curl -4 https://api.ipify.org
~~~

Add the returned IPv4 address to MongoDB Atlas Network Access with /32. Do not add 0.0.0.0/0.

### Port visibility

| Port | Service | Visibility |
|---|---|---|
| 5173 | Vite frontend | Public only while sharing the demo |
| 3000 | Backend API | Private |
| 7050, 7051, 7053, 7054, 8054, 9051, 9054 and other Fabric ports | Fabric services | Private |

Only the frontend should be made public for a demo. Do not expose the backend, peer, orderer or CA ports to the public internet.

---

## Resume an existing Codespace

When a Codespace is stopped and later resumed, use the existing workspace. Do not create a new Codespace unless the old one has been intentionally deleted.

### 1. Check Docker state

~~~bash
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
~~~

If the Fabric containers exist but are stopped, start the existing containers:

~~~bash
docker start ca_org1 ca_org2 ca_orderer orderer.example.com
docker start peer0.org1.example.com peer0.org2.example.com
~~~

Start the existing BMS chaincode containers if they are present:

~~~bash
docker ps -aq --filter "name=dev-peer0.org1.example.com-bmsprovenance_1.0" | xargs -r docker start
docker ps -aq --filter "name=dev-peer0.org2.example.com-bmsprovenance_1.0" | xargs -r docker start
~~~

Verify that the peers, orderer, CAs and chaincode containers are running:

~~~bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
~~~

If the containers do not exist, follow the fresh Fabric network setup instead. Do not run network.sh down as a routine restart operation.

### 2. Recheck Atlas access

~~~bash
curl -4 https://api.ipify.org
~~~

If the egress IP changed, update the Atlas IP access list with the new IPv4 address and /32.

### 3. Start the backend and frontend

Use separate terminals:

~~~bash
cd /workspaces/secure-bms-provenance/backend
export FABRIC_ORDERER_ADDRESS=localhost:7050
export FABRIC_ORDERER_TLS_HOSTNAME=orderer.example.com
export FABRIC_ORG1_PEER_ADDRESS=localhost:7051
export FABRIC_ORG2_PEER_ADDRESS=localhost:9051
export ALLOWED_ORIGINS="https://<your-codespace-name>-5173.app.github.dev,http://localhost:5173,http://127.0.0.1:5173"
npm run dev
~~~

~~~bash
cd /workspaces/secure-bms-provenance/frontend
npm run dev -- --host 0.0.0.0
~~~

Open the Ports tab and set port 5173 to Public while the demo is being shared. Keep all other ports Private.

Sign in as the administrator and open Network Status. A successful health check should show channel mychannel and chaincode bmsprovenance.

### 4. Stop the Codespace when finished

Save your changes and use the Codespaces menu → Stop codespace. Stopping the Codespace releases its compute allocation. The existing workspace and Docker data are retained while that Codespace remains available, but storage and retention limits still apply.

Do not use network.sh down as a normal way to stop a Codespace. It is a test-network teardown command and can remove the local Fabric network material and ledger state.

---

## Tests and build

### Backend automated tests

~~~bash
cd backend
npm ci
npm test
~~~

The backend test command runs the component ID, shipment ID, assembly ID, provenance validation, current-holder, rate-limiter and Fabric gateway tests.

### Frontend production build

~~~bash
cd frontend
npm ci
npm run build
~~~

The production build is written to frontend/dist.

---

## Troubleshooting

| Symptom | Likely cause and action |
|---|---|
| MONGODB_URI is not configured | Confirm backend/.env exists and contains MONGODB_URI, or that the Codespace has the MONGODB_URI secret. |
| MongoServerSelectionError or server selection timeout | Check that the current public IPv4 address is in the Atlas IP access list and that the database username/password in the URI are correct. |
| Authentication fails after a Codespace restart | Recheck Atlas IP access. MongoDB session lookups and account lookups require the database to be reachable. |
| Google origin is not authorized | Add the exact frontend origin to the OAuth Web client authorized JavaScript origins. |
| User signs in with Google but is not provisioned | Add the user's exact Google email in BMS Admin → User Management and assign an active operational role. |
| /api/health/fabric returns 401 | The endpoint requires an administrator session. Sign in as the configured administrator and use the Network Status page. |
| Fabric peer TLS reports that 127.0.0.1 is not in the certificate SAN | Use localhost:7051 and localhost:9051. Do not disable TLS verification. |
| peer command not found | Add $HOME/fabric/fabric-samples/bin to PATH. |
| Fabric health reports connection refused | Check docker ps. Start the existing peer and orderer containers before starting the backend. |
| Chaincode not committed | Query the committed definition on mychannel. Deploy the chaincode only when setting up a fresh network or intentionally upgrading the chaincode. |

Useful Fabric CLI path setup:

~~~bash
export PATH="$HOME/fabric/fabric-samples/bin:$PATH"
export FABRIC_CFG_PATH="$HOME/fabric/fabric-samples/config"
~~~

---

## Security and data persistence

- Never commit backend/.env, frontend/.env, OAuth secrets, MongoDB credentials, Fabric MSP folders, private keys, generated channel artifacts or chaincode deployment archives.
- Never expose MongoDB credentials or Fabric private keys in frontend variables.
- VITE_ variables are included in browser-side bundles. Only public configuration such as the Google Web OAuth client ID belongs there.
- Keep Atlas Network Access restricted to trusted IP addresses. Do not use 0.0.0.0/0 for a demo.
- Keep backend, Fabric peer, orderer and CA ports private.
- Keep Fabric TLS enabled and use hostnames present in the certificates.
- Fabric test-network credentials and ledgers are local development material, not a production identity or consortium setup.
- Back up important MongoDB and Fabric data before deleting a Codespace, deleting Docker volumes or tearing down the Fabric test network.
- A Codespace can stop or expire. It should not be treated as permanent hosting.

The repository intentionally excludes generated identity material. Each developer must create their own local Fabric network, CA identities and environment files.

## Project structure

~~~text
secure-bms-provenance/
├── backend/
│   ├── db/                 MongoDB connection
│   ├── security/           API rate-limiting utilities
│   ├── scripts/            Data migration utilities
│   ├── .env.example        Backend environment template
│   ├── auth.js             Google ID-token verification
│   ├── fabricGateway.js    Fabric CLI integration
│   ├── server.js           Backend API and role enforcement
│   ├── sessionStore.js     MongoDB-backed sessions
│   ├── userStore.js        Operational user records
│   └── package.json
├── chaincode/
│   └── javascript/
│       ├── lib/bmsContract.js
│       ├── index.js
│       └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── services/
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md

The Fabric samples workspace is installed separately under ~/fabric/fabric-samples and is not part of this repository checkout.

## Official references

- [Hyperledger Fabric](https://github.com/hyperledger/fabric)
- [Fabric installation](https://hyperledger-fabric.readthedocs.io/en/latest/install.html)
- [Fabric test network](https://github.com/hyperledger/fabric-samples/tree/main/test-network)
- [Fabric CA User's Guide](https://hyperledger-fabric-ca.readthedocs.io/en/latest/users-guide.html)
- [MongoDB Atlas connection guide](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/)
- [Google Identity Services](https://developers.google.com/identity/gsi/web)
- [Docker Desktop for Windows and WSL](https://docs.docker.com/desktop/features/wsl/)
- [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/)
- [Microsoft WSL installation](https://learn.microsoft.com/en-us/windows/wsl/install)
- [NVM](https://github.com/nvm-sh/nvm)
