# WhatsApp Business API - Express Webhook

API em Express.js para receber e enviar mensagens via WhatsApp Business API (Cloud API).

## Visão Geral

Este projeto implementa um webhook Node.js/Express para:
- **Receber mensagens** via webhook do Meta
- **Enviar mensagens** via WhatsApp Cloud API

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        WhatsApp                              │
└─────────────────────────┬───────────────────────────────────┘
                          │ POST (webhook)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Webhook                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ GET /webhook│  │ POST/webhook│  │ POST /messages      │  │
│  │ (verify)    │  │ (receive)   │  │ (send)              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ POST (Graph API)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Meta Graph API                           │
│              graph.facebook.com/v18.0/                      │
└─────────────────────────────────────────────────────────────┘
```

## Requisitos

- Node.js 18+
- ngrok (para desenvolvimento local)
- Conta WhatsApp Business

## Configuração

1. Criar App no [Meta Business Developer](https://developers.facebook.com/)
2. Adicionar produto WhatsApp ao App
3. Configurar webhook com URL pública
4. Definir `VERIFY_TOKEN` e `ACCESS_TOKEN`

## Variáveis de Ambiente

```env
PORT=3000
VERIFY_TOKEN=seu_token_unico
ACCESS_TOKEN=seu_access_token_meta
PHONE_NUMBER_ID=seu_phone_number_id
RECIPIENT_PHONE=55xxx
```

## Endpoints

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/webhook` | Verificação do webhook (challenge) |
| POST | `/webhook` | Receber mensagens |
| POST | `/messages` | Enviar mensagens |

## Estrutura do Projeto

```
whatsapp-api/
├── docs/                    # Documentação
│   ├── CONFIG.md           # Configuração de ambiente
│   ├── WEBHOOK.md          # Recebimento de mensagens
│   ├── SEND_MESSAGES.md    # Envio de mensagens
│   └── DIALOGUE.md         # Formato do dialogue.json (NLP/FSM)
├── examples/
│   └── message-input.json   # Exemplo de payload para envio
├── src/
│   ├── index.js             # Entry point - Express server
│   ├── webhook.js           # Handlers GET/POST webhook
│   ├── whatsappService.js   # Funções para enviar mensagens
│   ├── templateEngine.js    # Renderização de templates e botões
│   ├── nlpDialogueEngine.js # Engine NLP/FSM
│   ├── entityExtractor.js   # Extração de entidades da mensagem
│   ├── contextStore.js      # Persistência de contexto do usuário
│   └── utils/
│       ├── signature.js     # Validação de assinatura Meta
│       └── dialogueValidator.js
├── dialogue.json            # Configuração do fluxo de conversa
├── .env.example             # Template de variáveis de ambiente
├── .gitignore
├── package.json
└── README.md
```

## Endpoints

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/webhook` | Verificação do webhook (challenge) |
| POST | `/webhook` | Receber mensagens |
| POST | `/messages` | Enviar mensagens |
| GET | `/health` | Health check |

## Como Usar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# 3. Iniciar ngrok (desenvolvimento)
ngrok http 3000

# 4. Configurar webhook no Meta Developer Console
# URL: https://your-ngrok-url.ngrok-free.app/webhook
# Verify Token: valor definido em .env

# 5. Rodar em desenvolvimento
npm run dev

# 6. Ou em produção
npm start
```

## Status

- [x] Documentação base
- [x] Estrutura do projeto
- [x] Implementação webhook (GET/POST)
- [x] Implementação envio de mensagens
- [ ] Testes
- [ ] Exemplo de resposta automatica (bot)