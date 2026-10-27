import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import metersRouter from './routes/meters.js';
import { openApiSpec } from './openapi.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Urja Meter Ops REST API'
  });
});

// Serve OpenAPI Specification JSON
app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openApiSpec);
});

// Interactive Swagger UI documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Urja Meter Ops API Docs'
}));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Mount REST API v1
app.use('/api/v1', metersRouter);

// Serve built React dashboard in production
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // Root redirect to docs if client not built
  app.get('/', (req, res) => {
    res.redirect('/docs');
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Urja Meter Ops REST API is running!`);
  console.log(`📡 Base API URL:      http://localhost:${PORT}/api/v1`);
  console.log(`📖 Interactive Docs:  http://localhost:${PORT}/docs`);
  console.log(`📄 OpenAPI Spec:      http://localhost:${PORT}/openapi.json`);
  console.log(`=======================================================`);
});

export default app;
