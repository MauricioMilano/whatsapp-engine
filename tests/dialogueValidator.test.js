/**
 * Tests for dialogueValidator
 */

const { validateDialogueSchema, DialogueValidationError } = require('../src/utils/dialogueValidator');
const fs = require('fs');
const path = require('path');

const loadDialogueFile = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', name), 'utf-8'));

const validDialogue = {
  meta: { name: 'test-bot', version: '1.0.0', language: 'pt-BR' },
  context: { variables: { foo: null } },
  entities: {
    bebida: { type: 'enum', values: ['café', 'chá'] }
  },
  intents: [
    { name: 'saudacao', utterances: ['oi', 'olá'], slots: {} }
  ],
  actions: {
    saudacao: { response: 'Olá!' }
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

  test('rejects button handler referencing missing action', () => {
    const d = {
      ...validDialogue,
      button_handlers: { btn1: { action: 'nonexistent' } }
    };
    expect(() => validateDialogueSchema(d)).toThrow(DialogueValidationError);
  });

  // --- R1 strict validation ---

  test('rejects intent without matching action (R1)', () => {
    const d = {
      ...validDialogue,
      intents: [
        { name: 'saudacao', utterances: ['oi'] },
        { name: 'orphan', utterances: ['help'] }   // ◄── no actions.orphan
      ]
    };
    expect(() => validateDialogueSchema(d)).toThrow(DialogueValidationError);
  });

  test('rejects intent whose matching action has no response', () => {
    const d = {
      ...validDialogue,
      intents: [{ name: 'silent', utterances: ['shh'] }],
      actions: {
        ...validDialogue.actions,
        silent: { buttons: [] }   // ◄── missing response
      }
    };
    expect(() => validateDialogueSchema(d)).toThrow(DialogueValidationError);
  });

  test('accepts button-only actions that have no matching intent', () => {
    // Action is referenced only by button_handlers — exempt from R1.
    const d = {
      ...validDialogue,
      actions: {
        ...validDialogue.actions,
        button_only: { response: 'just a button' }
      },
      button_handlers: {
        ...validDialogue.button_handlers,
        btn_x: { action: 'button_only' }
      }
    };
    expect(() => validateDialogueSchema(d)).not.toThrow();
  });

  // --- R4 regex anchoring warning ---

  test('warns on unanchored regex entity pattern', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const d = {
      ...validDialogue,
      entities: { data: { type: 'regex', pattern: '\\d{2}/\\d{2}/\\d{4}' } }
    };
    validateDialogueSchema(d);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('entities.data regex pattern is not anchored')
    );
    warnSpy.mockRestore();
  });

  test('does not warn on anchored regex entity pattern', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const d = {
      ...validDialogue,
      entities: { data: { type: 'regex', pattern: '^\\d{2}/\\d{2}/\\d{4}$' } }
    };
    validateDialogueSchema(d);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('entities.data regex pattern is not anchored')
    );
    warnSpy.mockRestore();
  });
});

// --- Smoke tests: real dialogue files on disk ---
// Guards against file rot / silent schema regressions in the two dialogue
// files shipped with the project (cafe + barber). Both are loaded and validated
// against the same schema as the unit tests above.

describe('validateDialogueSchema (real dialogue files)', () => {
  test('loads and validates dialogue.json (cafe-bot)', () => {
    const d = loadDialogueFile('dialogue.json');
    expect(() => validateDialogueSchema(d)).not.toThrow();
  });

  test('loads and validates barber.json (dometts)', () => {
    const d = loadDialogueFile('barber.json');
    expect(() => validateDialogueSchema(d)).not.toThrow();
  });

  test('dialogue.json and barber.json have distinct meta.name', () => {
    const cafe = loadDialogueFile('dialogue.json');
    const barber = loadDialogueFile('barber.json');
    expect(cafe.meta.name).not.toEqual(barber.meta.name);
  });
});
