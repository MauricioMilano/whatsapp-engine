# Configuração do Ambiente

## Ferramentas Necessárias

### 1. ngrok (Desenvolvimento Local)

O WhatsApp precisa enviar webhooks para uma URL pública. Para desenvolvimento local, use ngrok.

```bash
# Instalar
npm install -g ngrok

# Iniciar tunnel para porta 3000
ngrok http 3000
```

Resultado:
```
Session Status                online
Account                       email@example.com
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000
```

> **Importante**: A URL do ngrok muda a cada reinicialização. Atualize no Meta Developer Console.

---

### 2. Variáveis de Ambiente

Criar arquivo `.env` na raiz do projeto:

```env
# Server
PORT=3000

# WhatsApp Credentials
VERIFY_TOKEN=meu_token_secreto_123
ACCESS_TOKEN=EAAALongString...
PHONE_NUMBER_ID=123456789012345

# Opcional - App Secret para validar assinaturas
APP_SECRET=abc123...
```

> **WARNING**: Nunca commite `.env` no git!

Criar `.gitignore`:
```
node_modules/
.env
*.log
```

---

### 3. Meta Developer Console - Configurar Webhook

1. Acessar [developers.facebook.com](https://developers.facebook.com)
2. Selecionar seu App
3. Menu: WhatsApp > Configuration
4. Webhook URL: `https://abc123.ngrok-free.app/webhook`
5. Verify Token: mesmo valor de `VERIFY_TOKEN`
6. Clicar "Verify and Save"

---

## Setup do Projeto Node.js

### package.json

```json
{
  "name": "whatsapp-webhook-api",
  "version": "1.0.0",
  "description": "WhatsApp Business API webhook",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "dotenv": "^16.3.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

### Instalação

```bash
npm install
```

### Execução

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

---

## Configuração de Produção

### Requisitos:

1. **URL pública** (não ngrok):
   - AWS Lambda + API Gateway
   - Vercel/Netlify Functions
   - Azure Functions
   - Qualquer VPS com domínio

2. **HTTPS** obrigatório (o Meta não aceita HTTP plain)

3. **Health check endpoint**:
   ```
   GET /health → { "status": "ok" }
   ```

### Checklist:

- [ ] URL pública configurada no Meta Console
- [ ] HTTPS funcionando
- [ ] ACCESS_TOKEN válido
- [ ] PHONE_NUMBER_ID correto
- [ ] Webhook verificado (GET /webhook retorna challenge)
- [ ] Rate limits configurados
- [ ] Logs de erro implementados