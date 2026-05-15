import express from 'express';
import jwt from 'jsonwebtoken';
import { createDb } from './db/seed.js';
import { createPixRouter } from './pix.js';
import { UserAccountService } from './services/user-account.js';
import { AntiFraudService } from './services/anti-fraud.js';
import { LedgerService } from './services/ledger.js';
import { GatewayService } from './services/gateway.js';

const JWT_SECRET = 'neon-pix-secret-2026';
const PORT = process.env.PORT || 3000;

// Init database with seed data
const db = createDb();

// Init services
const userAccount = new UserAccountService(db);
const antiFraud = new AntiFraudService();
const ledger = new LedgerService(db);
const gateway = new GatewayService();

// Express app
const app = express();
app.use(express.json());

// Public routes (no auth needed)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/dev/token/:accountId', (req, res) => {
  const account = userAccount.getAccount(req.params.accountId);
  if (account.error) return res.status(404).json(account);
  const token = jwt.sign(
    { sub: req.params.accountId, name: account.holder_name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  res.json({ token });
});

// Auth middleware
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'MISSING_TOKEN' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { sub: '1001', name: 'Ana Silva' }
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
});

// Routes
app.use('/pix', createPixRouter({ userAccount, antiFraud, ledger, gateway, db }));

// Start (only when run directly, not when imported by tests)
let server;
const isMain = process.argv[1] && !process.argv[1].includes('node_modules');
if (isMain && !process.env.TEST) {
  server = app.listen(PORT, () => {
    console.log(`Pix Service rodando em http://localhost:${PORT}`);
    console.log(`Contas disponiveis: 1001 (Ana), 1002 (Bruno), 1003 (Carla), 1004 (Diego), 1005 (Elena)`);
    console.log(`Gerar token: GET /dev/token/:accountId`);
  });
}

export { app, server, db };
