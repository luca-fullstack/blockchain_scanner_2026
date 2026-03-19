const logger = require('../utils/logger');

class SendCoinManager {
  constructor(web3) {
    this.web3 = web3;
  }

  addAccount(privateKey) {
    const account = this.web3.eth.accounts.privateKeyToAccount('0x' + privateKey);
    this.web3.eth.accounts.wallet.add(account);
    return account;
  }

  async createTx(from, to, amount, gasPrice, gasLimit) {
    const tx = {
      from,
      to,
      value: amount.toString(),
      gas: Number(gasLimit),
      gasPrice: gasPrice.toString()
    };
    const receipt = await this.web3.eth.sendTransaction(tx);
    return receipt.transactionHash;
  }

  /**
   * Send with pre-calculated gas price and limit (used by run.service)
   */
  async sendWithGas(fromPrivateKey, toAddress, gasPrice, gasLimit) {
    const account = this.addAccount(fromPrivateKey);
    const balance = BigInt(await this.web3.eth.getBalance(account.address));
    const fee = BigInt(gasPrice) * gasLimit;
    const amount = balance - fee;

    if (amount <= 0n) return null;

    // Attempt 1: gas price + 5%
    try {
      return await this.createTx(
        account.address,
        toAddress,
        amount,
        BigInt(gasPrice) * 105n / 100n,
        gasLimit
      );
    } catch (err) {
      logger.warn({ from: account.address, err }, 'First attempt failed, retrying with higher gas');
      // Attempt 2: recalculate with gas price + 10%
      const higherGasPrice = BigInt(gasPrice) * 110n / 100n;
      const higherFee = higherGasPrice * gasLimit;
      const retryAmount = balance - higherFee;
      if (retryAmount <= 0n) return null;
      return await this.createTx(
        account.address,
        toAddress,
        retryAmount,
        higherGasPrice,
        gasLimit
      );
    }
  }
}

module.exports = SendCoinManager;
