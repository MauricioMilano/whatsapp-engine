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
  context: { variables: { nome: 'Maria', pedido: null, pedido_id: '42' } },
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
    { name: 'registrar_bebida', utterances: ['café', 'chá', 'suco'], slots: {
      bebida: { type: 'entity', entity: 'bebida' }
    } },
    { name: 'consulta_pedido', utterances: ['meu pedido', 'status pedido', 'consultar pedido'], slots: {} }
  ],
  actions: {
    saudacao: {
      response: 'Olá!',
      header: '☕ Café Bot',
      footer: 'Atendimento 24h',
      buttons: [{ id: 'btn1', title: 'Continuar' }]
    },
    fazer_pedido: {
      response: 'O que deseja?',
      // intentionally no header/footer
      buttons: [{ id: 'beb_cafe', title: 'Café' }]
    },
    registrar_bebida: { response: 'Você escolheu {{slots.bebida}}.', buttons: [] },
    consulta_pedido: {
      response: 'Pedido {{vars.pedido_id}} ativo.',
      header: 'Pedido #{{vars.pedido_id}}',
      footer: '{{vars.nome}}, atualize em 5min',
      buttons: []
    }
  },
  fallback: {
    response: 'Não entendi.',
    header: '⚠️ Ops',
    footer: 'Tente reformular',
    buttons: [{ id: 'btn_menu', title: 'Menu' }]
  },
  button_handlers: {
    btn1: { action: 'fazer_pedido' },
    beb_cafe: { action: 'registrar_bebida', slots: { bebida: 'café' } },
    btn_consultar: { action: 'consulta_pedido' }
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

  // --- header / footer ---

  test('processInput returns header and footer populated for the action that defines them', async () => {
    const r = await engine.processInput('user-hf-1', 'oi');
    expect(r.header).toBe('☕ Café Bot');
    expect(r.footer).toBe('Atendimento 24h');
  });

  test('processInput returns header: null and footer: null for the action that omits them', async () => {
    const r = await engine.processInput('user-hf-2', 'quero pedir');
    expect(r.header).toBeNull();
    expect(r.footer).toBeNull();
  });

  test('processInput always returns the result shape with header and footer keys', async () => {
    const known = await engine.processInput('user-hf-shape-1', 'oi');
    expect(Object.prototype.hasOwnProperty.call(known, 'header')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(known, 'footer')).toBe(true);

    const fallback = await engine.processInput('user-hf-shape-2', 'asdkjhkasd asdkjh');
    expect(Object.prototype.hasOwnProperty.call(fallback, 'header')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(fallback, 'footer')).toBe(true);
  });

  test('_renderFallback returns the fallback header and footer when fallback is triggered', async () => {
    const r = await engine.processInput('user-hf-3', 'asdkjhkasd asdkjh');
    expect(r.text).toMatch(/Não entendi/);
    expect(r.header).toBe('⚠️ Ops');
    expect(r.footer).toBe('Tente reformular');
  });

  test('placeholder substitution resolves in header and footer (processButton path)', async () => {
    const r = await engine.processButton('user-hf-4', 'btn_consultar');
    expect(r.header).toBe('Pedido #42');
    expect(r.footer).toBe('Maria, atualize em 5min');
  });

  // --- FSM removal: nextState is always null ---

  test('processInput returns nextState: null (FSM removed)', async () => {
    const r = await engine.processInput('user-ns-1', 'oi');
    expect(Object.prototype.hasOwnProperty.call(r, 'nextState')).toBe(true);
    expect(r.nextState).toBeNull();
  });

  test('processButton returns nextState: null (FSM removed)', async () => {
    const r = await engine.processButton('user-ns-2', 'beb_cafe');
    expect(Object.prototype.hasOwnProperty.call(r, 'nextState')).toBe(true);
    expect(r.nextState).toBeNull();
  });

  test('fallback result has nextState: null', async () => {
    const r = await engine.processInput('user-ns-3', 'asdkjhkasd asdkjh');
    expect(r.nextState).toBeNull();
  });
});
