import axios from 'axios';

async function runAllTests() {
  const base = 'http://localhost:3000';
  console.log('====================================================');
  console.log('🧪 Running Urja Meter Ops API Test Suite');
  console.log('====================================================');

  try {
    // 1. Health check
    const health = await axios.get(`${base}/health`);
    console.log('✅ 1. Health check passed:', health.data.status);

    // 2. Meters list & search
    const meters = await axios.get(`${base}/api/v1/meters?page=1&q=`);
    console.log(`✅ 2. Meters list passed: ${meters.data.data.length} meters on page 1 (Total: ${meters.data.pagination.total})`);

    // 3. Single meter details (metadata + hierarchy + geo)
    const detail = await axios.get(`${base}/api/v1/meters/J100000`);
    console.log(`✅ 3. Meter detail passed: J100000 [Make: ${detail.data.data.make}, DT: ${detail.data.data.hierarchy?.dt?.name}]`);
    console.log(`      Coordinates: Lat ${detail.data.data.location?.latitude}, Lng ${detail.data.data.location?.longitude}`);

    // 4. Interval consumption history
    const consumption = await axios.get(`${base}/api/v1/meters/J100000/consumption`);
    console.log(`✅ 4. Consumption history passed: ${consumption.data.count} interval records normalized.`);

    // 5. Bonus: HMAC-signed bulk export
    const exportRes = await axios.get(`${base}/api/v1/meters/export`);
    console.log(`✅ 5. Bulk export (HMAC) passed: ${exportRes.data.count} meters exported.`);

    // 6. Bonus: Grid distribution hierarchy tree
    const hierarchyRes = await axios.get(`${base}/api/v1/hierarchy`);
    const zones = Object.keys(hierarchyRes.data.data);
    console.log(`✅ 6. Grid hierarchy tree passed: Zones found: ${zones.join(', ')}`);

    // 7. Bonus: Transformers list
    const dtRes = await axios.get(`${base}/api/v1/transformers`);
    console.log(`✅ 7. Transformers passed: ${dtRes.data.count} transformers loaded.`);

    console.log('====================================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! (100% Endpoints Operational)');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

runAllTests();
