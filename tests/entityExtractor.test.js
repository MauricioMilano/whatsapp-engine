/**
 * Tests for entityExtractor
 */

const { EntityExtractor } = require('../src/entityExtractor');

const entities = {
  bebida: {
    type: 'enum',
    values: ['café', 'chá', 'suco', 'refrigerante'],
    synonyms: { café: ['cafézinho', 'cafezinho'], chá: ['cha', 'te'] }
  },
  email: { type: 'regex', pattern: '[\\w.-]+@[\\w.-]+\\.\\w+' },
  qtd: { type: 'number', min: 1, max: 10 }
};

const extractor = new EntityExtractor(entities);

describe('EntityExtractor.extractEnum', () => {
  test('matches canonical value', () => {
    expect(extractor.extractEnum('quero um café', entities.bebida)).toBe('café');
  });

  test('resolves synonym to canonical', () => {
    expect(extractor.extractEnum('quero um cafezinho', entities.bebida)).toBe('café');
  });

  test('returns null when no match', () => {
    expect(extractor.extractEnum('quero uma pizza', entities.bebida)).toBeNull();
  });
});

describe('EntityExtractor.extractRegex', () => {
  test('extracts email', () => {
    expect(extractor.extractRegex('meu email é teste@exemplo.com', entities.email))
      .toBe('teste@exemplo.com');
  });

  test('returns null when no match', () => {
    expect(extractor.extractRegex('sem email aqui', entities.email)).toBeNull();
  });
});

describe('EntityExtractor.extractNumber', () => {
  test('extracts valid number', () => {
    expect(extractor.extractNumber('quero 5', entities.qtd)).toBe(5);
  });

  test('returns null when out of range', () => {
    expect(extractor.extractNumber('quero 99', entities.qtd)).toBeNull();
  });
});

describe('EntityExtractor.extractAll', () => {
  test('extracts matching slots', () => {
    const intents = [
      {
        name: 'pedir',
        slots: {
          bebida: { type: 'entity', entity: 'bebida' },
          email: { type: 'entity', entity: 'email' }
        }
      }
    ];
    const slots = extractor.extractAll(
      'quero um café enviado para teste@exemplo.com',
      entities,
      intents
    );
    const byName = Object.fromEntries(slots.map(s => [s.slotName, s.value]));
    expect(byName.bebida).toBe('café');
    expect(byName.email).toBe('teste@exemplo.com');
  });
});
