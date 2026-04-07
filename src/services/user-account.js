/**
 * User-Account Service (mock)
 * Retorna dados da conta e limites de operacao Pix.
 */
export class UserAccountService {
  constructor(db) {
    this.db = db;
  }

  getAccount(accountId) {
    const account = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    if (!account) return { error: 'ACCOUNT_NOT_FOUND' };
    if (account.status !== 'active') return { error: 'ACCOUNT_INACTIVE' };
    return {
      id: account.id,
      holder_name: account.holder_name,
      balance: account.balance,
      pix_daily_limit: account.pix_daily_limit,
      pix_used_today: account.pix_used_today,
      remaining_limit: account.pix_daily_limit - account.pix_used_today,
    };
  }
}
