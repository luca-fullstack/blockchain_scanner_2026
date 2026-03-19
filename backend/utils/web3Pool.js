const { Web3 } = require('web3');
const { RPC_URLS } = require('../config/constants');
const logger = require('./logger');

const pool = new Map();

function getWeb3(chainKey, apiKey = '') {
  const cacheKey = `${chainKey}:${apiKey}`;
  if (pool.has(cacheKey)) return pool.get(cacheKey);

  const rpcUrls = RPC_URLS[chainKey];
  if (!rpcUrls || rpcUrls.length === 0) {
    throw new Error(`No RPC URLs configured for chain: ${chainKey}`);
  }

  const rpcUrl = rpcUrls[0].replace('{API_KEY}', apiKey);
  const web3 = new Web3(rpcUrl);
  pool.set(cacheKey, web3);
  logger.debug({ chainKey }, 'Created Web3 instance');
  return web3;
}

function clearPool() {
  pool.clear();
  logger.debug('Web3 pool cleared');
}

module.exports = { getWeb3, clearPool };
