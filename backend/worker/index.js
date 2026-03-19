const RandomService = require('../services/random.service');
const RunService = require('../services/run.service');
const logger = require('../utils/logger');

process.on('message', async (msg) => {
  try {
    const { walletCount, apiKey, mode, chains, tokens, startIndex, targetAddress } = msg;

    logger.info({ walletCount, mode, chains }, 'Worker started');

    // Generate addresses based on mode
    let addresses;
    switch (mode) {
      case 'sequential':
        addresses = RandomService.generateSequentialAddresses(walletCount, startIndex);
        break;
      case 'mnemonic':
        addresses = await RandomService.generateMnemonicAddresses(walletCount);
        break;
      case 'random':
      default:
        addresses = RandomService.generateRandomAddresses(walletCount);
        break;
    }

    logger.info({ addressCount: addresses.length }, 'Addresses generated, checking balances');

    // Check balances on selected chains
    const results = await RunService.run(apiKey, addresses, tokens, chains, targetAddress);

    // Send results back to parent process
    process.send({ type: 'result', data: results });

    setTimeout(() => process.exit(0), 500);
  } catch (error) {
    logger.error({ err: error }, 'Worker error');
    process.send({ type: 'error', message: error.message });
    setTimeout(() => process.exit(1), 500);
  }
});
