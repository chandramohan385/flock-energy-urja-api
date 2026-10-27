/**
 * Normalization utilities to transform messy legacy Urja Ops data
 * into clean, typed, and standardized JSON.
 */

/**
 * Converts non-standard DD/MM/YYYY HH:MM date strings to ISO-8601 strings.
 * Example: "23/06/2026 23:30" -> "2026-06-23T23:30:00.000Z"
 * @param {string} dateStr 
 * @returns {string|null} ISO-8601 timestamp or null if invalid
 */
export function parseLegacyDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) {
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? dateStr : fallback.toISOString();
  }

  const [, day, month, year, hours, minutes] = match;
  // Format as ISO UTC
  const isoDate = new Date(Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10)
  ));

  return isoDate.toISOString();
}

/**
 * Normalizes an array of consumption / energy readings.
 * Casts numeric strings to floats / integers and standardizes timestamps.
 * @param {Array} records 
 * @returns {Array} Clean typed consumption records
 */
export function normalizeEnergyRecords(records = []) {
  if (!Array.isArray(records)) return [];

  return records.map((rec) => ({
    timestamp: parseLegacyDate(rec.timestamp),
    kwh: rec.kwh !== undefined ? parseFloat(rec.kwh) : null,
    kvah: rec.kvah !== undefined ? parseFloat(rec.kvah) : null,
    voltR: rec.voltR !== undefined ? parseInt(rec.voltR, 10) : null
  }));
}

/**
 * Normalizes geographic coordinates to IEEE-754 floats.
 * @param {Object} geo 
 * @returns {Object|null}
 */
export function normalizeGeo(geo) {
  if (!geo) return null;
  const lat = geo.latitude !== undefined ? geo.latitude : geo.lat;
  const lng = geo.longitude !== undefined ? geo.longitude : geo.lng;

  return {
    latitude: lat !== undefined ? parseFloat(lat) : null,
    longitude: lng !== undefined ? parseFloat(lng) : null
  };
}

/**
 * Parses code and name from standard hierarchy string.
 * Example: "Jaipur Zone 1 (Z-01)" -> { name: "Jaipur Zone 1", code: "Z-01" }
 * @param {string} text 
 * @returns {Object}
 */
export function parseHierarchyItem(text) {
  if (!text || typeof text !== 'string') return { name: text || '', code: '' };
  const match = text.match(/^(.*?)(?:\s*\((.*?)\))?$/);
  if (match) {
    return {
      name: (match[1] || '').trim(),
      code: (match[2] || '').trim()
    };
  }
  return { name: text.trim(), code: '' };
}

/**
 * Normalizes raw hierarchy mapping from Urja Ops.
 * @param {Object} rawHierarchy 
 * @returns {Object} Structured hierarchy
 */
export function normalizeHierarchy(rawHierarchy = {}) {
  return {
    zone: parseHierarchyItem(rawHierarchy.Zone || rawHierarchy.zone?.name || ''),
    circle: parseHierarchyItem(rawHierarchy.Circle || rawHierarchy.circle?.name || ''),
    division: parseHierarchyItem(rawHierarchy.Division || rawHierarchy.division?.name || ''),
    subdivision: parseHierarchyItem(rawHierarchy.Subdivision || rawHierarchy.subdivision?.name || ''),
    substation: parseHierarchyItem(rawHierarchy['Sub Station'] || rawHierarchy.substation?.name || ''),
    feeder: parseHierarchyItem(rawHierarchy.Feeder || rawHierarchy.feeder?.name || ''),
    dt: parseHierarchyItem(rawHierarchy.DT || rawHierarchy.dt?.name || '')
  };
}
