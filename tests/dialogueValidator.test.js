/**
 * Tests for dialogueValidator
 */

const { validateDialogueSchema, DialogueValidationError } = require('../src/utils/dialogueValidator');

const validDialogue = {
  meta: { name: 'test-bot', version: '1.0.0', language: 'pt-BR' },
  context: { variables: { foo: null } },
  entities: {
    bebida: { type: 'enum', values: ['café', 'chá'] }
  },
  intents: [
    { name: 'saudacao', utterances: ['oi', 'olá'], slots: {} }
  ],
  states: {
    inicio: { on_enter: 'saudacao', intent: null }
  },
  actions: {
    saudacao: { response: 'Olá!', next_state: 'inicio' }
  },
  fallback: { response: 'Não entendi' },
  button_handlers: {
    btn1: { action: 'saudacao' }
  }
};

describe('validateDialogueSchema', () => {
  test('accepts a valid dialogue', () => {
    expect(() => validateDialogueSchema(validDialogue)).not.toThrow();
  });

  test('rejects null', () => {
    expect(() => validateDialogueSchema(null)).toThrow(DialogueValidationError);
  });

  test('rejects missing meta', () => {
    const d = { ...validDialogue };
    delete d.meta;
    expect(() => validateDialogueSchema(d)).toThrow(DialogueValidationError);
  });

  test('rejects missing intents', () => {
    const d = { ...validDialogue };
    delete d.intents;
    expect(() => validateDialogueSchema(d)).toThrow(DialogueValidationError);
  });

  test('rejects invalid regex in entities', () => {
    const d = {
      ...validDialogue,
      entities: { email: { type: 'regex', pattern: '[invalid(' } }
    };
    expect(() => validateDialogueSchema(d)).toThrow(DialogueValidationError);
  });

  test('rejects state on_enter referencing missing action', () => {
    const d = {
      ...validDialogue,
      states: { inicio: { on_enter: 'nonexistent' } }
    };
    expect(() => validateDialogueSchema(d)).toThrow(DialogueValidationError);
  });

  test('rejects button handler referencing missing action', () => {
    const d = {
      ...validDialogue,
      button_handlers: { btn1: { action: 'nonexistent' } }
    };
    expect(() => validateDialogueSchema(d)).toThrow(DialogueValidationError);
  });
});
