# Dialogue JSON Format

The **active dialogue file** (selected via the `DIALOGUE_PATH` env var, default `./dialogue.json`) defines the entire conversation flow of the WhatsApp bot. The project ships with two dialogue files — `dialogue.json` (`cafe-bot`, the regression ground-truth) and `barber.json` (`dometts-barber`) — but only one is loaded per process. The active file is loaded by the `NlpDialogueEngine` at startup and used to:

- Train the intent classifier (node-nlp)
- Map recognized intents to actions (1:1 by name, see `docs/DIALOGUE_RULES.md`)
- Render responses with template variables
- Render Quick Reply buttons
- Render the message envelope (header above the body, footer below the buttons)
- Persist per-user context variables

> **Note:** This bot does **not** implement a state machine. There is no `states` block, no `next_state` field on actions, and the engine does not track a current "state" between turns. Each turn is independent: the classifier picks an intent, the engine looks up the action with the same name, and returns the rendered response. The dialogue author is responsible for guiding the user through the flow via `set_variables` and template substitution. See `docs/DIALOGUE_RULES.md` for the full rule set.

## Top-Level Structure

```json
{
  "meta":           { ... },
  "context":        { ... },
  "entities":       { ... },
  "intents":        [ ... ],
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
  "name": "registrar_bebida",
  "utterances": ["café", "chá", "suco"],
  "slots": {
    "bebida": { "type": "entity", "entity": "bebida" }
  }
}
```

- `utterances`: training phrases (more = better recall)
- `slots`: entity values to extract when the intent matches
- `name`: **must match a key in `actions` exactly** (R1 stricto, see `docs/DIALOGUE_RULES.md`)

### `actions` (required)

Each action can be triggered by an intent (matched by name) or by a button handler.

```json
"actions": {
  "saudacao": {
    "response":     "Olá! Como posso ajudar?",
    "header":       "☕ Café Bot",
    "footer":       "Atendimento 24h",
    "buttons":      [{ "id": "btn_menu", "title": "📋 Menu" }],
    "set_variables":{ "etapa": "menu" }
  }
}
```

- `response`: text with optional `{{vars.x}}` and `{{slots.x}}` placeholders (at least one of `response` or `buttons` is required)
- `header` (optional): text rendered above the body in interactive button messages; max 60 characters; supports `{{vars.x}}` and `{{slots.x}}` placeholders. When omitted, empty, or non-string, no header is sent.
- `footer` (optional): text rendered below the buttons in interactive button messages; max 60 characters; supports the same placeholders as `header`. When omitted, empty, or non-string, no footer is sent.
- `buttons`: array of `{ id, title }` (max 13, title max 25 chars)
- `set_variables`: variables to update after the action runs

> **Truncation:** if a rendered header or footer exceeds 60 characters, the engine keeps the first 60 characters and logs a warning (`Header too long (N chars, max 60). Truncating.`). Authors should keep the source string short to avoid silent information loss.

### `fallback` (required)

Returned when NLP classification fails (low score or `None` intent):

```json
"fallback": {
  "response": "Não entendi muito bem...",
  "header":   "⚠️ Ops",
  "footer":   "Tente reformular",
  "buttons":  [{ "id": "btn_menu", "title": "📋 Menu" }]
}
```

`header` and `footer` follow the same rules as on actions (optional, 60-char limit, placeholder substitution, omitted when absent). When the fallback is rendered as plain text (no buttons), `header` and `footer` are ignored by the messaging layer.

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

`header` and `footer` accept the same `{{vars.x}}` / `{{slots.x}}` placeholders as `response`.

## Message Envelope (Header & Footer)

Interactive button messages on WhatsApp support an optional `header` (text rendered above the body) and `footer` (text rendered below the buttons). The dialogue engine threads both fields end-to-end:

1. Authors declare them on an action or on `fallback` in `dialogue.json`.
2. The engine substitutes `{{vars.x}}` / `{{slots.x}}` placeholders, clamps to 60 characters, and returns the rendered value (or `null`) on the result object.
3. The webhook forwards them to `whatsappService.sendInteractiveButtons`, which omits the field from the WhatsApp payload when `null`.

### Engine Result Shape

`processInput`, `processButton`, and the fallback handler all return:

```json
{
  "text":      "Rendered body",
  "header":    "Rendered header or null",
  "footer":    "Rendered footer or null",
  "buttons":   [{ "id": "btn1", "title": "..." }],
  "nextState": null
}
```

`header` and `footer` are **always present** on the result. They are `null` when the corresponding action or fallback omits the field, when the field is an empty string, or when it is not a string. Plain-text (no buttons) responses ignore both fields.

`nextState` is **always `null`** in the current version. The field is preserved on the result shape for backward compatibility with `webhook.js` (which reads it but does not branch on it). New code should ignore it.

### WhatsApp Payload

When the engine produces a non-null `header` / `footer`, the WhatsApp interactive payload is:

```json
{
  "type": "interactive",
  "interactive": {
    "type": "button",
    "header": { "type": "text", "text": "..." },
    "body":   { "text": "..." },
    "footer": { "text": "..." },
    "action": { "buttons": [ ... ] }
  }
}
```

When the field is `null`, the corresponding `interactive.header` / `interactive.footer` key is omitted entirely, keeping existing payloads byte-identical for actions that do not opt in.

## Validation

The dialogue is validated at startup. Common errors:

- Missing required top-level field
- An intent `name` has no matching `actions[<name>]` (R1 stricto, see `docs/DIALOGUE_RULES.md`)
- An action has no `response` (R1 stricto — pure button-only actions must still have a `response`, even if empty, to make their meaning explicit)
- Button handler references a non-existent action
- Regex entity has an invalid pattern, or is not anchored with `^...$` (R7 warning)
- Action has neither `response` nor `buttons`

If validation fails the engine refuses to start. The full rule set lives in [`docs/DIALOGUE_RULES.md`](./DIALOGUE_RULES.md).
