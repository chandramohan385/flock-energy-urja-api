import express from 'express';
import urjaClient from '../services/urjaClient.js';
import { normalizeEnergyRecords, normalizeGeo, normalizeHierarchy } from '../services/normalizer.js';

const router = express.Router();

/**
 * GET /api/v1/meters
 * Retrieves a paginated list of meters with optional search query.
 */
router.get('/meters', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    const page = parseInt(req.query.page, 10) || 1;

    const raw = await urjaClient.searchMeters(q, page);

    res.json({
      success: true,
      data: (raw.data || []).map((m) => ({
        meterId: m.meterId,
        serialNo: m.serialNo,
        make: m.make,
        phaseType: m.phaseType,
        installationStatus: m.installStatus,
        dtCode: m.dtCode
      })),
      pagination: {
        page: raw.page || page,
        pageSize: raw.pageSize || 20,
        total: raw.total || (raw.data ? raw.data.length : 0),
        totalPages: raw.total ? Math.ceil(raw.total / (raw.pageSize || 20)) : 1
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/meters/export
 * Retrieves full dataset of meters via HMAC-signed bulk export.
 */
router.get('/meters/export', async (req, res, next) => {
  try {
    const rawMeters = await urjaClient.getBulkExport();

    const normalized = rawMeters.map((m) => ({
      meterId: m.meterId,
      serialNo: m.serialNo,
      make: m.make,
      phaseType: m.phaseType,
      installationStatus: m.installStatus,
      installationType: m.installType,
      build: m.build,
      dtCode: m.dtCode,
      hierarchy: normalizeHierarchy(m.hierarchy),
      location: normalizeGeo(m.geo)
    }));

    res.json({
      success: true,
      count: normalized.length,
      data: normalized
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/meters/:id
 * Retrieves comprehensive details for a single meter (metadata + hierarchy + coordinates).
 */
router.get('/meters/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Parallel fetch of meter details and coordinates
    const [details, rawGeo] = await Promise.all([
      urjaClient.getMeterDetails(id),
      urjaClient.getMeterGeo(id).catch(() => null)
    ]);

    res.json({
      success: true,
      data: {
        meterId: details.meterId,
        serialNo: details.serialNo,
        make: details.make,
        phaseType: details.phaseType,
        installationStatus: details.installationStatus,
        installationType: details.installationType,
        location: normalizeGeo(rawGeo),
        hierarchy: normalizeHierarchy(details.rawHierarchy)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/meters/:id/consumption
 * Retrieves interval consumption history with standardized ISO timestamps and float values.
 */
router.get('/meters/:id/consumption', async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawRecords = await urjaClient.getMeterEnergy(id);
    const normalizedRecords = normalizeEnergyRecords(rawRecords);

    res.json({
      success: true,
      meterId: id,
      count: normalizedRecords.length,
      data: normalizedRecords
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/hierarchy
 * Reconstructs and returns the full distribution grid tree.
 */
router.get('/hierarchy', async (req, res, next) => {
  try {
    const rawMeters = await urjaClient.getBulkExport();

    // Group hierarchy: Zone -> Circle -> Division -> Subdivision -> Substation -> Feeder -> DT -> Meters
    const hierarchyTree = {};

    for (const m of rawMeters) {
      const h = m.hierarchy || {};
      const zoneName = h.zone?.name || 'Unknown Zone';
      const circleName = h.circle?.name || 'Unknown Circle';
      const divisionName = h.division?.name || 'Unknown Division';
      const substationName = h.substation?.name || 'Unknown Substation';
      const feederName = h.feeder?.name || 'Unknown Feeder';
      const dtCode = h.dt?.code || m.dtCode || 'Unknown DT';
      const dtName = h.dt?.name || dtCode;

      if (!hierarchyTree[zoneName]) hierarchyTree[zoneName] = { code: h.zone?.code, circles: {} };
      if (!hierarchyTree[zoneName].circles[circleName]) {
        hierarchyTree[zoneName].circles[circleName] = { code: h.circle?.code, divisions: {} };
      }
      if (!hierarchyTree[zoneName].circles[circleName].divisions[divisionName]) {
        hierarchyTree[zoneName].circles[circleName].divisions[divisionName] = { code: h.division?.code, substations: {} };
      }
      if (!hierarchyTree[zoneName].circles[circleName].divisions[divisionName].substations[substationName]) {
        hierarchyTree[zoneName].circles[circleName].divisions[divisionName].substations[substationName] = { code: h.substation?.code, feeders: {} };
      }
      if (!hierarchyTree[zoneName].circles[circleName].divisions[divisionName].substations[substationName].feeders[feederName]) {
        hierarchyTree[zoneName].circles[circleName].divisions[divisionName].substations[substationName].feeders[feederName] = { code: h.feeder?.code, transformers: {} };
      }
      if (!hierarchyTree[zoneName].circles[circleName].divisions[divisionName].substations[substationName].feeders[feederName].transformers[dtCode]) {
        hierarchyTree[zoneName].circles[circleName].divisions[divisionName].substations[substationName].feeders[feederName].transformers[dtCode] = {
          name: dtName,
          code: dtCode,
          meters: []
        };
      }

      hierarchyTree[zoneName].circles[circleName].divisions[divisionName].substations[substationName].feeders[feederName].transformers[dtCode].meters.push({
        meterId: m.meterId,
        serialNo: m.serialNo,
        status: m.installStatus,
        make: m.make
      });
    }

    res.json({
      success: true,
      data: hierarchyTree
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/transformers
 * Retrieves list of distribution transformers.
 */
router.get('/transformers', async (req, res, next) => {
  try {
    const transformers = await urjaClient.getTransformers();
    res.json({
      success: true,
      count: transformers.length,
      data: transformers
    });
  } catch (error) {
    next(error);
  }
});

export default router;
