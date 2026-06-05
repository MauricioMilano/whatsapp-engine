/**
 * Tests for the NlpDialogueEngine using a stubbed context store
 *
 * These tests focus on the orchestration logic - they monkey-patch the
 * contextStore so the test suite does not need a real PostgreSQL.
 */

jest.mock('../src/contextStore', () => {
  const store = new Map();
  return {
    initDatabase: jest.fn(async () => {}),
    getContext: jest.fn(async (userId, defaultVars) => {
      if (!store.has(userId)) {
        return { state: null, variables: { ...defaultVars }, isNew: true };
      }
      return { state: null, variables: { ...store.get(userId) }, isNew: false };
    }),
    updateContext: jest.fn(async (userId, state, variables) => {
      store.set(userId, variables);
    }),
    deleteContext: jest.fn(async (userId) => { store.delete(userId); }),
    cleanupExpiredSessions: jest.fn(async () => 0)
  };
});

const fs = require('fs');
const path = require('path');
const NlpDialogueEngine = require('../src/nlpDialogueEngine');
const { resetExtractor } = require('../src/entityExtractor');

const TEST_DIALOGUE = {
  meta: { name: 'test-bot', version: '1.0.0', language: 'pt' },
  context: { variables: { nome: null, pedido: null } },
  entities: {
    bebida: {
      type: 'enum',
      values: ['café', 'chá', 'suco'],
      synonyms: { café: ['cafezinho'] }
    }
  },
  intents: [
    { name: 'saudacao', utterances: ['oi', 'olá', 'bom dia'], slots: {} },
    { name: 'fazer_pedido', utterances: ['quero pedir', 'fazer pedido'], slots: {} },
    { name: 'escolher_bebida', utterances: ['café', 'chá', 'suco'], slots: {
      bebida: { type: 'entity', entity: 'bebida' }
    } }
  ],
  states: {
    inicio: { on_enter: 'saudacao', intent: null },
    main: { on_enter: 'fazer_pedido', intent: null }
  },
  actions: {
    saudacao: { response: 'Olá!', buttons: [{ id: 'btn1', title: 'Continuar' }], next_state: 'main' },
    fazer_pedido: { response: 'O que deseja?', buttons: [{ id: 'beb_cafe', title: 'Café' }], next_state: 'main' },
    registrar_bebida: { response: 'Você escolheu {{slots.bebida}}.', buttons: [] }
  },
  fallback: { response: 'Não entendi.', buttons: [{ id: 'btn_menu', title: 'Menu' }] },
  button_handlers: {
    btn1: { action: 'fazer_pedido' },
    beb_cafe: { action: 'registrar_bebida', slots: { bebida: 'café' } }
  }
};

describe('NlpDialogueEngine', () => {
  let engine;
  const tmpPath = path.join(__dirname, '_tmp_dialogue.json');

  beforeAll(async () => {
    fs.writeFileSync(tmpPath, JSON.stringify(TEST_DIALOGUE));
    // reset singleton
    NlpDialogueEngine._instance = null;
    resetExtractor();
    engine = NlpDialogueEngine.getInstance();
    await engine.initialize(tmpPath);
  });

  afterAll(() => {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  });

  test('initializes and trains the NLP manager', () => {
    expect(engine.initialized).toBe(true);
    expect(engine.manager).toBeTruthy();
  });

  test('processInput returns a response for a known intent', async () => {
    const r = await engine.processInput('user-1', 'oi');
    expect(r.text).toMatch(/Olá/);
    expect(r.buttons.length).toBe(1);
    expect(r.buttons[0].id).toBe('btn1');
  });

  test('processInput returns fallback for unknown text', async () => {
    const r = await engine.processInput('user-1', 'asdkjhkasd asdkjh');
    expect(r.text).toMatch(/Não entendi/);
  });

  test('processButton executes the action associated with the button id', async () => {
    const r = await engine.processButton('user-2', 'beb_cafe');
    expect(r.text).toBe('Você escolheu café.');
  });

  test('processButton returns fallback for unknown button id', async () => {
    const r = await engine.processButton('user-2', 'nope');
    expect(r.text).toMatch(/Não entendi/);
  });
});
