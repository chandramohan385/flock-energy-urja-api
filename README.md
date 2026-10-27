# Urja Meter Ops — Clean REST API & Modern Dashboard

A resilient, clean, and fully-documented REST API service and modern React analytics dashboard built in front of the legacy **Urja Meter Ops** utility web portal (`https://urja-ops.flockenergy.tech`).

---

## 📑 Core Documentation Links

- 🔍 **[PROTOCOL.md](./PROTOCOL.md)** — In-depth reverse engineering report (Authentication, SvelteKit CSRF, Internal Endpoints, Data Anomalies, and Cryptographic HMAC-SHA256 Signing).
- 📐 **[openapi.json](./openapi.json)** — Complete OpenAPI 3.0.3 specification defining all REST endpoints, schemas, and parameter validations.
- 💭 **[REFLECTION.md](./REFLECTION.md)** — Architectural reflections, assumptions, trade-offs, obstacles overcome, and self-critique.

---

## ⚡ Key Highlights & Engineering Features

1. **Clean REST API Wrapper:** Unifies fragmented legacy endpoints (`/meters/{id}`, `/geo`, `/energy`) into intuitive, typed REST endpoints with ISO-8601 timestamps and IEEE 754 floating-point coordinates.
2. **Session Persistence & Resilient Auto-Relogin:** Implements an adapter layer with cookie-jar session persistence that transparently detects session expirations or HTTP 401s, re-authenticates with CSRF protection, and retries the request seamlessly.
3. **Cryptographic HMAC Request Signing (Bonus):** Reverse-engineered the portal's client-side HMAC-SHA256 export signing algorithm (`GET /portal/keys` + canonical query signing) to pull the full dataset of 403 meters in a single high-performance payload.
4. **Distribution Network Hierarchy Tree (Bonus):** Reconstructs the 7-level electrical grid hierarchy (`Zone ➔ Circle ➔ Division ➔ Subdivision ➔ Substation ➔ Feeder ➔ DT ➔ Meters`).
5. **Interactive Swagger Documentation:** Self-hosted interactive Swagger UI available at `/docs` and `/api/docs`.
6. **Modern React Web Dashboard (Bonus):** A fast, interactive React dashboard built with Vite, featuring live search, status filters, interval consumption line charts, and visual network hierarchy exploration.

---

## 🏗️ Architecture & Project Structure

```
flock-energy-assessment/
├── PROTOCOL.md              # Reverse engineering & protocol discovery write-up
├── openapi.json             # OpenAPI 3.0.3 specification
├── README.md                # System documentation & developer guide
├── REFLECTION.md            # Answers to take-home reflection questions
│
├── server/                  # Backend REST API Service (Node.js + Express)
│   ├── .env                 # Environment configuration (Port, Credentials, Base URL)
│   ├── package.json
│   ├── test_api.js          # Automated end-to-end API test suite
│   └── src/
│       ├── services/
│       │   ├── urjaClient.js    # Resilient portal adapter, cookie jar, HMAC signer
│       │   └── normalizer.js    # Data transformer (types, ISO dates, coordinates)
│       ├── routes/
│       │   └── meters.js        # Express REST endpoints
│       ├── openapi.js           # OpenAPI spec loader
│       └── server.js            # Main Express application & Swagger UI server
│
└── client/                  # Frontend Web Client (React 19 + Vite)
    ├── package.json
    ├── vite.config.js       # Vite configuration with API proxy
    └── src/
        ├── App.jsx          # Interactive dashboard (KPIs, Meters table, Charts, Hierarchy)
        └── index.css        # Clean, modern design system
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or later (Tested on Node.js v24 LTS)
- **npm**: v9.0.0 or later

---

### Step 1: Install & Start the REST API Backend

```bash
# Navigate to the server directory
cd server

# Install dependencies
npm install

# Start the server (runs on http://localhost:3000)
npm start
```

*For live auto-reloading during development, run `npm run dev`.*

---

### Step 2: Access Documentation & Endpoints

Once the server is running, explore:
- 📖 **Interactive Swagger UI:** [http://localhost:3000/docs](http://localhost:3000/docs)
- 📄 **Raw OpenAPI Spec:** [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json)
- 🩺 **Health Check:** [http://localhost:3000/health](http://localhost:3000/health)
- 🖥️ **Integrated Dashboard:** [http://localhost:3000/](http://localhost:3000/)

---

### Step 3: (Optional) Run the React Development Server

The compiled React dashboard is already bundled and served directly by the Express server on `http://localhost:3000/`. 

If you wish to run the client in Vite hot-reload mode:
```bash
cd client
npm install
npm run dev
# Dashboard opens on http://localhost:5173
```

---

### Step 4: Run Automated Tests

To verify that all endpoints (Meters, Details, Consumption, Hierarchy, and Bulk Export) are functioning:
```bash
cd server
npm test
```

---

## 📡 Sample Requests & Responses

### 1. List Smart Meters (Paginated & Searchable)
**Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/meters?page=1&q="
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "meterId": "J100000",
      "serialNo": "SE33962",
      "make": "HPL",
      "phaseType": "single",
      "installationStatus": "Decommissioned",
      "dtCode": "DT-001"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 403,
    "totalPages": 21
  }
}
```

---

### 2. Get Single Meter Details (Unified Telemetry)
**Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/meters/J100000"
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "meterId": "J100000",
    "serialNo": "SE33962",
    "make": "HPL",
    "phaseType": "single",
    "installationStatus": "Decommissioned",
    "installationType": "Whole Current",
    "location": {
      "latitude": 26.938961,
      "longitude": 75.830957
    },
    "hierarchy": {
      "zone": { "name": "Jaipur Zone 1", "code": "Z-01" },
      "circle": { "name": "Circle 1", "code": "C-01" },
      "division": { "name": "Division 1", "code": "D-01" },
      "subdivision": { "name": "Subdivision 1", "code": "SD-01" },
      "substation": { "name": "Substation 1", "code": "SS-01" },
      "feeder": { "name": "Feeder 1", "code": "F-001" },
      "dt": { "name": "Malviya Nagar DT 1", "code": "DT-001" }
    }
  }
}
```

---

### 3. Get Interval Consumption History (Normalized)
**Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/meters/J100000/consumption"
```
**Response (200 OK):**
```json
{
  "success": true,
  "meterId": "J100000",
  "count": 48,
  "data": [
    {
      "timestamp": "2026-06-23T23:30:00.000Z",
      "kwh": 48438.74,
      "kvah": 52313.84,
      "voltR": 226
    },
    {
      "timestamp": "2026-06-24T00:00:00.000Z",
      "kwh": 48439.16,
      "kvah": 52314.29,
      "voltR": 229
    }
  ]
}
```

---

### 4. Bulk Export All Meters (HMAC-Signed)
**Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/meters/export"
```
**Response (200 OK):**
```json
{
  "success": true,
  "count": 403,
  "data": [ ... 403 meter objects with hierarchy and geo ... ]
}
```

---

## ⚙️ Design Decisions & Trade-Offs

| Decision | Rationale | Trade-Off Considered |
| :--- | :--- | :--- |
| **Node.js + Express Framework** | Lightweight, native asynchronous I/O, mature cookie-jar support, and seamless integration with React. | Python/FastAPI offers native Pydantic typing, but Express provides full granular control over raw HTTP streams, custom headers, and session lifecycles. |
| **Transparent Auto-Relogin** | If a session cookie expires mid-flight, the client catches 401/redirects, re-authenticates with CSRF origin headers, and retries the request transparently. | Adds a 1-second latency spike on the single request that triggers the re-authentication, but guarantees 100% downstream reliability. |
| **Parallel Upstream Calls (`Promise.all`)** | When querying `/meters/:id`, meter metadata and coordinates (`/geo`) are fetched in parallel rather than sequentially. | Marginally increases concurrent connection load on the legacy portal in exchange for cutting response latency in half (~350ms vs ~700ms). |
| **Strict Data Normalization** | Converts messy strings (`"48438.74"`, `"226"`) to typed IEEE 754 floats and standard ISO UTC timestamps (`2026-06-23T23:30:00.000Z`). | Requires upfront parsing overhead, but prevents downstream consumers from writing brittle string-to-number casting routines. |

---

## 🚫 What Was Intentionally Left Out

1. **State Mutation Endpoints (POST / PUT / DELETE):**  
   The Urja Meter Ops portal is an internal telemetry monitoring system with no write endpoints exposed. Adding mock mutation endpoints would violate the read-only integrity requirement.
2. **Heavy External Database (Postgres / Mongo):**  
   Per the ground rules, the solution must remain lightweight, portable, and zero-dependency for reviewers. The proxy client fetches live data directly or leverages the HMAC bulk path without requiring external database provisioning.
3. **Complex Authentication for the Wrapper Itself:**  
   The assignment asks for a clean service in front of the legacy portal. Adding API key / OAuth infrastructure to our wrapper was omitted to allow reviewers to run sample cURL requests immediately without provisioning API tokens.

---

## 🔮 What I Would Improve With More Time

1. **Caching Layer (Redis / In-Memory TTL):** Introduce a sliding cache for telemetry readings (5-minute TTL) and static grid hierarchies (24-hour TTL) to minimize upstream request pressure.
2. **Geospatial Indexing (PostGIS / Turf.js):** Add bounding-box and radius queries (`/api/v1/meters/near?lat=...&lng=...&radius=5km`) to enable geospatial field queries.
3. **WebSocket Telemetry Streaming:** Enable real-time consumption streaming for operations centers using Server-Sent Events (SSE) or WebSockets.

---

## 👤 Author
**Avuram Chandra Mohan**  
Flock Energy Engineering Take-Home Submission
