# Pix Service — Desafio Tecnico

Voce e engenheiro no time de pagamentos. Este e o servico de envio de Pix em producao.

O time de CX reportou problemas. Alguns testes estao falhando.

## Setup

```bash
npm install
npm start        # http://localhost:3000
npm test         # roda os testes
```

## Endpoints

| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/pix/send` | Envia um Pix |
| GET | `/pix/balance/:accountId` | Consulta saldo |
| GET | `/pix/transactions/:accountId` | Lista transacoes |
| GET | `/dev/token/:accountId` | Gera JWT de teste |

## Contas disponiveis

| ID | Nome | Saldo |
|---|---|---|
| 1001 | Ana Silva | R$ 15.000 |
| 1002 | Bruno Santos | R$ 3.200 |
| 1003 | Carla Lima | R$ 480 |
| 1004 | Diego Costa | R$ 42.000 |
| 1005 | Elena Rocha | R$ 50 |

## Exemplo de uso

```bash
# Gerar token da Ana
TOKEN=$(curl -s localhost:3000/dev/token/1001 | jq -r .token)

# Enviar Pix
curl -X POST localhost:3000/pix/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"account": "1001", "amount": 100, "destination": "chave@pix"}'
```

## Sua tarefa

Rode os testes. Alguns estao falhando. Investigue, corrija, e discuta com o entrevistador.

Use qualquer ferramenta: IDE, AI, browser, terminal.
