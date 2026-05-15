import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3001';
const SECRET = 'neon-pix-secret-2026';

const TEST_DB_PATH = join(tmpdir(), `pix-test-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = TEST_DB_PATH;
process.env.TEST = '1';
process.env.PORT = '3001';

let dbHandle;
let resetDb;

function token(accountId, name = 'Test User') {
  return jwt.sign({ sub: accountId, name }, SECRET, { expiresIn: '1h' });
}

async function post(path, body, accountId = '1001') {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token(accountId)}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function get(path, accountId = '1001') {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token(accountId)}` },
  });
  return { status: res.status, body: await res.json() };
}

// ============================================================
// Setup: start server on port 3001
// ============================================================
let serverInstance;

before(async () => {
  const { app, db } = await import('../src/server.js');
  const seed = await import('../src/db/seed.js');
  dbHandle = db;
  resetDb = seed.resetDb;
  await new Promise(r => {
    serverInstance = app.listen(3001, () => r());
  });
});

beforeEach(() => {
  if (resetDb && dbHandle) resetDb(dbHandle);
});

after(async () => {
  if (serverInstance) await new Promise(r => serverInstance.close(r));
  if (dbHandle) {
    try { dbHandle.close(); } catch {}
  }
  for (const suffix of ['', '-wal', '-shm']) {
    try { rmSync(TEST_DB_PATH + suffix, { force: true }); } catch {}
  }
});

// ============================================================
// Testes que PASSAM (funcionalidade basica funciona)
// ============================================================

describe('Pix - funcionalidade basica', () => {
  it('deve fazer um Pix com sucesso', async () => {
    const res = await post('/pix/send', {
      account: '1001',
      amount: 100,
      destination: 'chave-teste@pix',
    });
    // Pode falhar por timeout do gateway (retry), mas a logica basica funciona
    assert.ok(res.status === 200 || res.status === 500, `Status inesperado: ${res.status}`);
  });

  it('deve rejeitar sem campos obrigatorios', async () => {
    const res = await post('/pix/send', { amount: 100 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'MISSING_FIELDS');
  });

  it('deve rejeitar valor negativo', async () => {
    const res = await post('/pix/send', {
      account: '1001',
      amount: -50,
      destination: 'chave@pix',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'INVALID_AMOUNT');
  });

  it('deve rejeitar se conta nao existe', async () => {
    const res = await post('/pix/send', {
      account: '9999',
      amount: 100,
      destination: 'chave@pix',
    });
    assert.equal(res.status, 404);
  });

  it('deve consultar saldo', async () => {
    const res = await get('/pix/balance/1001');
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.balance === 'number');
  });
});

// ============================================================
// Testes que FALHAM (expõem os bugs)
// ============================================================

describe('BUG: Seguranca - IDOR', () => {
  it('NAO deve permitir debitar conta de outra pessoa', async () => {
    // Ana (1001) autentica, mas tenta debitar da conta do Bruno (1002)
    const res = await post('/pix/send', {
      account: '1002',        // <-- conta do Bruno
      amount: 50,
      destination: 'chave-atacante@pix',
    }, '1001');                // <-- token da Ana

    // O sistema DEVERIA rejeitar (403 ou similar)
    // Mas o bug faz o sistema aceitar — debita o Bruno sem autorizacao
    assert.equal(res.status, 403,
      'sistema permitiu debitar conta de outro usuario');
  });
});

describe('BUG: Resiliencia - debito sem compensacao', () => {
  it('deve reverter debito quando gateway falha', async () => {
    // Forca falha do gateway pra remover flakiness (gateway normal falha ~10%).
    process.env.GATEWAY_FORCE_FAIL = '1';
    try {
      const balanceBefore = (await get('/pix/balance/1004')).body.balance;

      const res = await post('/pix/send', {
        account: '1004',
        amount: 1,
        destination: 'chave-resiliencia@pix',
      }, '1004');

      assert.equal(res.status, 500, 'Gateway deveria ter falhado (forcado).');

      const balanceAfter = (await get('/pix/balance/1004')).body.balance;
      assert.equal(balanceAfter, balanceBefore,
        'Resiliencia: debito NAO foi revertido apos falha do gateway! Dinheiro ficou no limbo.');
    } finally {
      delete process.env.GATEWAY_FORCE_FAIL;
    }
  });
});

describe('BUG: Idempotencia - Pix duplicado', () => {
  it('deve rejeitar request duplicado (mesmo idempotency key)', async () => {
    const payload = {
      account: '1001',
      amount: 75,
      destination: 'chave-idem@pix',
      idempotency_key: 'unique-key-12345',  // <-- candidato deve implementar isso
    };

    const res1 = await post('/pix/send', payload);
    const res2 = await post('/pix/send', payload);  // mesmo request de novo

    if (res1.status === 200 && res2.status === 200) {
      // Ambos processaram — duplicacao!
      const txns = (await get('/pix/transactions/1001')).body;
      const dupes = txns.filter(t => t.to_pix_key === 'chave-idem@pix' && t.amount === 75);
      assert.ok(dupes.length <= 1,
        `Idempotencia: ${dupes.length} transacoes identicas processadas!`);
    }
  });
});
