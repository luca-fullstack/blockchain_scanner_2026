const express = require('express');
const router = express.Router();
const { success } = require('../utils/response');
const scanRoutes = require('./scan.route');

// Health check
router.get('/api/health', (req, res) => {
  success(res, { timestamp: Date.now(), status: 'ok' });
});

// Scan routes
router.use('/api/scan', scanRoutes);

module.exports = router;
