# Urja Meter Ops — Reverse Engineering & Protocol Discovery Report

**Author:** Avuram Chandra Mohan  
**Target System:** Urja Meter Ops (`https://urja-ops.flockenergy.tech`)  
**Credentials:** `operator@urja.local` / `urja-ops-2026`  

---

## 1. Executive Summary & Architecture Overview

The **Urja Meter Ops** portal is an internal web application used by utility field and operations staff to monitor smart meters, explore distribution network hierarchies, and review interval energy consumption.

Through network inspection and client-side bundle analysis, the portal was discovered to be built using **SvelteKit** (v2 with Vite) backed by **Better-Auth** for session-based authentication. While the UI presents itself as a human-facing portal without an official public API, it internally exposes structured JSON endpoints alongside Server-Side Rendered (SSR) HTML pages with embedded hydration state.

---

## 2. Authentication & Session Management

### 2.1 The Login Flow
* **Endpoint:** `POST https://urja-ops.flockenergy.tech/login`
* **Content-Type:** `application/x-www-form-urlencoded`
* **Form Parameters:**
  * `email`: `operator@urja.local`
  * `password`: `urja-ops-2026`

### 2.2 Security & CSRF Quirk
SvelteKit enforces origin-based Cross-Site Request Forgery (CSRF) protection on all form actions. Automated programmatic requests without origin headers fail immediately with:
```http
HTTP/1.1 403 Forbidden
```
**Solution / Requirement:** Automated clients must explicitly set:
* `Origin: https://urja-ops.flockenergy.tech`
* `Referer: https://urja-ops.flockenergy.tech/login`

### 2.3 Session Token
Upon successful authentication, the server returns an HTTP-only secure session cookie:
```http
Set-Cookie: __Secure-better-auth.session_token=<JWT_OR_SESSION_HASH>; Path=/; HttpOnly; Secure; SameSite=Lax
```
All subsequent authenticated requests to `/portal/*` and `/meters/*` must include this cookie in the `Cookie` header.

---

## 3. Discovered Internal Endpoints & Data Structures

### 3.1 Meter Search & Pagination
* **Endpoint:** `GET /portal/meters/search?q={query}&page={page}`
* **Headers:** `Cookie: __Secure-better-auth.session_token=...`
* **Response Format:** JSON
* **Sample Payload:**
  ```json
  {
    "data": [
      {
        "meterId": "J100000",
        "serialNo": "SE33962",
        "make": "HPL",
        "phaseType": "single",
        "installStatus": "Decommissioned",
        "dtCode": "DT-001"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 405
  }
  ```
* **Notes:**
  * Supports full-text search across `meterId` and `serialNo` using query param `q`.
  * Results are paginated in pages of 20 items (21 pages for 405 total meters).

---

### 3.2 Meter Details & Network Hierarchy
* **Endpoint:** `GET /meters/{meterId}`
* **Response Format:** Server-Side Rendered HTML + Embedded SvelteKit Hydration JSON
* **Data Discovered:**
  1. **Nameplate Card:**
     * `Meter ID`, `Serial No`, `Make`, `Phase Type`, `Installation Status`, `Installation Type`.
  2. **Network Hierarchy Tree:**
     * The breadcrumb structure organizes meters into a strict 7-level electrical distribution hierarchy:
       $$\text{Zone} \rightarrow \text{Circle} \rightarrow \text{Division} \rightarrow \text{Subdivision} \rightarrow \text{Substation} \rightarrow \text{Feeder} \rightarrow \text{Distribution Transformer (DT)} \rightarrow \text{Meter}$$
     * Example:
       * **Zone:** Jaipur Zone 1 (`Z-01`)
       * **Circle:** Circle 1 (`C-01`)
       * **Division:** Division 1 (`D-01`)
       * **Subdivision:** Subdivision 1 (`SD-01`)
       * **Substation:** Substation 1 (`SS-01`)
       * **Feeder:** Feeder 1 (`F-001`)
       * **Distribution Transformer:** Malviya Nagar DT 1 (`DT-001`)
* **Extraction Strategy:** The hierarchy and nameplate can be extracted either by HTML element scraping (`<dl>`, `<nav>`) or by parsing the SvelteKit hydration script object (`kit.start(...)` payload embedded at the bottom of the HTML page).

---

### 3.3 Meter Geographic Location
* **Endpoint:** `GET /portal/meters/{meterId}/geo`
* **Response Format:** JSON
* **Sample Payload:**
  ```json
  {
    "data": {
      "latitude": "26.938961002479865",
      "longitude": "75.83095656146852"
    }
  }
  ```
* **Quirks:**
  * Coordinates are transmitted as string representations of floating-point numbers instead of IEEE 754 floating-point numbers.

---

### 3.4 Interval Energy Consumption
* **Endpoint:** `GET /portal/meters/{meterId}/energy`
* **Response Format:** JSON
* **Sample Payload:**
  ```json
  {
    "data": [
      {
        "timestamp": "23/06/2026 23:30",
        "kwh": "48438.74",
        "kvah": "52313.84",
        "voltR": "226"
      },
      {
        "timestamp": "24/06/2026 00:00",
        "kwh": "48439.16",
        "kvah": "52314.29",
        "voltR": "229"
      }
    ]
  }
  ```
* **Quirks & Normalization Needs:**
  * `kwh`, `kvah`, and `voltR` are returned as strings.
  * Timestamps use non-standard `DD/MM/YYYY HH:MM` strings rather than ISO-8601 standard (`YYYY-MM-DDTHH:mm:ssZ`).
  * In three-phase meters, only `voltR` (Red phase voltage) is provided in this legacy view.

---

### 3.5 Distribution Transformers
* **Endpoint:** `GET /portal/dts?page={page}` (or `/transformers`)
* **Response Format:** JSON / Paginated HTML
* **Fields:** `CODE` (e.g., `DT-001`), `NAME` (e.g., `Malviya Nagar DT 1`), `FEEDER` (`F-001`), `CAPACITY (KVA)` (e.g., `100`).

---

## 4. Bulk Export & Cryptographic Request Signing (Bonus Finding)

On the `/transformers` view, an **"Export all meters"** button allows exporting the entire meter fleet in bulk. However, the portal protects this bulk endpoint with dynamic HMAC request signing:

### 4.1 Step 1: Dynamic Key Retrieval
* Client calls `GET /portal/keys`
* Server returns:
  ```json
  {
    "data": {
      "signingSecret": "<EPHEMERAL_SECRET>"
    }
  }
  ```

### 4.2 Step 2: HMAC-SHA256 Signature Generation
Inspecting the client bundle `nodes/4.2Bgc2kUI.js` revealed the exact signature algorithm:
```javascript
// Canonical payload structure:
// [METHOD, PATH, QUERY_STRING, TIMESTAMP].join("\n")
const timestamp = Math.floor(Date.now() / 1000).toString();
const payload = ["GET", "/portal/export", "page=1", timestamp].join("\n");
const signature = crypto.createHmac("sha256", signingSecret).update(payload).digest("hex");
```

### 4.3 Step 3: Signed Request Execution
* **Request:** `GET /portal/export?page=1`
* **Headers:**
  * `x-timestamp`: `<timestamp>`
  * `x-signature`: `<hex_signature>`
* **Result:** Returns all **403 meters** with complete metadata, full 7-level hierarchy, and geo-coordinates in a single high-efficiency call (232 KB payload).

---

## 5. Summary of Data Anomalies & Normalization Strategy

| Legacy Portal Anomaly | Clean REST API Normalization |
| :--- | :--- |
| Metric strings: `"48438.74"`, `"226"` | Cast to native `float` (`48438.74`) and `integer` (`226`). |
| Coordinates strings: `"26.938961..."` | Cast to IEEE 754 floats (`26.938961`). |
| Timestamps: `"23/06/2026 23:30"` | Converted to ISO-8601 (`"2026-06-23T23:30:00Z"`). |
| Disconnected endpoints (`/search`, `/geo`, `/energy`) | Unified meter entity containing metadata + geo + latest reading. |
| Total count discrepancy: 405 listed on UI vs 403 in export | Handled transparently; pagination queries accurately reflect live count. |
| Session expiration / 401 | Auto-relogin adapter transparently retries failed requests once. |
