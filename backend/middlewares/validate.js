const { CONFIG } = require('../config/constants');
const { error } = require('../utils/response');

function checkValidRequest(req, res, next) {
  const clientKey = req.headers['client-key'];
  const clientName = req.headers['client-name'];

  if (clientKey !== CONFIG.clientKey || clientName !== CONFIG.clientName) {
    return error(res, 'Invalid client', 403);
  }
  next();
}

module.exports = { checkValidRequest };
