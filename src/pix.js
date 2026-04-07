import { Router } from 'express';

export function createPixRouter({ userAccount, antiFraud, ledger, gateway, db }) {
  const router = Router();

  router.post('/send', async (req, res) => {
    const { account, amount, destination } = req.body;

    if (!account || !amount || !destination) {
      return res.status(400).json({ error: 'MISSING_FIELDS' });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }

    try {
      const accountData = userAccount.getAccount(account);
      if (accountData.error) {
        return res.status(404).json({ error: accountData.error });
      }

      if (amount > accountData.remaining_limit) {
        return res.status(400).json({ error: 'DAILY_LIMIT_EXCEEDED' });
      }

      const fraudCheck = await antiFraud.check(account, amount, destination);
      if (!fraudCheck.approved) {
        return res.status(403).json({ error: 'FRAUD_REJECTED', reason: fraudCheck.reason });
      }

      const debitResult = await ledger.debit(account, amount);

      const txn = db.prepare(
        'INSERT INTO transactions (from_account, to_pix_key, amount, status) VALUES (?, ?, ?, ?)'
      ).run(account, destination, amount, 'debited');

      const gatewayResult = await gateway.send(destination, amount, txn.lastInsertRowid);

      db.prepare(
        'UPDATE transactions SET status = ?, completed_at = datetime(?), gateway_ref = ? WHERE id = ?'
      ).run('completed', 'now', gatewayResult.gateway_ref, txn.lastInsertRowid);

      return res.json({
        status: 'completed',
        transaction_id: txn.lastInsertRowid,
        amount,
        destination,
        gateway_ref: gatewayResult.gateway_ref,
      });

    } catch (err) {
      return res.status(500).json({ error: 'PIX_FAILED', detail: err.message });
    }
  });

  router.get('/transactions/:accountId', (req, res) => {
    const txns = db.prepare(
      'SELECT * FROM transactions WHERE from_account = ? ORDER BY created_at DESC'
    ).all(req.params.accountId);
    return res.json(txns);
  });

  router.get('/balance/:accountId', (req, res) => {
    const balance = ledger.getBalance(req.params.accountId);
    if (balance === null) return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' });
    return res.json({ account: req.params.accountId, balance });
  });

  return router;
}
