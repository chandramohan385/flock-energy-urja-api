import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootOpenApi = path.resolve(__dirname, '../../openapi.json');

export const openApiSpec = JSON.parse(fs.readFileSync(rootOpenApi, 'utf-8'));
