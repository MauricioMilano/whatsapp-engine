# Envio de Mensagens - WhatsApp Cloud API

## Endpoint

```
POST https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages
```

### Headers:

```
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

### Body Base:

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "text|image|template|document|audio|video|location|contacts|sticker"
}
```

---

## Tipos de Mensagem

### 1. Texto

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Olá! Esta é uma mensagem de teste."
  }
}
```

> `preview_url`: `true` se quiser que o WhatsApp gere preview de links

---

### 2. Modelo (Template) - Mais comum para iniciar conversa

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": {
      "code": "pt_BR"
    },
    "components": [
      {
        "type": "header",
        "parameters": [{
          "type": "text",
          "text": "Título do Header"
        }]
      },
      {
        "type": "body",
        "parameters": [{
          "type": "text",
          "text": "Nome do cliente"
        }]
      },
      {
        "type": "footer",
        "parameters": [{
          "type": "text",
          "text": "Rodapé opcional"
        }]
      },
      {
        "type": "buttons",
        "parameters": [{
          "type": "quick_reply",
          "payload": "button_payload_1"
        }]
      }
    ]
  }
}
```

> **Nota**: Templates precisam ser aprovados pelo Meta antes de usar.

---

### 3. Imagem

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "image",
  "image": {
    "id": "IMG_ID",           // ID do upload anterior
    "caption": "Descrição"    // Opcional
  }
}
```

#### Upload de Imagem:

```
POST https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/media

{
  "messaging_product": "whatsapp",
  "file_length": "12345",
  "mime_type": "image/jpeg",
  "type": "image"
}
```

Retorna: `{ "id": "MEDIA_ID" }`

---

### 4. Documento

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "document",
  "document": {
    "id": "DOC_ID",
    "filename": "relatorio.pdf"
  }
}
```

---

### 5. Áudio

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "audio",
  "audio": {
    "id": "AUDIO_ID"
  }
}
```

---

### 6. Vídeo

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "video",
  "video": {
    "id": "VIDEO_ID",
    "caption": "Vídeo explicativo"  // Opcional
  }
}
```

---

### 7. Localização

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "location",
  "location": {
    "latitude": "-23.5505",
    "longitude": "-46.6333",
    "name": "São Paulo",
    "address": "Av. Paulista, 1000"
  }
}
```

---

### 8. Contatos

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "contacts",
  "contacts": [{
    "addresses": [{
      "city": "São Paulo",
      "country": "Brazil",
      "country_code": "BR",
      "state": "SP",
      "street": "Av. Paulista",
      "type": "WORK"
    }],
    "birthday": "1990-01-15",
    "emails": [{
      "email": "email@empresa.com",
      "type": "WORK"
    }],
    "name": {
      "first_name": "João",
      "last_name": "Silva",
      "formatted_name": "João Silva"
    },
    "phones": [{
      "phone": "5511999999999",
      "type": "WORK"
    }],
    "urls": [{
      "url": "https://empresa.com",
      "type": "WORK"
    }]
  }]
}
```

---

### 9. Sticker

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "sticker",
  "sticker": {
    "id": "STICKER_ID"
  }
}
```

---

### 10. Interativa (Botões de Resposta Rápida)

Mensagens interativas com até 3 botões de resposta rápida (`reply`). Quando originadas do `dialogue.json` (via `NlpDialogueEngine`), o engine já cuida do cabeçalho, corpo, rodapé e botões.

#### Payload base:

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "interactive",
  "recipient_type": "individual",
  "interactive": {
    "type": "button",
    "body": {
      "text": "Como posso ajudar?"
    },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "btn_menu",    "title": "📋 Menu" } },
        { "type": "reply", "reply": { "id": "btn_pedido",  "title": "🛒 Pedido" } },
        { "type": "reply", "reply": { "id": "btn_ajuda",   "title": "❓ Ajuda" } }
      ]
    }
  }
}
```

#### Com cabeçalho (header) e rodapé (footer) opcionais:

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "interactive",
  "recipient_type": "individual",
  "interactive": {
    "type": "button",
    "header": {
      "type": "text",
      "text": "☕ Café Bot"
    },
    "body": {
      "text": "Como posso ajudar?"
    },
    "footer": {
      "text": "Atendimento 24h"
    },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "btn_menu", "title": "📋 Menu" } }
      ]
    }
  }
}
```

> **Limites do WhatsApp Cloud API:**
> - Até **3 botões** por mensagem (o engine aceita mais em `dialogue.json`, mas a API rejeita).
> - Título de cada botão: **máx. 25 caracteres** (o engine trunca automaticamente e registra um aviso).
> - Texto do `header.text` e `footer.text`: **máx. 60 caracteres** (o engine trunca automaticamente e registra um aviso).
> - Quando o campo `header` ou `footer` for omitido, ele é simplesmente removido do payload — mensagens existentes que não declaravam esses campos continuam idênticas.

#### Como o engine preenche esses campos:

No fluxo do `dialogue.json`, basta declarar `header` e/ou `footer` na action ou no `fallback`:

```json
"actions": {
  "saudacao": {
    "response": "Olá! Como posso ajudar?",
    "header":   "☕ Café Bot",
    "footer":   "Atendimento 24h",
    "buttons":  [{ "id": "btn_menu", "title": "📋 Menu" }]
  }
}
```

O `NlpDialogueEngine` substitui placeholders (`{{vars.x}}`, `{{slots.x}}`), trunca para 60 caracteres e devolve o resultado em `result.header` / `result.footer`. O `webhook.js` repassa esses campos para `whatsappService.sendInteractiveButtons`, que monta o payload acima. Para mais detalhes, veja [docs/DIALOGUE.md](./DIALOGUE.md).

---

## Resposta da API

### Sucesso:

```json
{
  "messaging_product": "whatsapp",
  "contacts": [{
    "input": "5511999999999",
    "wa_id": "5511999999999"
  }],
  "messages": [{
    "id": "wamid.HBgNNTUxMTk5OTk5OTk5"
  }]
}
```

### Erro:

```json
{
  "error": {
    "message": "Invalid phone number",
    "type": "OAuthException",
    "code": 100,
    "error_subcode": 131030,
    "fbtrace_id": "AjxfkD37j23"
  }
}
```

---

## Regras de Envio

### Janela de Mensagens:

| Categoria | Descrição | Janela |
|-----------|-----------|--------|
| **User Initiated** | Resposta a mensagem do usuário | 24h |
| **Business Initiated** | Início de conversa (template) | Não tem limite inicial* |

> *Após primeira mensagem via template, volta à janela de 24h

### Tipos de Início de Conversa:

1. **Template com CTA** → abre janela de 7 dias
2. **Template com reply button** → abre janela de 7 dias  
3. **Template simples** → apenas 24h

### Limite de Mensagens:

- Cloud API: até 1.000 mensagens/segundo
- Não há limite diário (porém verificar pricing)

---

## Códigos de Erro Comuns

| Code | Subcode | Significado |
|------|---------|-------------|
| 100 | 131030 | Número de telefone inválido |
| 200 | - | Permissão negada |
| 368 | - | Erro de rate limit |
| 131051 | - | Template não existe ou não aprobado |
| 132001 | - | Número não está no WhatsApp |