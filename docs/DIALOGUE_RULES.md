# Regras de Autoria do `dialogue.json`

> Este documento define as regras **obrigatórias** e **convencionais** de autoria do arquivo `dialogue.json` consumido pelo `NlpDialogueEngine`.  
> **Obrigatórias:** violá-las impede o bot de iniciar (erro de validação) ou causa bugs visíveis.  
> **Convencionais:**强烈推荐 — quebrá-las não impede o bot, mas introduz comportamento inesperado.

Para uma referência de schema (campos, tipos, defaults), veja [docs/DIALOGUE.md](./DIALOGUE.md). Para auditoria automatizada, use a skill [`validate-dialogue-rules`](../.github/skills/validate-dialogue-rules/SKILL.md).

## Índice

1. [Toda intent precisa de uma action de mesmo nome](#regra-1)
2. [Toda action precisa de uma `response`](#regra-2)
3. [Limites do WhatsApp: botões, header, footer](#regra-3)
4. [Entidades: enum canônico, sinônimos invertidos, regex ancorada](#regra-4)
5. [Placeholders `{{vars.x}}` e `{{slots.x}}`](#regra-5)
6. [Button handlers podem injetar slots sem NLP](#regra-6)
7. [Metadata: `name`, `version`, `language`](#regra-7)

---

## Regra 1: Toda intent precisa de uma action de mesmo nome

**Escopo:** `intents[].name` ↔ `actions{}`
**Validação:** erro de inicialização (rigoroso — vira `DialogueValidationError`)
**Status:** obrigatória

**Definição:** para cada `intents[].name`, deve existir `actions[<mesmo nome>]` com pelo menos o campo `response`.

**Por quê:** `NlpDialogueEngine.processInput` usa `result.intent` (a string retornada pelo node-nlp) como chave direta em `this.dialogue.actions[intent]`. Se a chave faltar, o motor **não loga erro** — ele devolve o `fallback`. Isso torna o erro invisível em produção: o usuário digita algo que casa com a intent, e o bot responde com o fallback. Por isso a validação é feita em boot, não em runtime.

**Exceção:** actions que são chamadas **apenas** por `button_handlers` (nunca por intent classificado via NLP) não precisam de intent correspondente. Mas se a mesma action também for roteada por intent, ela precisa da intent com mesmo nome.

✅ Correto:
```json
{
  "intents": [
    { "name": "saudacao", "utterances": ["oi", "olá", "bom dia"] }
  ],
  "actions": {
    "saudacao": {
      "response": "Olá! Como posso ajudar?",
      "buttons": []
    }
  }
}
```

❌ Incorreto (intent `saudacao` vira erro de boot):
```json
{
  "intents": [
    { "name": "saudacao", "utterances": ["oi"] }
  ],
  "actions": {
    "mostrar_menu": {
      "response": "Cardápio..."
    }
  }
}
```

---

## Regra 2: Toda action precisa de uma `response`

**Escopo:** `actions[].response` e `fallback.response`
**Validação:** erro de inicialização
**Status:** obrigatória

**Definição:** toda action (em `actions{}`) e o bloco `fallback` precisam ter o campo `response` como string. Strings vazias `""` são aceitas (a engine renderiza como mensagem em branco), mas o campo deve existir.

**Por quê:** sem `response`, a engine não tem o que mandar para o WhatsApp. A engine logaria `undefined` no payload, e a Cloud API rejeita a mensagem.

✅ Correto:
```json
{
  "actions": {
    "saudacao": { "response": "Olá!" }
  },
  "fallback": { "response": "Não entendi. Digite 'menu'." }
}
```

❌ Incorreto:
```json
{
  "actions": {
    "saudacao": { "buttons": [] }   // ❌ falta response
  },
  "fallback": {}                    // ❌ falta response
}
```

---

## Regra 3: Limites do WhatsApp — botões, header, footer

**Escopo:** `actions[].buttons`, `actions[].header`, `actions[].footer`, `fallback.*`
**Validação:** warning em runtime (truncamento silencioso)
**Status:** obrigatória quanto aos limites; convenção quanto ao estilo

**Definição:** respeitar os limites da WhatsApp Cloud API para Interactive Button Messages:

| Campo | Limite | Onde |
|---|---|---|
| Botões por mensagem | 13 | `actions[].buttons` |
| Título do botão | 25 caracteres | `buttons[].title` |
| Header | 60 caracteres (após render) | `actions[].header`, `fallback.header` |
| Footer | 60 caracteres (após render) | `actions[].footer`, `fallback.footer` |

**Por quê:** valores acima dos limites são **truncados pela engine** com `console.warn`, mas a truncamento pode cortar informação útil (ex.: "Pedido #42..." virando "Pedido #4"). Pior: o WhatsApp pode rejeitar o payload se os limites forem violados após outras camadas.

✅ Correto:
```json
{
  "actions": {
    "saudacao": {
      "response": "Olá!",
      "header": "☕ Café Bot",
      "footer": "Atendimento 24h",
      "buttons": [
        { "id": "btn_menu", "title": "📋 Ver Menu" },
        { "id": "btn_pedido", "title": "🛒 Fazer Pedido" }
      ]
    }
  }
}
```

❌ Incorreto (13 botões, um título de 30 chars):
```json
{
  "buttons": [
    { "id": "b1", "title": "Opção 1" },
    { "id": "b2", "title": "Opção 2" },
    { "id": "b3", "title": "Opção 3" },
    { "id": "b4", "title": "Opção 4" },
    { "id": "b5", "title": "Opção 5" },
    { "id": "b6", "title": "Opção 6" },
    { "id": "b7", "title": "Opção 7" },
    { "id": "b8", "title": "Opção 8" },
    { "id": "b9", "title": "Opção 9" },
    { "id": "b10", "title": "Opção 10" },
    { "id": "b11", "title": "Opção 11" },
    { "id": "b12", "title": "Opção 12" },
    { "id": "b13", "title": "Opção 13" },
    { "id": "b14", "title": "Esta opção tem um título longo demais" }   // ❌ 14º botão + título > 25
  ]
}
```

---

## Regra 4: Entidades — enum canônico, sinônimos invertidos, regex ancorada

**Escopo:** `entities{}`
**Validação:** enum validado no boot; regex validado no boot; **ancoragem de regex é convenção** (warning)
**Status:** obrigatória para estrutura; convencional para ancoragem

### Enum (`type: "enum"`)

- `values` é a lista canônica — é o que vai para `{{slots.bebida}}` quando o extractor casa.
- `synonyms` mapeia **canônico → variantes**. A chave é o valor canônico, os valores do array são as variações aceitas.

### Regex (`type: "regex"`)

- O extractor roda `utterance.match(re)` sem auto-ancoragem.
- **Sempre ancore** com `^...$` ou use `\b...\b`. Sem isso, o padrão `"\d{2}/\d{2}/\d{4}"` casa `15/06/2026` **e** `12315/06/2026789`, gerando falsos positivos.

### Match boundaries

O `EntityExtractor` usa `wordContains` (boundary unicode-aware), então:
- `"café"` casa em "Quero um café" ✅
- `"café"` **não** casa em "caféicultura" ❌ (o caractere seguinte é letra)
- Acentos são tratados nativamente (diferente de `\b` ASCII-only do JS).

✅ Correto:
```json
{
  "entities": {
    "bebida": {
      "type": "enum",
      "values": ["café", "chá", "suco"],
      "synonyms": {
        "café": ["cafézinho", "coffe", "cafezinho"],
        "chá":  ["cha", "te"]
      }
    },
    "data": {
      "type": "regex",
      "pattern": "^\\d{2}/\\d{2}/\\d{4}$"
    },
    "telefone": {
      "type": "regex",
      "pattern": "^\\+?[0-9]{10,15}$"
    }
  }
}
```

❌ Incorreto:
```json
{
  "entities": {
    "bebida": {
      "type": "enum",
      "values": ["café"],
      "synonyms": {
        "cafézinho": ["café"]   // ❌ invertido: chave deve ser canônico
      }
    },
    "data": {
      "type": "regex",
      "pattern": "\\d{2}/\\d{2}/\\d{4}"   // ⚠️ sem âncora
    }
  }
}
```

---

## Regra 5: Placeholders `{{vars.x}}` e `{{slots.x}}`

**Escopo:** strings em `response`, `header`, `footer` (de action ou fallback); valores em `set_variables`
**Validação:** sem validação automática; resolver como string vazia se a chave não existir
**Status:** convencional (resolver silencioso é documentado)

**Definição:** dois namespaces de placeholders, com semântica clara:

| Placeholder | Origem | Quando usar |
|---|---|---|
| `{{vars.nome}}` | variável de contexto do usuário (`context.variables`) | coisas persistidas entre turnos: pedido atual, nome, etapa |
| `{{slots.nome}}` | valor extraído da utterance atual (entity) ou injetado via `button_handlers[].slots` | coisas que vêm da mensagem: o que o usuário acabou de digitar/clicar |

**Comportamento:** se a chave não existir no namespace, o placeholder é substituído por `""` (string vazia). A engine **não** lança erro. Isso é por design — a engine é tolerante a placeholders faltantes.

**`set_variables` aceita templates:** os valores de `action.set_variables` são renderizados com `{{vars.x}}` e `{{slots.x}}` antes de serem persistidos. Isso permite coisas como:

```json
{
  "set_variables": {
    "resumo": "{{vars.quantidade}}x {{vars.pedido}} ({{vars.tamanho}})"
  }
}
```

✅ Correto:
```json
{
  "actions": {
    "registrar_bebida": {
      "response": "Você escolheu {{slots.bebida}}. Qual tamanho?",
      "set_variables": { "pedido": "{{slots.bebida}}" }
    },
    "confirmar_pedido": {
      "response": "{{vars.quantidade}}x {{vars.pedido}} ({{vars.tamanho}}) confirmado!"
    }
  }
}
```

❌ Comum (esquecer de nomear a var):
```json
{
  "actions": {
    "saudacao": {
      "response": "Olá {{vars.nome}}!"   // ⚠️ se 'nome' nunca foi setado, renderiza "Olá !"
    }
  }
}
```

---

## Regra 6: Button handlers podem injetar slots sem NLP

**Escopo:** `button_handlers[].slots`
**Validação:** sem validação específica
**Status:** convencional (mas poderoso)

**Definição:** quando um usuário clica num botão, o `button_handlers[buttonId].slots` injeta valores no objeto `slots` **sem rodar o entity extractor**. Isso é útil para forçar um valor canônico de enum (já que a utterance do botão não é texto livre).

**Quando usar:**

- ✅ Botões que mapeiam 1:1 para um valor canônico de enum (ex.: `bebida_cafe` → `slots: { bebida: "café" }`).
- ✅ Botões que precisam de uma quantidade específica (`qtd_1` → `slots: { quantidade: 1 }`).
- ❌ Não abuse para bypass do classificador NLP em fluxos que deveriam entender texto livre.

✅ Correto:
```json
{
  "button_handlers": {
    "bebida_cafe":   { "action": "registrar_bebida",   "slots": { "bebida": "café" } },
    "bebida_cha":    { "action": "registrar_bebida",   "slots": { "bebida": "chá" } },
    "qtd_1":         { "action": "registrar_quantidade", "slots": { "quantidade": 1 } },
    "qtd_2":         { "action": "registrar_quantidade", "slots": { "quantidade": 2 } },
    "btn_menu":      { "action": "mostrar_menu_principal" }   // sem slots, OK
  }
}
```

❌ Erro comum — omitir `slots` quando o botão é a única forma de setar:
```json
{
  "button_handlers": {
    "tam_p": { "action": "registrar_tamanho" }   // ⚠️ sem slots, 'tamanho' fica undefined
  }
}
```

---

## Regra 7: Metadata — `name`, `version`, `language`

**Escopo:** `meta{}`
**Validação:** erro de inicialização
**Status:** obrigatória

**Definição:** `meta` precisa ter pelo menos:

| Campo | Tipo | Restrição |
|---|---|---|
| `name` | string | identificador do bot (aparece nos logs) |
| `version` | string | versão semântica ou livre (informativo) |
| `language` | string | BCP-47 (ex.: `pt`, `pt-BR`, `en`) — passado direto para `NlpManager` |

**Por quê:** `language` precisa ser BCP-47 válido porque é argumento de `NlpManager({ languages: [language] })`. Mismatch com as utterances (ex.: `language: "en"` mas utterances em português) degrada o score do classificador e dispara mais fallbacks.

✅ Correto:
```json
{
  "meta": {
    "name": "cafe-bot",
    "version": "1.0.1",
    "language": "pt-BR",
    "description": "Bot de pedidos de cafeteria"
  }
}
```

❌ Incorreto:
```json
{
  "meta": {
    "name": "cafe-bot"
    // ❌ faltam version e language
  }
}
```

---

## Tabela de cobertura

| Regra | Validator (boot) | Runtime warning | Onde auditar |
|---|---|---|---|
| 1 — Intent ↔ action | ✅ erro | — | skill `validate-dialogue-rules` |
| 2 — Response obrigatória | ✅ erro | — | skill + validator |
| 3 — Limites WhatsApp | — | ✅ truncamento | skill |
| 4 — Entidades (estrutura) | ✅ erro | — | validator |
| 4 — Regex ancorada | — | ✅ warn | skill |
| 5 — Placeholders | — | — (resolve silencioso) | skill (análise estática) |
| 6 — Button handlers | parcial (action existe) | — | skill |
| 7 — Metadata | ✅ erro | — | validator |
