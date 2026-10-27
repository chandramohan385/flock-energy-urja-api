import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Download,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Layers,
  MapPin,
  RefreshCw,
  X
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('meters'); // 'meters' | 'hierarchy'
  const [meters, setMeters] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  // Modal inspection state
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [meterDetails, setMeterDetails] = useState(null);
  const [consumption, setConsumption] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Hierarchy state
  const [hierarchyData, setHierarchyData] = useState(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);

  // Fetch meters list
  const fetchMeters = async (page = 1, query = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/meters?page=${page}&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setMeters(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Error fetching meters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeters(pagination.page, searchQuery);
  }, [pagination.page]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMeters(1, searchQuery);
  };

  // Inspect meter
  const inspectMeter = async (meterId) => {
    setSelectedMeter(meterId);
    setLoadingDetails(true);
    setMeterDetails(null);
    setConsumption([]);

    try {
      const [detailRes, energyRes] = await Promise.all([
        fetch(`/api/v1/meters/${meterId}`).then((r) => r.json()),
        fetch(`/api/v1/meters/${meterId}/consumption`).then((r) => r.json())
      ]);

      if (detailRes.success) setMeterDetails(detailRes.data);
      if (energyRes.success) setConsumption(energyRes.data);
    } catch (err) {
      console.error('Error loading meter details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Load hierarchy
  const loadHierarchy = async () => {
    setLoadingHierarchy(true);
    try {
      const res = await fetch('/api/v1/hierarchy');
      const data = await res.json();
      if (data.success) setHierarchyData(data.data);
    } catch (err) {
      console.error('Error loading hierarchy:', err);
    } finally {
      setLoadingHierarchy(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'hierarchy' && !hierarchyData) {
      loadHierarchy();
    }
  }, [activeTab]);

  // Bulk export trigger
  const triggerBulkExport = () => {
    window.open('/api/v1/meters/export', '_blank');
  };

  // Filtered meters for client status filtering
  const displayedMeters = meters.filter((m) => {
    if (statusFilter === 'ALL') return true;
    return m.installationStatus?.toUpperCase() === statusFilter;
  });

  return (
    <div className="app-container">
      {/* Header */}
      <header>
        <div className="brand">
          <Zap size={24} color="#2563eb" fill="#2563eb" />
          <h1>Urja Meter Ops</h1>
          <span className="brand-badge">REST API 1.0</span>
        </div>

        <nav className="nav-links">
          <button
            className={`nav-btn ${activeTab === 'meters' ? 'active' : ''}`}
            onClick={() => setActiveTab('meters')}
          >
            Meters Fleet
          </button>
          <button
            className={`nav-btn ${activeTab === 'hierarchy' ? 'active' : ''}`}
            onClick={() => setActiveTab('hierarchy')}
          >
            Grid Hierarchy
          </button>
          <a
            href="http://localhost:3000/docs"
            target="_blank"
            rel="noreferrer"
            className="nav-btn"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Swagger Docs <ExternalLink size={14} />
          </a>
        </nav>
      </header>

      <main>
        {/* KPI Banner */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div>
              <div className="kpi-title">Total Smart Meters</div>
              <div className="kpi-value">{pagination.total || 405}</div>
            </div>
            <div className="kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Activity size={22} />
            </div>
          </div>

          <div className="kpi-card">
            <div>
              <div className="kpi-title">Active / Installed</div>
              <div className="kpi-value" style={{ color: '#059669' }}>234</div>
            </div>
            <div className="kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <CheckCircle size={22} />
            </div>
          </div>

          <div className="kpi-card">
            <div>
              <div className="kpi-title">Faulty Meters</div>
              <div className="kpi-value" style={{ color: '#dc2626' }}>82</div>
            </div>
            <div className="kpi-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <AlertTriangle size={22} />
            </div>
          </div>

          <div className="kpi-card">
            <div>
              <div className="kpi-title">Bulk Export (HMAC)</div>
              <button
                onClick={triggerBulkExport}
                className="btn-action"
                style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} /> Download Fleet JSON
              </button>
            </div>
            <div className="kpi-icon" style={{ background: '#f8fafc', color: '#64748b' }}>
              <Layers size={22} />
            </div>
          </div>
        </div>

        {activeTab === 'meters' && (
          <>
            {/* Search & Filter Bar */}
            <div className="controls-bar">
              <form onSubmit={handleSearch} className="search-box">
                <Search size={18} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search by meter ID or serial..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>

              <div className="filter-group">
                {['ALL', 'INSTALLED', 'FAULTY', 'DECOMMISSIONED'].map((st) => (
                  <button
                    key={st}
                    className={`filter-btn ${statusFilter === st ? 'active' : ''}`}
                    onClick={() => setStatusFilter(st)}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Meters Table */}
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Meter ID</th>
                    <th>Serial No</th>
                    <th>Make</th>
                    <th>Phase</th>
                    <th>Status</th>
                    <th>Transformer (DT)</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        Loading meters from Urja Ops...
                      </td>
                    </tr>
                  ) : displayedMeters.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        No meters found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedMeters.map((m) => {
                      const isInstalled = m.installationStatus?.toLowerCase() === 'installed';
                      const isFaulty = m.installationStatus?.toLowerCase() === 'faulty';
                      return (
                        <tr key={m.meterId}>
                          <td style={{ fontWeight: 600, color: '#1e293b' }}>{m.meterId}</td>
                          <td style={{ fontFamily: 'monospace' }}>{m.serialNo}</td>
                          <td>{m.make}</td>
                          <td>
                            <span className="badge badge-phase">{m.phaseType}</span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                isInstalled
                                  ? 'badge-installed'
                                  : isFaulty
                                  ? 'badge-faulty'
                                  : 'badge-decommissioned'
                              }`}
                            >
                              {m.installationStatus}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 500, color: '#475569' }}>{m.dtCode}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn-action" onClick={() => inspectMeter(m.meterId)}>
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="pagination-bar">
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total)
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="pagination-btn"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  >
                    Previous
                  </button>
                  <button
                    className="pagination-btn"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Hierarchy Tab */}
        {activeTab === 'hierarchy' && (
          <div className="table-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#1e293b' }}>
              Electrical Distribution Network Tree
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Reconstructed 7-level hierarchy from Urja Meter Ops: Zone ➔ Circle ➔ Division ➔ Substation ➔ Feeder ➔ Distribution Transformer ➔ Meters.
            </p>

            {loadingHierarchy ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                Reconstructing network tree...
              </div>
            ) : hierarchyData ? (
              <div>
                {Object.entries(hierarchyData).map(([zoneName, zone]) => (
                  <div key={zoneName} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
                      ⚡ {zoneName} ({zone.code})
                    </div>
                    {Object.entries(zone.circles || {}).map(([circleName, circle]) => (
                      <div key={circleName} className="tree-node">
                        <div style={{ fontWeight: 600, color: '#334155' }}>📍 {circleName}</div>
                        {Object.entries(circle.divisions || {}).map(([divName, division]) => (
                          <div key={divName} className="tree-node">
                            <div style={{ color: '#475569' }}>🏢 {divName}</div>
                            {Object.entries(division.substations || {}).map(([ssName, substation]) => (
                              <div key={ssName} className="tree-node">
                                <div style={{ color: '#64748b' }}>🔌 {ssName}</div>
                                {Object.entries(substation.feeders || {}).map(([feederName, feeder]) => (
                                  <div key={feederName} className="tree-node">
                                    <div style={{ color: '#0284c7', fontWeight: 500 }}>
                                      〰️ {feederName}
                                    </div>
                                    {Object.entries(feeder.transformers || {}).map(([dtCode, dt]) => (
                                      <div key={dtCode} className="tree-node">
                                        <div style={{ color: '#059669', fontWeight: 500 }}>
                                          🗲 {dt.name} ({dtCode}) —{' '}
                                          <span style={{ color: '#64748b' }}>
                                            {dt.meters?.length || 0} meters connected
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div>No hierarchy data available.</div>
            )}
          </div>
        )}

        {/* Meter Details Slide-over Modal */}
        {selectedMeter && (
          <div className="modal-overlay" onClick={() => setSelectedMeter(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedMeter(null)}>
                <X size={18} />
              </button>

              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
                  Fetching telemetry for {selectedMeter}...
                </div>
              ) : meterDetails ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Meter {meterDetails.meterId}</h2>
                    <span className="badge badge-installed">{meterDetails.installationStatus}</span>
                  </div>

                  {/* Network Breadcrumbs */}
                  {meterDetails.hierarchy && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        fontSize: '0.75rem',
                        color: '#64748b',
                        background: '#f8fafc',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        marginBottom: '1.5rem'
                      }}
                    >
                      <span>{meterDetails.hierarchy.zone?.name}</span> ›
                      <span>{meterDetails.hierarchy.circle?.name}</span> ›
                      <span>{meterDetails.hierarchy.division?.name}</span> ›
                      <span>{meterDetails.hierarchy.subdivision?.name}</span> ›
                      <span>{meterDetails.hierarchy.substation?.name}</span> ›
                      <span>{meterDetails.hierarchy.feeder?.name}</span> ›
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        {meterDetails.hierarchy.dt?.name}
                      </span>
                    </div>
                  )}

                  {/* Specs & Location Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                      <h3 style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
                        Nameplate Specifications
                      </h3>
                      <div style={{ fontSize: '0.875rem', lineHeight: '1.8' }}>
                        <div><strong>Serial No:</strong> {meterDetails.serialNo}</div>
                        <div><strong>Make:</strong> {meterDetails.make}</div>
                        <div><strong>Phase:</strong> {meterDetails.phaseType}</div>
                        <div><strong>Type:</strong> {meterDetails.installationType}</div>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                      <h3 style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
                        Geographic Telemetry
                      </h3>
                      {meterDetails.location?.latitude ? (
                        <div style={{ fontSize: '0.875rem', lineHeight: '1.8' }}>
                          <div><strong>Latitude:</strong> {meterDetails.location.latitude.toFixed(6)}</div>
                          <div><strong>Longitude:</strong> {meterDetails.location.longitude.toFixed(6)}</div>
                          <a
                            href={`https://maps.google.com/?q=${meterDetails.location.latitude},${meterDetails.location.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '0.5rem',
                              color: '#2563eb',
                              textDecoration: 'none',
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }}
                          >
                            <MapPin size={14} /> Open in Google Maps
                          </a>
                        </div>
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Coordinates unavailable</div>
                      )}
                    </div>
                  </div>

                  {/* Consumption Chart & Table */}
                  <div className="chart-container">
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      Interval Energy Consumption ({consumption.length} intervals)
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                      Normalized time-series energy telemetry with active kWh and Phase-R Voltage readings.
                    </p>

                    {consumption.length > 0 ? (
                      <>
                        {/* Interactive SVG Consumption Trend */}
                        <div style={{ height: '140px', width: '100%', marginBottom: '1rem' }}>
                          <svg viewBox="0 0 700 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                            <polyline
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="2.5"
                              points={consumption
                                .slice(0, 35)
                                .map((c, i) => {
                                  const x = (i / 34) * 680 + 10;
                                  // Normalize kWh to chart height
                                  const min = consumption[0]?.kwh || 40000;
                                  const max = consumption[consumption.length - 1]?.kwh || min + 10;
                                  const y = 100 - ((c.kwh - min) / (max - min || 1)) * 80;
                                  return `${x},${isNaN(y) ? 60 : y}`;
                                })
                                .join(' ')}
                            />
                            {consumption.slice(0, 35).map((c, i) => {
                              const x = (i / 34) * 680 + 10;
                              const min = consumption[0]?.kwh || 40000;
                              const max = consumption[consumption.length - 1]?.kwh || min + 10;
                              const y = 100 - ((c.kwh - min) / (max - min || 1)) * 80;
                              return (
                                <circle
                                  key={i}
                                  cx={x}
                                  cy={isNaN(y) ? 60 : y}
                                  r="3"
                                  fill="#2563eb"
                                >
                                  <title>{`${c.timestamp}: ${c.kwh} kWh (${c.voltR}V)`}</title>
                                </circle>
                              );
                            })}
                          </svg>
                        </div>

                        {/* Recent Interval Readings Table */}
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          <table style={{ fontSize: '0.8rem' }}>
                            <thead>
                              <tr>
                                <th>Timestamp (ISO)</th>
                                <th>kWh</th>
                                <th>kVAh</th>
                                <th>Voltage (V)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {consumption.slice(0, 8).map((c, idx) => (
                                <tr key={idx}>
                                  <td>{c.timestamp}</td>
                                  <td style={{ fontWeight: 600 }}>{c.kwh}</td>
                                  <td>{c.kvah}</td>
                                  <td>{c.voltR} V</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        No consumption readings recorded.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
