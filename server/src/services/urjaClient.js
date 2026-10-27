import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

class UrjaClient {
  constructor() {
    this.baseUrl = process.env.URJA_BASE_URL || 'https://urja-ops.flockenergy.tech';
    this.email = process.env.URJA_EMAIL || 'operator@urja.local';
    this.password = process.env.URJA_PASSWORD || 'urja-ops-2026';

    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.jar,
        withCredentials: true,
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
        }
      })
    );

    this.isAuthenticated = false;
    this.authPromise = null;
  }

  /**
   * Authenticates against the Urja Ops portal using SvelteKit form action.
   * Includes Origin and Referer headers required for SvelteKit CSRF verification.
   */
  async login() {
    if (this.authPromise) return this.authPromise;

    this.authPromise = (async () => {
      try {
        console.log(`[UrjaClient] Authenticating as ${this.email}...`);

        const params = new URLSearchParams();
        params.append('email', this.email);
        params.append('password', this.password);

        const response = await this.client.post(`${this.baseUrl}/login`, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': this.baseUrl,
            'Referer': `${this.baseUrl}/login`
          },
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400
        });

        this.isAuthenticated = true;
        console.log('[UrjaClient] Authentication successful. Session token stored.');
        return response;
      } catch (error) {
        this.isAuthenticated = false;
        console.error('[UrjaClient] Authentication failed:', error.message);
        throw new Error(`Failed to authenticate with Urja portal: ${error.message}`);
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  /**
   * Transparently wraps requests with automatic authentication and retry on 401/expired session.
   */
  async request(config) {
    if (!this.isAuthenticated) {
      await this.login();
    }

    try {
      const response = await this.client(config);
      // Check if SvelteKit redirected us to the login page (session expired)
      if (typeof response.data === 'string' && response.data.includes('Urja Meter Ops') && response.data.includes('Sign in')) {
        console.warn('[UrjaClient] Session expired detected via redirect. Re-authenticating...');
        this.isAuthenticated = false;
        await this.login();
        return await this.client(config);
      }
      return response;
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.warn(`[UrjaClient] Received ${error.response.status}. Re-authenticating and retrying...`);
        this.isAuthenticated = false;
        await this.login();
        return await this.client(config);
      }
      throw error;
    }
  }

  /**
   * Fetches paginated list of smart meters.
   * @param {string} query Search term for meter ID or serial
   * @param {number} page Page number (1-indexed)
   */
  async searchMeters(query = '', page = 1) {
    const url = `${this.baseUrl}/portal/meters/search?q=${encodeURIComponent(query)}&page=${page}`;
    const response = await this.request({
      method: 'GET',
      url,
      headers: {
        Referer: `${this.baseUrl}/meters`
      }
    });
    return response.data;
  }

  /**
   * Fetches the SSR meter detail page and parses both the HTML DOM and SvelteKit data block.
   * @param {string} meterId 
   */
  async getMeterDetails(meterId) {
    const url = `${this.baseUrl}/meters/${meterId}`;
    const response = await this.request({
      method: 'GET',
      url,
      headers: {
        Referer: `${this.baseUrl}/meters`
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 1. Check if SvelteKit state is available in script tag
    const scriptContent = $('script').text();
    const hierarchyMatch = scriptContent.match(/hierarchy:\s*(\{[\s\S]*?\})\s*,\s*uses:/);
    let parsedHierarchy = null;
    let parsedDetail = null;

    if (hierarchyMatch) {
      try {
        // Evaluate the JS object literal safely
        const rawObjStr = hierarchyMatch[1];
        // Replace unquoted keys if necessary or use Function evaluation
        parsedHierarchy = new Function(`return ${rawObjStr}`)();
      } catch (e) {
        console.debug('[UrjaClient] Hydration script parse fallback:', e.message);
      }
    }

    // 2. Extract from DOM as reliable fallback
    const nameplate = {};
    $('dl div').each((_, el) => {
      const dt = $(el).find('dt').text().trim();
      const dd = $(el).find('dd').text().trim();
      if (dt && dd) {
        nameplate[dt] = dd;
      }
    });

    const breadcrumbs = [];
    $('nav.mt-2 span').each((_, el) => {
      const txt = $(el).text().trim();
      if (txt && txt !== '›') {
        breadcrumbs.push(txt);
      }
    });

    return {
      meterId: nameplate['Meter ID'] || meterId,
      serialNo: nameplate['Serial No'] || null,
      make: nameplate['Make'] || null,
      phaseType: nameplate['Phase Type'] || null,
      installationStatus: nameplate['Installation Status'] || null,
      installationType: nameplate['Installation Type'] || null,
      rawHierarchy: parsedHierarchy || {
        Zone: breadcrumbs[0] || null,
        Circle: breadcrumbs[1] || null,
        Division: breadcrumbs[2] || null,
        Subdivision: breadcrumbs[3] || null,
        'Sub Station': breadcrumbs[4] || null,
        Feeder: breadcrumbs[5] || null,
        DT: breadcrumbs[6] || null
      },
      breadcrumbs
    };
  }

  /**
   * Fetches geographic coordinates for a meter.
   * @param {string} meterId 
   */
  async getMeterGeo(meterId) {
    const url = `${this.baseUrl}/portal/meters/${meterId}/geo`;
    const response = await this.request({
      method: 'GET',
      url,
      headers: {
        Referer: `${this.baseUrl}/meters/${meterId}`
      }
    });
    return response.data?.data || null;
  }

  /**
   * Fetches interval consumption/energy records for a meter.
   * @param {string} meterId 
   */
  async getMeterEnergy(meterId) {
    const url = `${this.baseUrl}/portal/meters/${meterId}/energy`;
    const response = await this.request({
      method: 'GET',
      url,
      headers: {
        Referer: `${this.baseUrl}/meters/${meterId}`
      }
    });
    return response.data?.data || [];
  }

  /**
   * Fetches the bulk export using HMAC-SHA256 request signing.
   */
  async getBulkExport(page = 1) {
    // 1. Fetch ephemeral signing secret
    const keysResponse = await this.request({
      method: 'GET',
      url: `${this.baseUrl}/portal/keys`,
      headers: {
        Referer: `${this.baseUrl}/transformers`
      }
    });

    const signingSecret = keysResponse.data?.data?.signingSecret;
    if (!signingSecret) {
      throw new Error('Could not retrieve signing secret from Urja Ops portal');
    }

    // 2. Generate HMAC signature: canonical string = [method, path, queryString, timestamp].join("\n")
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const queryString = `page=${page}`;
    const payload = ['GET', '/portal/export', queryString, timestamp].join('\n');
    const signature = crypto.createHmac('sha256', signingSecret).update(payload).digest('hex');

    // 3. Make signed export request
    const exportResponse = await this.request({
      method: 'GET',
      url: `${this.baseUrl}/portal/export?${queryString}`,
      headers: {
        'x-timestamp': timestamp,
        'x-signature': signature,
        Referer: `${this.baseUrl}/transformers`
      }
    });

    return exportResponse.data?.data || [];
  }

  /**
   * Fetches distribution transformers page from internal JSON endpoint.
   */
  async getTransformers(page = 1) {
    const response = await this.request({
      method: 'GET',
      url: `${this.baseUrl}/portal/dts?page=${page}`,
      headers: {
        Referer: `${this.baseUrl}/transformers`
      }
    });

    return response.data?.data || [];
  }
}

export default new UrjaClient();
