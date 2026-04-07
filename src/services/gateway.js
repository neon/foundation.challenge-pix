/**
 * Gateway Externo (mock)
 * Integracao com Banco Central para transferencia Pix.
 * Simula latencia alta no pico (~2800ms) e falhas intermitentes.
 */
export class GatewayService {
  async send(destination, amount, transactionId) {
    // Simula latencia (~120ms normal, ~2800ms pico)
    const delay = Math.random() > 0.6 ? 2800 : 120;
    await new Promise(r => setTimeout(r, delay));

    // 10% de chance de falha (timeout/erro)
    if (Math.random() < 0.10) {
      throw new Error('GATEWAY_TIMEOUT');
    }

    return {
      success: true,
      gateway_ref: `BC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }
}
