const logger = require('../utils/logger');
const { error } = require('../utils/response');

function errorHandler(err, req, res, next) {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  return error(res, err.message || 'Internal server error', err.statusCode || 500);
}

module.exports = errorHandler;
