# Engineering Reflection

**Author:** Avuram Chandra Mohan  
**Role:** Backend / Full-Stack Take-Home Assessment  
**Project:** Urja Meter Ops REST API Service  

---

### 1. What assumptions did you make?

1. **Single-Tenant Operator Credential Lifecycle:**  
   I assumed the utility service operates as a centralized proxy service with a single master operator account (`operator@urja.local`) rather than each downstream API caller maintaining individual Urja Ops credentials. Therefore, the service maintains a persistent server-side session that auto-refreshes when tokens expire.

2. **Read-Only Telemetry Ingestion:**  
   I assumed all interactions with Urja Meter Ops are strictly read-only, matching the utility's business model (monitoring and data extraction without mutating meter configurations or dispatching field commands).

3. **Data Freshness vs. Upstream Latency:**  
   I assumed that interval consumption data (`/energy`) and geographic coordinates (`/geo`) are refreshed incrementally by the smart meters, making on-demand fetches with light caching appropriate. For network hierarchy, grid structures change infrequently, making batch extraction via the HMAC-signed bulk path optimal.

4. **Timezone Uniformity:**  
   I assumed the legacy portal's `DD/MM/YYYY HH:MM` interval timestamps represent Indian Standard Time (IST, UTC+5:30), but standardized them to ISO-8601 UTC strings (`YYYY-MM-DDTHH:mm:ssZ`) in the API to prevent client-side parsing ambiguities.

---

### 2. Which part was the most difficult, and how did you get unstuck?

The most challenging part of the investigation was **reverse-engineering the bulk export mechanism on the Distribution Transformers page**:

* **The Obstacle:** Clicking "Export all meters" triggered two distinct background calls: `GET /portal/keys` returning a dynamic `signingSecret`, followed by `GET /portal/export?page=1` with two custom headers: `x-timestamp` and `x-signature`. Directly calling `/portal/export` without the headers or with static values resulted in immediate HTTP 403 / 401 rejection.
* **How I Got Unstuck:** Rather than guessing the signature format, I dug directly into the frontend bundle source code (`_app/immutable/nodes/4.2Bgc2kUI.js`). By locating references to `signingSecret` and Web Crypto API methods (`crypto.subtle.importKey`), I extracted the exact signing function:
  $$\text{canonical\_payload} = \text{["GET", "/portal/export", "page=1", timestamp].join("\\n")}$$
  $$\text{signature} = \text{HMAC-SHA256}(\text{key}=\text{signingSecret}, \text{data}=\text{canonical\_payload})$$
  Implementing this algorithm in Node.js using the native `crypto` module allowed us to reliably pull the entire fleet of 403 meters in a single high-speed request (232 KB).

A second notable challenge was SvelteKit's origin-based CSRF protection during automated login. Automated requests initially returned `403 Forbidden` until I added explicit `Origin: https://urja-ops.flockenergy.tech` and `Referer` headers matching SvelteKit's security policy.

---

### 3. If you had another day, what would you improve?

1. **In-Memory Cache with Redis / TTL:**  
   Currently, individual meter detail queries fetch on-demand. With an extra day, I would introduce a Redis caching layer with a 15-minute TTL for telemetry and a 24-hour TTL for static grid hierarchies, backed by a cache-invalidation endpoint.
2. **PostGIS / Geospatial Querying:**  
   Since every meter includes geographic coordinates (`latitude` and `longitude`), I would store the meter locations in PostgreSQL with PostGIS, enabling spatial queries like `GET /api/v1/meters/near?lat=26.93&lng=75.83&radiusKm=2`.
3. **Automated Integration & E2E Testing:**  
   I would add a comprehensive test suite using Jest and Supertest, complete with mock service workers (MSW) to simulate Urja Ops server outages and network latency spikes.
4. **Rate Limiting & Token Bucket:**  
   Implement token-bucket rate limiting on the public API (e.g., using `express-rate-limit`) to prevent downstream programs from overwhelming the legacy Urja portal.

---

### 4. What mistake did you make while solving this?

Early in the reconnaissance, I assumed that meter nameplate details and network hierarchy would be retrieved via an asynchronous JSON API call similar to `/portal/meters/search`. However, when inspecting the network trace for `/meters/J100000`, no separate details endpoint appeared. 

I initially suspected an undocumented GraphQL or websocket connection. Upon inspecting the raw document response of `/meters/J100000`, I realized that SvelteKit was performing Server-Side Rendering (SSR) and embedding both the DOM representation and the client hydration state directly in the initial HTML document. Pivoting to parse both the DOM (via Cheerio) and the hydration script resolved this cleanly.

---

### 5. If you were reviewing your own submission, what would you criticise?

1. **Coupling to SvelteKit Hydration Structure:**  
   Our meter details parser uses regex to inspect the inline SvelteKit script tag (`kit.start(...)`). While Cheerio fallback parsing guarantees stability, relying partially on the internal structure of SvelteKit's compiler bundle could be brittle if the portal upgrades its frontend build tools.
2. **Synchronous Bulk Hierarchy Aggregation:**  
   The `/api/v1/hierarchy` endpoint groups the 403 meters into a nested tree on each request. While fast for 405 meters (< 50ms), at utility scale (1,000,000+ meters), this aggregation should be computed asynchronously in background worker jobs and stored pre-indexed.
3. **Single Active Session Instance:**  
   The client uses a single shared `CookieJar`. In a high-concurrency multi-threaded or multi-instance deployment (e.g. Kubernetes cluster), session state would need to be centralized in Redis so that multiple backend pods share the authenticated session token rather than each logging in independently.
