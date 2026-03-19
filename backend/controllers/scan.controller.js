const { spawnWorker } = require('../utils/workerManager');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

async function startScan(req, res) {
  try {
    const { walletCount, apiKey, mode, chains, tokens, startIndex, targetAddress } = req.body;

    logger.info({ walletCount, mode, chains }, 'Starting scan');

    const data = await spawnWorker({
      walletCount,
      apiKey,
      mode,
      chains,
      tokens,
      startIndex,
      targetAddress
    });

    return success(res, data);
  } catch (err) {
    logger.error({ err }, 'Scan failed');
    return error(res, err.message);
  }
}

module.exports = {
  startScan
};
