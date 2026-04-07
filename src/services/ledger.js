/**
 * Ledger Service (mock)
 * Sistema de conta corrente — consulta saldo e faz debito.
 */
export class LedgerService {
  constructor(db) {
    this.db = db;
  }

  getBalance(accountId) {
    const row = this.db.prepare('SELECT balance FROM accounts WHERE id = ?').get(accountId);
    return row ? row.balance : null;
  }

  async debit(accountId, amount) {
    // Simula latencia (~25ms normal, ~1200ms pico)
    const delay = Math.random() > 0.7 ? 1200 : 25;
    await new Promise(r => setTimeout(r, delay));

    const account = this.db.prepare('SELECT balance FROM accounts WHERE id = ?').get(accountId);
    if (!account) throw new Error('ACCOUNT_NOT_FOUND');
    if (account.balance < amount) throw new Error('INSUFFICIENT_FUNDS');

    this.db.prepare('UPDATE accounts SET balance = balance - ?, pix_used_today = pix_used_today + ? WHERE id = ?')
      .run(amount, amount, accountId);

    return { success: true, new_balance: account.balance - amount };
  }

  credit(accountId, amount) {
    this.db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?')
      .run(amount, accountId);
  }
}
