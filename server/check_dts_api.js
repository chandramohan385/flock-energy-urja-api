import urjaClient from './src/services/urjaClient.js';

async function checkDtsEndpoint() {
  try {
    const resp = await urjaClient.request({
      method: 'GET',
      url: 'https://urja-ops.flockenergy.tech/portal/dts?page=1',
      headers: { Referer: 'https://urja-ops.flockenergy.tech/transformers' }
    });
    console.log('DTS response:', JSON.stringify(resp.data).slice(0, 300));
  } catch (e) {
    console.error('Error fetching /portal/dts:', e.response?.status, e.response?.data || e.message);
  }
  process.exit(0);
}

checkDtsEndpoint();
