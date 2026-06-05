# Dialogue JSON Format

This file defines the entire conversation flow of the WhatsApp bot. It is loaded by the `NlpDialogueEngine` at startup and used to:

- Train the intent classifier (node-nlp)
- Drive the Finite State Machine (FSM)
- Render responses with template variables
- Render Quick Reply buttons
- Persist user context per state

## Top-Level Structure

```json
{
  "meta":           { ... },
  "context":        { ... },
  "entities":       { ... },
  "intents":        [ ... ],
  "states":         { ... },
  "actions":        { ... },
  "fallback":       { ... },
  "button_handlers":{ ... }
}
```

## Fields

### `meta` (required)

| Field | Description |
|-------|-------------|
| `name` | Bot identifier (used in logs) |
| `version` | Dialogue version |
| `language` | BCP-47 locale for node-nlp (e.g. `pt`, `pt-BR`, `en`) |
| `description` | Free text |

### `context.variables` (required)

Initial values for per-user variables. Each key is a variable name; the value is the default (may be `null`).

```json
"context": {
  "variables": {
    "nome": null,
    "pedido": null,
    "quantidade": 1
  }
}
```

### `entities` (optional)

Named entities used by intent slots. Two types are supported:

```json
"entities": {
  "bebida": {
    "type": "enum",
    "values": ["café", "chá", "suco"],
    "synonyms": {
      "café": ["cafézinho", "cafezinho"],
      "chá":  ["cha", "te"]
    }
  },
  "email": {
    "type": "regex",
    "pattern": "^[\\w.-]+@[\\w.-]+\\.\\w+$"
  }
}
```

### `intents` (required)

List of intents the classifier can recognize. Each entry is a training unit:

```json
{
  "name": "escolher_bebida",
  "utterances": ["café", "chá", "suco"],
  "slots": {
    "bebida": { "type": "entity", "entity": "bebida" }
  }
}
```

- `utterances`: training phrases (more = better recall)
- `slots`: entity values to extract when the intent matches

### `states` (required)

Flat FSM states. The engine enters the state named in `meta.default_state` (or `inicio`) on a brand-new session.

```json
"states": {
  "inicio":     { "on_enter": "saudacao",        "intent": null },
  "main_menu":  { "on_enter": "mostrar_menu",    "intent": null },
  "escolhendo": { "on_enter": "perguntar_bebida","intent": "escolher_bebida" }
}
```

### `actions` (required)

Each action can be triggered by an intent, by a state `on_enter`, or by a button handler.

```json
"actions": {
  "saudacao": {
    "response":     "Olá! Como posso ajudar?",
    "buttons":      [{ "id": "btn_menu", "title": "📋 Menu" }],
    "set_variables":{ "etapa": "menu" },
    "next_state":   "main_menu"
  }
}
```

- `response`: text with optional `{{vars.x}}` and `{{slots.x}}` placeholders
- `buttons`: array of `{ id, title }` (max 13, title max 25 chars)
- `set_variables`: variables to update after the action runs
- `next_state`: state to transition to (omit to keep current state)

### `fallback` (required)

Returned when NLP classification fails (low score or `None` intent):

```json
"fallback": {
  "response": "Não entendi muito bem...",
  "buttons":  [{ "id": "btn_menu", "title": "📋 Menu" }]
}
```

### `button_handlers` (required)

Map of button id → action to execute when the user taps a button:

```json
"button_handlers": {
  "btn_pedido": { "action": "perguntar_bebida" },
  "beb_cafe":   { "action": "registrar_bebida", "slots": { "bebida": "café" } }
}
```

The optional `slots` field injects slot values without running entity extraction (useful for buttons).

## Template Variables

| Placeholder | Source |
|-------------|--------|
| `{{vars.x}}` | Context variable `x` from the user context |
| `{{slots.x}}` | Slot value `x` extracted from the current utterance or button handler |

Missing values are replaced by an empty string.

## Validation

The dialogue is validated at startup. Common errors:

- Missing required top-level field
- State `on_enter` references a non-existent action
- Button handler references a non-existent action
- Regex entity has an invalid pattern
- Action has neither `response` nor `buttons`

If validation fails the engine refuses to start.
