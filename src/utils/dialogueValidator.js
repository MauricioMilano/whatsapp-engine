/**
 * Dialogue JSON Schema Validator
 * Validates dialogue.json structure before loading
 */

const REQUIRED_TOP_LEVEL = [
  'meta',
  'context',
  'intents',
  'states',
  'actions',
  'fallback',
  'button_handlers'
];

const REQUIRED_META = ['name', 'version', 'language'];

class DialogueValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'DialogueValidationError';
    this.errors = errors;
  }
}

/**
 * Validate dialogue JSON structure
 * @param {object} dialogue - The dialogue JSON object
 * @throws {DialogueValidationError} if validation fails
 */
function validateDialogueSchema(dialogue) {
  const errors = [];

  if (!dialogue || typeof dialogue !== 'object') {
    throw new DialogueValidationError('Dialogue must be an object', ['dialogue is not an object']);
  }

  // Check required top-level fields
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in dialogue)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    throw new DialogueValidationError('Dialogue validation failed', errors);
  }

  // Validate meta
  errors.push(...validateMeta(dialogue.meta));

  // Validate context
  errors.push(...validateContext(dialogue.context));

  // Validate entities (optional)
  if (dialogue.entities) {
    errors.push(...validateEntities(dialogue.entities));
  }

  // Validate intents
  errors.push(...validateIntents(dialogue.intents));

  // Validate states
  errors.push(...validateStates(dialogue.states, dialogue.actions));

  // Validate actions
  errors.push(...validateActions(dialogue.actions, dialogue.states));

  // Validate fallback
  errors.push(...validateFallback(dialogue.fallback));

  // Validate button_handlers
  errors.push(...validateButtonHandlers(dialogue.button_handlers, dialogue.actions));

  if (errors.length > 0) {
    throw new DialogueValidationError('Dialogue validation failed', errors);
  }

  return true;
}

function validateMeta(meta) {
  const errors = [];
  if (!meta || typeof meta !== 'object') {
    return ['meta must be an object'];
  }
  for (const field of REQUIRED_META) {
    if (!meta[field]) {
      errors.push(`meta.${field} is required`);
    }
  }
  return errors;
}

function validateContext(context) {
  const errors = [];
  if (!context || typeof context !== 'object') {
    return ['context must be an object'];
  }
  if (!context.variables || typeof context.variables !== 'object') {
    errors.push('context.variables must be an object');
  }
  return errors;
}

function validateEntities(entities) {
  const errors = [];
  if (typeof entities !== 'object') {
    return ['entities must be an object'];
  }
  for (const [name, def] of Object.entries(entities)) {
    if (!def.type) {
      errors.push(`entities.${name} missing required field: type`);
      continue;
    }
    if (def.type === 'enum') {
      if (!Array.isArray(def.values)) {
        errors.push(`entities.${name} enum must have values array`);
      }
    } else if (def.type === 'regex') {
      if (!def.pattern) {
        errors.push(`entities.${name} regex must have pattern`);
      } else {
        try {
          new RegExp(def.pattern);
        } catch (e) {
          errors.push(`entities.${name} regex pattern is invalid: ${e.message}`);
        }
      }
    } else {
      errors.push(`entities.${name} has invalid type: ${def.type} (must be 'enum' or 'regex')`);
    }
  }
  return errors;
}

function validateIntents(intents) {
  const errors = [];
  if (!Array.isArray(intents)) {
    return ['intents must be an array'];
  }
  intents.forEach((intent, idx) => {
    if (!intent.name) {
      errors.push(`intents[${idx}] missing name`);
    }
    if (!Array.isArray(intent.utterances)) {
      errors.push(`intents[${idx}] (${intent.name || 'unnamed'}) missing utterances array`);
    }
  });
  return errors;
}

function validateStates(states, actions) {
  const errors = [];
  if (!states || typeof states !== 'object') {
    return ['states must be an object'];
  }
  for (const [name, def] of Object.entries(states)) {
    if (!def) {
      errors.push(`states.${name} is empty`);
      continue;
    }
    if (def.on_enter && !actions[def.on_enter]) {
      errors.push(`states.${name}.on_enter references missing action: ${def.on_enter}`);
    }
    if (def.intent && !actions[def.intent]) {
      errors.push(`states.${name}.intent references missing action: ${def.intent}`);
    }
  }
  return errors;
}

function validateActions(actions, states) {
  const errors = [];
  if (!actions || typeof actions !== 'object') {
    return ['actions must be an object'];
  }
  for (const [name, def] of Object.entries(actions)) {
    if (!def.response) {
      errors.push(`actions.${name} missing response`);
    }
    if (def.buttons && !Array.isArray(def.buttons)) {
      errors.push(`actions.${name}.buttons must be an array`);
    }
    if (def.next_state && !states[def.next_state]) {
      errors.push(`actions.${name}.next_state references missing state: ${def.next_state}`);
    }
  }
  return errors;
}

function validateFallback(fallback) {
  const errors = [];
  if (!fallback || typeof fallback !== 'object') {
    return ['fallback must be an object'];
  }
  if (!fallback.response) {
    errors.push('fallback.response is required');
  }
  return errors;
}

function validateButtonHandlers(handlers, actions) {
  const errors = [];
  if (!handlers || typeof handlers !== 'object') {
    return ['button_handlers must be an object'];
  }
  for (const [id, def] of Object.entries(handlers)) {
    if (!def.action) {
      errors.push(`button_handlers.${id} missing action`);
    } else if (!actions[def.action]) {
      errors.push(`button_handlers.${id} references missing action: ${def.action}`);
    }
  }
  return errors;
}

module.exports = {
  validateDialogueSchema,
  DialogueValidationError
};
