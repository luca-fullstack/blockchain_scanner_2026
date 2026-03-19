const privateKeyToAddress = require('ethereum-private-key-to-address');
const { generateMnemonic } = require('@scure/bip39');
const { wordlist: englishWordlist } = require('@scure/bip39/wordlists/english');
const HdKeyring = require('@metamask/eth-hd-keyring');

const HEX_CHARS = '0123456789abcdef';

/**
 * Mode "private" - Random private key generation
 */
function generateRandomAddresses(count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    let privateKey = '';
    for (let j = 0; j < 64; j++) {
      privateKey += HEX_CHARS[Math.floor(Math.random() * 16)];
    }
    const address = privateKeyToAddress('0x' + privateKey);
    list.push({ address, privateKey, balances: [] });
  }
  return list;
}

/**
 * Mode "easy" - Sequential BigInt generation
 */
function generateSequentialAddresses(count, start) {
  const list = [];
  let current = BigInt(start || 1);
  for (let i = 0; i < count; i++) {
    const privateKey = current.toString(16).padStart(64, '0');
    const address = privateKeyToAddress('0x' + privateKey);
    list.push({ address, privateKey, balances: [] });
    current++;
  }
  return list;
}

/**
 * Mode "seed" - BIP39 mnemonic generation
 */
async function generateMnemonicAddresses(count, wordCount = 12) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const entropy = wordCount === 12 ? 128 : 256;
    const mnemonic = generateMnemonic(englishWordlist, entropy);

    const keyring = new HdKeyring({ mnemonic, numberOfAccounts: 1 });
    const accounts = await keyring.getAccounts();
    const address = accounts[0];

    list.push({ address, privateKey: '', mnemonic, balances: [] });
  }
  return list;
}

module.exports = {
  generateRandomAddresses,
  generateSequentialAddresses,
  generateMnemonicAddresses
};
