import urjaClient from './src/services/urjaClient.js';
import * as cheerio from 'cheerio';

async function checkTransformers() {
  const resp = await urjaClient.request({
    method: 'GET',
    url: 'https://urja-ops.flockenergy.tech/transformers'
  });
  const $ = cheerio.load(resp.data);
  console.log('Tables:', $('table').length);
  console.log('Rows:', $('tr').length);
  $('tr').each((i, el) => {
    if (i < 5) console.log(`Row ${i}:`, $(el).text().replace(/\s+/g, ' ').trim());
  });
  process.exit(0);
}

checkTransformers();
