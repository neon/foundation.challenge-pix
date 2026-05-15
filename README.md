# Sistema de Pagamentos Pix — Avaliação Técnica Neon

## Contexto

Você é engenheiro(a) no time de pagamentos de uma fintech. O sistema de Pix está em produção e o time de CX reportou 5 problemas no último mês.

## O que você vai encontrar aqui

```
pix/   →  o serviço Node.js/Express que está em produção (o mesmo código real)
```

## Setup

```bash
cd pix
npm install
npm start      # http://localhost:3000
npm test       # alguns testes estão falhando
```

## Regras

**Use qualquer ferramenta** — IDE, AI (Claude, ChatGPT, Copilot), browser, terminal. O que você usaria no dia a dia.

**Pense em voz alta** — narre seu raciocínio. Compartilhe dúvidas. Pergunte o que quiser.

**Compartilhe sua tela** — queremos ver como você trabalha, não só o resultado final.

## Por onde começar

1. Rode `npm test` dentro de `pix/` e veja o que está falhando
2. Explore o código com olhar crítico
3. Pense em voz alta enquanto investiga

## Endpoints disponíveis

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/pix/send` | Envia um Pix |
| GET | `/pix/balance/:accountId` | Consulta saldo |
| GET | `/pix/transactions/:accountId` | Lista transações |
| GET | `/dev/token/:accountId` | Gera JWT de teste |

## Contas de teste

| ID | Nome | Saldo |
|----|------|-------|
| 1001 | Ana Silva | R$ 15.000 |
| 1002 | Bruno Santos | R$ 3.200 |
| 1003 | Carla Lima | R$ 480 |
| 1004 | Diego Costa | R$ 42.000 |
| 1005 | Elena Rocha | R$ 50 |

## Exemplo rápido

```bash
# Gerar token da Ana
TOKEN=$(curl -s localhost:3000/dev/token/1001 | jq -r .token)

# Enviar Pix
curl -X POST localhost:3000/pix/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"account": "1001", "amount": 100, "destination": "chave@pix"}'
```
