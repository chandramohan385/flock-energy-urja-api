import axios from 'axios';

async function testExtensions() {
  const base = 'http://localhost:3000';
  console.log('Testing bonus extension endpoints...');

  try {
    const exportRes = await axios.get(`${base}/api/v1/meters/export`);
    console.log('1. Bulk export count:', exportRes.data.count, 'First meter:', exportRes.data.data[0].meterId);

    const hierarchyRes = await axios.get(`${base}/api/v1/hierarchy`);
    const zones = Object.keys(hierarchyRes.data.data);
    console.log('2. Hierarchy zones found:', zones);

    const transformersRes = await axios.get(`${base}/api/v1/transformers`);
    console.log('3. Transformers count:', transformersRes.data.count, 'First DT:', transformersRes.data.data[0]);

    console.log('\nAll bonus endpoints passed with flying colors!');
    process.exit(0);
  } catch (err) {
    console.error('Error testing extensions:', err.response?.data || err.message);
    process.exit(1);
  }
}

testExtensions();
