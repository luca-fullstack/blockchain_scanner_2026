const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scan.controller');
const { checkValidRequest } = require('../middlewares/validate');
const { validate, startScanSchema } = require('../middlewares/validators');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/scan/start - Start scanning
router.post('/start', checkValidRequest, validate(startScanSchema), asyncHandler(scanController.startScan));

module.exports = router;
