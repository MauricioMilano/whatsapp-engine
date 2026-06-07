/**
 * Dialogue JSON Schema Validator
 * Validates dialogue.json structure before loading
 */

const REQUIRED_TOP_LEVEL = [
  'meta',
  'context',
  'intents',
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

  // Validate actions
  errors.push(...validateActions(dialogue.actions));

  // Validate fallback
  errors.push(...validateFallback(dialogue.fallback));

  // Validate button_handlers
  errors.push(...validateButtonHandlers(dialogue.button_handlers, dialogue.actions));

  // Strict intent ↔ action validation (R1): every intent must have a
  // matching action. Runs after the main validators so that any
  // prerequisites (e.g., intents/actions being well-formed) are
  // already enforced.
  errors.push(...validateIntentActionMapping(dialogue.intents, dialogue.actions));

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
        // R4 (regex anchoring): warn if the pattern is not anchored.
        // The extractor runs `utterance.match(re)` without implicit
        // anchoring, so an unanchored pattern matches inside larger
        // strings. Authors should use `^...$` or `\b...\b`.
        const anchored = def.pattern.startsWith('^') || def.pattern.includes('\\b');
        if (!anchored) {
          console.warn(
            `⚠️  entities.${name} regex pattern is not anchored: "${def.pattern}". ` +
            `Consider wrapping with ^...$ or using \\b word boundaries to avoid false positives.`
          );
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

/**
 * R1 strict validation: every intent name must have a matching
 * action with at least a `response`. This was a silent runtime
 * fallback in the previous engine — now it fails at boot.
 *
 * Note: actions referenced ONLY by `button_handlers` (never by an
 * intent) are exempt. We approximate this by allowing actions that
 * exist even if no intent maps to them.
 */
function validateIntentActionMapping(intents, actions) {
  const errors = [];
  if (!Array.isArray(intents) || !actions || typeof actions !== 'object') {
    return errors;
  }
  for (const intent of intents) {
    if (!intent || !intent.name) continue;
    const action = actions[intent.name];
    if (!action) {
      errors.push(
        `intents[${intent.name}] has no matching action: create "actions.${intent.name}" with a "response" field (R1)`
      );
      continue;
    }
    if (typeof action.response !== 'string') {
      errors.push(
        `intents[${intent.name}] matches actions.${intent.name} but that action has no "response" string`
      );
    }
  }
  return errors;
}

function validateActions(actions) {
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
