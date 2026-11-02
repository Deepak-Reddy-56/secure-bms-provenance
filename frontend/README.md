# Component Provenance — Frontend

Day 1 frontend for the **Secure Blockchain for Component Provenance** system.

Built with React + TypeScript + Vite. Communicates with the Node.js/Express backend that interfaces with Hyperledger Fabric.

---

## Frontend Architecture

```
frontend/
├── index.html                      # HTML entry point
├── vite.config.ts                  # Vite configuration (dev proxy)
├── tsconfig.json                   # TypeScript configuration
├── .env.example                    # Environment variable template
└── src/
    ├── main.tsx                    # React 18 entry point
    ├── App.tsx                     # Root component
    ├── index.css                   # Global CSS design system & tokens
    ├── vite-env.d.ts               # Vite env type declarations
    │
    ├── types/
    │   ├── component.ts            # Component domain types
    │   └── api.ts                  # API response types + ApiError class
    │
    ├── services/
    │   ├── api.ts                  # Core Fetch API HTTP client
    │   └── componentService.ts     # Named service functions per operation
    │
    ├── hooks/
    │   └── useComponent.ts         # State machine hooks (registration, search, network)
    │
    ├── pages/
    │   └── Dashboard.tsx           # Main dashboard page
    │
    └── components/
        ├── Header/                 # Sticky header with branding + network status
        ├── Footer/                 # Footer with scope label
        ├── Overview/               # System overview metric cards
        ├── ComponentRegistration/  # Registration form (idle/submitting/success/error)
        ├── ComponentSearch/        # Verify component (idle/searching/found/not_found/error)
        ├── ComponentDetails/       # Component detail panel (dl/dt/dd)
        ├── ProvenanceTimeline/     # Day 1 lifecycle stages sidebar
        └── LedgerInformation/      # Ledger metadata sidebar
```

### Design principles

- No global state management library — state is co-located with each hook
- No fake blockchain data — all data comes from the backend API
- All HTTP calls go through `services/api.ts` — never directly inside components
- Typed `ApiError` class allows consumers to branch on `isConflict` / `isNotFound`

---

## Installation

```bash
cd frontend
npm install
```

---

## Environment variables

Copy `.env.example` to `.env` and set the backend URL:

```bash
cp .env.example .env
```

`.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

> **Note:** When `VITE_API_BASE_URL` is not set, the client defaults to `http://localhost:3000`.

---

## Development

```bash
npm run dev
```

The app will start at `http://localhost:5173`.

During development, Vite proxies `/api/*` requests to the backend URL defined in `vite.config.ts`. This avoids CORS issues in the browser.

---

## Production build

```bash
npm run build
```

Output is written to `dist/`. Serve with any static file server or a reverse proxy in front of the backend.

---

## Backend API dependency

The frontend requires the Node.js/Express backend to be running and connected to the Hyperledger Fabric network.

### Expected API endpoints

| Method | Path                              | Purpose                                |
|--------|-----------------------------------|----------------------------------------|
| `POST` | `/api/components`                 | Register a component on the ledger     |
| `GET`  | `/api/components/:componentID`    | Retrieve a component by ID             |
| `GET`  | `/api/health`                     | Network health check (optional)        |
| `GET`  | `/api/overview`                   | Registered count (optional)            |

### POST `/api/components` — request body

```json
{
  "componentID":    "BMS-2026-001",
  "componentType":  "BMS Controller",
  "manufacturer":   "EVTech Manufacturing",
  "manufactureDate": "2026-09-24",
  "location":       "Bengaluru"
}
```

### POST `/api/components` — success response (200/201)

```json
{
  "componentID":    "BMS-2026-001",
  "componentType":  "BMS Controller",
  "manufacturer":   "EVTech Manufacturing",
  "manufactureDate": "2026-09-24",
  "location":       "Bengaluru",
  "status":         "MANUFACTURED"
}
```

### POST `/api/components` — duplicate error (409)

```json
{
  "message": "Component already exists: BMS-2026-001"
}
```

### GET `/api/components/:componentID` — not found (404)

```json
{
  "message": "Component not found: BMS-999"
}
```

---

## Day 1 scope

Day 1 implements:

- **Manufacturer → Component Registration** on the Hyperledger Fabric ledger
- **Component Retrieval** by ID from the ledger

Future stages (Certification, Transportation, Warehouse, Assembly) are displayed in the Provenance Timeline as "Not implemented" and are not functional in Day 1.

---

## Fabric configuration

| Parameter | Value             |
|-----------|-------------------|
| Channel   | `mychannel`       |
| Chaincode | `bmsprovenance`   |

---

## Known limitations

- The system overview registered-component count is only displayed if the backend exposes a `/api/overview` endpoint. If the endpoint does not exist, `—` is shown rather than a fabricated number.
- The Transaction ID in the Ledger Information panel is only shown if the backend returns a `txId` field in the registration response.
- The network health indicator checks `/api/health` once on page load. It does not poll continuously.
- No authentication is implemented in the frontend — the backend is assumed to handle Fabric identity management.
- The frontend does not contain any Fabric private keys, wallet credentials, or CA certificates.

---

## Security

The frontend communicates **only** with the backend REST API. It never:

- Holds Fabric private keys
- Signs Fabric transactions
- Accesses the Fabric SDK directly
- Stores blockchain credentials

```
Browser (React)
      ↓
   REST API
      ↓
  Node.js Backend
      ↓
  Fabric Gateway
      ↓
Hyperledger Fabric
```
