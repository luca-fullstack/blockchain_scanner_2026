require('dotenv').config();

const CONFIG = {
  version: '1.0',
  port: parseInt(process.env.PORT) || 2010,
  clientKey: process.env.CLIENT_KEY || 'Multichain_Mining',
  clientName: process.env.CLIENT_NAME || 'Multichain_Mining',
  baseUrl: 'localhost',
  fePort: parseInt(process.env.FE_PORT) || 1010,
  apiTimeout: parseInt(process.env.API_TIMEOUT) || 600000,
  jwtSecret: process.env.JWT_SECRET || 'blockchain_scanner_secret_key'
};

const SCAN_DEFAULTS = {
  numOfWallets: 3000,
  defaultChain: 'BNB CHAIN',
  defaultToken: 'USDT',
  defaultMode: 'private',
  batchDelay: 1500,
  maxBatchSize: 10000,
  arbBatchSize: 5000,
  balanceThreshold: 0.0000001,
  gasLimit: 21000
};

const infuraKey = process.env.INFURA_API_KEY || '';

const RPC_URLS = {
  ETH: [
    process.env.ETH_RPC_URL || `https://mainnet.infura.io/v3/${infuraKey}`,
    'https://eth.drpc.org',
    'https://rpc.ankr.com/eth'
  ],
  BNB: [
    process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.defibit.io',
    'https://bsc-dataseed1.ninicoin.io',
    'https://bsc-dataseed2.defibit.io'
  ],
  POLYGON: [process.env.POLYGON_RPC_URL || `https://polygon-mainnet.infura.io/v3/${infuraKey}`],
  OPTIMISM: [process.env.OPTIMISM_RPC_URL || `https://optimism-mainnet.infura.io/v3/${infuraKey}`],
};

const TOKEN_ADDRESSES = {
  ETH: {
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    BTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    NATIVE: '0x0000000000000000000000000000000000000000'
  },
  BNB: {
    NATIVE: '0x0000000000000000000000000000000000000000',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    BTC: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'
  },
  POLYGON: {
    NATIVE: '0x0000000000000000000000000000000000000000',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    BTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    ETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
  },
  OPTIMISM: {
    NATIVE: '0x0000000000000000000000000000000000000000',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    BTC: '0x68f180fcCe6836688e9084f035309E29Bf0A2095'
  },
};

const CHAIN_CONFIG = {
  'ETH CHAIN': {
    key: 'ETH',
    batchSize: 10000,
    balanceCheckerAddress: process.env.BALANCE_CHECKER_ETH || '0xb1f8e55c7f64d203c1400b9d8555d050f94adf39',
    explorerUrl: 'https://etherscan.io',
    gasLimit: 21000n,
    fixedGasPrice: null
  },
  'BNB CHAIN': {
    key: 'BNB',
    batchSize: 10000,
    balanceCheckerAddress: process.env.BALANCE_CHECKER_BNB || '0x2352c63A83f9Fd126af8676146721Fa00924d7e4',
    explorerUrl: 'https://bscscan.com',
    gasLimit: 21000n,
    fixedGasPrice: 1000000000n // 1 gwei for BSC
  },
  'POLYGON CHAIN': {
    key: 'POLYGON',
    batchSize: 10000,
    balanceCheckerAddress: process.env.BALANCE_CHECKER_POLYGON || '0x2352c63A83f9Fd126af8676146721Fa00924d7e4',
    explorerUrl: 'https://polygonscan.com',
    gasLimit: 21000n,
    fixedGasPrice: null
  },
  'OPTIMISM CHAIN': {
    key: 'OPTIMISM',
    batchSize: 10000,
    balanceCheckerAddress: process.env.BALANCE_CHECKER_OPTIMISM || '0xB1c568e9C3E6bdaf755A60c7418C269eb11524FC',
    explorerUrl: 'https://optimistic.etherscan.io',
    gasLimit: 21000n,
    fixedGasPrice: null
  },
};

module.exports = {
  CONFIG,
  SCAN_DEFAULTS,
  RPC_URLS,
  TOKEN_ADDRESSES,
  CHAIN_CONFIG
};
