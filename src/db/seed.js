import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createDb() {
  const db = new Database(join(__dirname, '..', '..', 'pix.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS accounts;

    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      holder_name TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      pix_daily_limit REAL NOT NULL DEFAULT 5000,
      pix_used_today REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_account TEXT NOT NULL REFERENCES accounts(id),
      to_pix_key TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      gateway_ref TEXT,
      error TEXT
    );

    -- Contas fake
    INSERT INTO accounts (id, holder_name, balance, pix_daily_limit, pix_used_today) VALUES
      ('1001', 'Ana Silva',     15000.00, 5000.00,    0.00),
      ('1002', 'Bruno Santos',   3200.00, 5000.00,    0.00),
      ('1003', 'Carla Lima',      480.00, 5000.00,    0.00),
      ('1004', 'Diego Costa',   42000.00, 10000.00,   0.00),
      ('1005', 'Elena Rocha',     50.00,  5000.00,    0.00);

    -- Transacoes historicas (algumas com problemas)
    INSERT INTO transactions (from_account, to_pix_key, amount, status, created_at, error) VALUES
      ('1001', 'chave-maria@pix',   500.00, 'completed', '2026-03-26 10:00:00', NULL),
      ('1001', 'chave-maria@pix',   500.00, 'completed', '2026-03-26 10:00:01', NULL),
      ('1002', 'chave-joao@pix',    200.00, 'failed',    '2026-03-26 12:15:00', 'GATEWAY_TIMEOUT'),
      ('1002', 'chave-joao@pix',    200.00, 'debited',   '2026-03-26 12:15:00', 'GATEWAY_TIMEOUT'),
      ('1003', 'chave-pedro@pix',  1000.00, 'completed', '2026-03-26 14:30:00', NULL),
      ('1004', 'chave-ana@pix',    3000.00, 'completed', '2026-03-26 09:00:00', NULL),
      ('1001', 'chave-loja@pix',    150.00, 'completed', '2026-03-26 18:30:00', NULL);
  `);

  return db;
}
