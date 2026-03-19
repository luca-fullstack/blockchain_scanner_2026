require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { CONFIG } = require('./config/constants');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { killAllWorkers } = require('./utils/workerManager');
const { clearPool } = require('./utils/web3Pool');
const logger = require('./utils/logger');

const app = express();

app.use(cors({
  origin: `http://localhost:${CONFIG.fePort}`,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 60000, max: 100 }));

app.use('/', routes);
app.use(errorHandler);

// Start server (HTTPS with spdy or HTTP fallback)
let server;
const certPath = path.join(__dirname, 'cert');
const keyFile = path.join(certPath, 'server.key');
const certFile = path.join(certPath, 'server.cert');

if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
  const spdy = require('spdy');
  const options = {
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile)
  };
  server = spdy.createServer(options, app).listen(CONFIG.port, () => {
    logger.info({ port: CONFIG.port, protocol: 'HTTPS' }, 'Server started');
  });
} else {
  logger.info('No SSL certs found, starting HTTP server');
  server = app.listen(CONFIG.port, () => {
    logger.info({ port: CONFIG.port, protocol: 'HTTP' }, 'Server started');
  });
}

// Graceful shutdown
function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received');
  killAllWorkers();
  clearPool();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
