# Webhook - Recebimento de Mensagens

## Verificação do Webhook (GET)

Quando você configura/substitui o webhook, o Meta envia um GET para verificar.

### Parâmetros da requisição:

| Parâmetro | Descrição |
|-----------|-----------|
| `hub.mode` | "subscribe" na verificação |
| `hub.verify_token` | Token que você configurou |
| `hub.challenge` | String aleatória para retornar |

### Resposta:

- **Sucesso (200)**: Retornar `hub.challenge` como texto plano
- **Erro (403)**: Token não confere

### Código:

```javascript
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado com sucesso');
    res.status(200).send(challenge);
  } else {
    console.log('Verificação falhou - token não confere');
    res.status(403).send('Forbidden');
  }
});
```

---

## Recebimento de Mensagens (POST)

O Meta envia POST a cada nova mensagem recebida no WhatsApp Business.

### Estrutura do Payload:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "5511999999999",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "Nome do Contato" },
          "wa_id": "5511999999999"
        }],
        "messages": [{
          "from": "5511999999999",
          "id": "wamid.xxx",
          "timestamp": "1677777777",
          "type": "text",
          "text": { "body": "Texto da mensagem" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Tipos de Mensagem:

| Tipo | Estrutura |
|------|-----------|
| `text` | `text.body` |
| `image` | `image.id`, `image.caption` |
| `audio` | `audio.id` |
| `video` | `video.id`, `video.caption` |
| `document` | `document.id`, `document.filename` |
| `location` | `location.latitude`, `location.longitude` |
| `contacts` | `contacts[*].phones`, `contacts[*].name` |
| `sticker` | `sticker.id` |

### Códigos de Status (status updates):

```json
{
  "statuses": [{
    "id": "wamid.xxx",
    "status": "delivered|read|failed",
    "timestamp": "1677777777",
    "recipient_id": "5511999999999",
    "conversation": { "id": "...", "origin": { "type": "user_initiated|bot_initiated" } },
    "pricing": { "billable": true, "category": "business_initiated|user_initiated" }
  }]
}
```

---

## Implementação do Handler:

```javascript
app.post('/webhook', (req, res) => {
  const body = req.body;

  // Ignorar verificações de entrega do WhatsApp
  if (body.object !== 'whatsapp_business_account') {
    return res.status(404).send('Not found');
  }

  body.entry.forEach(entry => {
    entry.changes.forEach(change => {
      const value = change.value;

      if (value.messages) {
        value.messages.forEach(message => {
          console.log('Mensagem recebida:', message);
          // Processar mensagem
        });
      }

      if (value.statuses) {
        value.statuses.forEach(status => {
          console.log('Status update:', status);
          // Processar status
        });
      }
    });
  });

  res.status(200).send('EVENT_RECEIVED');
});
```

---

## Formas de Processar Mensagens:

### 1. Resposta Imediata (poucos segundos após receber)
Chamar API de envio dentro do handler POST

### 2. Queue/Background Processing
Salvar em fila (Redis/Bull) e processar assincronamente

### 3. Webhook com Confirmação
Salvar mensagem, confirmar receipt, processar depois

---

## Verificação de Assinatura (Opcional)

Para validar que requests vêm do Meta:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, appSecret) {
  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');
  
  return `sha256=${expectedSig}` === signature;
}
```

Headers a verificar:
- `X-Hub-Signature-256`: Assinatura do request