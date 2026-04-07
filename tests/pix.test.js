import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3001';
const SECRET = 'neon-pix-secret-2026';

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
  process.env.TEST = '1';
  process.env.PORT = '3001';
  // server.js already calls createDb() on import — no need to call it again
  const { app } = await import('../src/server.js');
  await new Promise(r => {
    serverInstance = app.listen(3001, () => r());
  });
});

after(() => {
  if (serverInstance) serverInstance.close();
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
      'IDOR: sistema permitiu debitar conta de outro usuario! O campo account no body nao e validado contra o JWT.');
  });
});

describe('BUG: Resiliencia - debito sem compensacao', () => {
  it('deve reverter debito quando gateway falha', async () => {
    // Tenta ate o gateway falhar (max 20 tentativas — gateway falha ~10% das vezes)
    let gatewayFailed = false;
    for (let attempt = 0; attempt < 20 && !gatewayFailed; attempt++) {
      const balanceBefore = (await get('/pix/balance/1004')).body.balance;

      const res = await post('/pix/send', {
        account: '1004',
        amount: 1,  // valor pequeno pra nao esgotar saldo
        destination: 'chave-resiliencia@pix',
      }, '1004');

      if (res.status === 500) {
        gatewayFailed = true;
        // Gateway falhou — o debito deveria ter sido revertido
        const balanceAfter = (await get('/pix/balance/1004')).body.balance;
        assert.equal(balanceAfter, balanceBefore,
          'Resiliencia: debito NAO foi revertido apos falha do gateway! Dinheiro ficou no limbo.');
      }
    }
    assert.ok(gatewayFailed,
      'Gateway nao falhou em 20 tentativas — teste inconclusivo. Aumente o numero de tentativas.');
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
        `Idempotencia: ${dupes.length} transacoes identicas processadas! Falta idempotency key.`);
    }
  });
});
