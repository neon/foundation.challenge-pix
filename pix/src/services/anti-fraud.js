/**
 * Anti-Fraud Service (mock)
 * Consulta se a transacao e suspeita.
 * Regra simples: bloqueia se amount > 10000.
 */
export class AntiFraudService {
  async check(accountId, amount, destination) {
    // Simula latencia (~80ms normal, ~350ms pico)
    const delay = Math.random() > 0.7 ? 350 : 80;
    await new Promise(r => setTimeout(r, delay));

    if (amount > 10000) {
      return { approved: false, reason: 'HIGH_VALUE_TRANSACTION' };
    }
    return { approved: true };
  }
}
