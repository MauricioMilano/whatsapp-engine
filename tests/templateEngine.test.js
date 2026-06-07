/**
 * Tests for templateEngine
 */

const {
  renderTemplate,
  renderButtons,
  renderHeader,
  renderFooter,
  MAX_BUTTONS,
  MAX_HEADER_CHARS,
  MAX_FOOTER_CHARS
} = require('../src/templateEngine');

describe('renderTemplate', () => {
  test('replaces vars placeholders', () => {
    const out = renderTemplate('Hi {{vars.name}}', { name: 'João' });
    expect(out).toBe('Hi João');
  });

  test('replaces slots placeholders', () => {
    const out = renderTemplate('You chose {{slots.bebida}}', {}, { bebida: 'café' });
    expect(out).toBe('You chose café');
  });

  test('replaces both kinds', () => {
    const out = renderTemplate(
      '{{vars.quantidade}}x {{slots.bebida}}',
      { quantidade: 2 },
      { bebida: 'café' }
    );
    expect(out).toBe('2x café');
  });

  test('replaces missing placeholders with empty string', () => {
    const out = renderTemplate('Hi {{vars.name}}', {});
    expect(out).toBe('Hi ');
  });

  test('handles non-string input safely', () => {
    expect(renderTemplate(undefined, {})).toBe('');
    expect(renderTemplate(null, {})).toBe('');
  });
});

describe('renderButtons', () => {
  test('passes valid buttons through', () => {
    const out = renderButtons([{ id: 'a', title: 'Btn' }]);
    expect(out).toEqual([{ id: 'a', title: 'Btn' }]);
  });

  test('truncates long titles', () => {
    const long = 'x'.repeat(50);
    const out = renderButtons([{ id: 'a', title: long }]);
    expect(out[0].title.length).toBe(25);
  });

  test('caps to 13 buttons', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, title: `Btn${i}` }));
    const out = renderButtons(many);
    expect(out.length).toBe(MAX_BUTTONS);
  });

  test('filters out incomplete buttons', () => {
    const out = renderButtons([{ id: 'a' }, { title: 'no id' }, null]);
    expect(out).toEqual([]);
  });
});

describe('renderHeader', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('returns null for non-string input', () => {
    expect(renderHeader(undefined)).toBeNull();
    expect(renderHeader(null)).toBeNull();
    expect(renderHeader(42)).toBeNull();
    expect(renderHeader({})).toBeNull();
    expect(renderHeader([])).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(renderHeader('')).toBeNull();
  });

  test('returns plain text unchanged', () => {
    expect(renderHeader('☕ Café Bot')).toBe('☕ Café Bot');
  });

  test('substitutes {{vars.x}} placeholders', () => {
    expect(renderHeader('Pedido #{{vars.pedido_id}}', { pedido_id: '42' })).toBe('Pedido #42');
  });

  test('substitutes {{slots.x}} placeholders', () => {
    expect(renderHeader('Item: {{slots.bebida}}', {}, { bebida: 'café' })).toBe('Item: café');
  });

  test('returns header unchanged when shorter than the limit', () => {
    const short = 'x'.repeat(MAX_HEADER_CHARS - 1);
    expect(renderHeader(short)).toBe(short);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('truncates header longer than MAX_HEADER_CHARS and logs a warning', () => {
    const long = 'x'.repeat(MAX_HEADER_CHARS + 20);
    const out = renderHeader(long);
    expect(out.length).toBe(MAX_HEADER_CHARS);
    expect(out).toBe('x'.repeat(MAX_HEADER_CHARS));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toMatch(/Header/);
    expect(message).toMatch(/too long/);
    expect(message).toContain(String(MAX_HEADER_CHARS + 20));
  });
});

describe('renderFooter', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('returns null for non-string input', () => {
    expect(renderFooter(undefined)).toBeNull();
    expect(renderFooter(null)).toBeNull();
    expect(renderFooter(42)).toBeNull();
    expect(renderFooter({})).toBeNull();
    expect(renderFooter([])).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(renderFooter('')).toBeNull();
  });

  test('returns plain text unchanged', () => {
    expect(renderFooter('Atendimento 24h')).toBe('Atendimento 24h');
  });

  test('substitutes {{vars.x}} placeholders', () => {
    expect(renderFooter('{{vars.nome}}, volte sempre!', { nome: 'Maria' })).toBe('Maria, volte sempre!');
  });

  test('substitutes {{slots.x}} placeholders', () => {
    expect(renderFooter('Item: {{slots.bebida}}', {}, { bebida: 'chá' })).toBe('Item: chá');
  });

  test('returns footer unchanged when shorter than the limit', () => {
    const short = 'y'.repeat(MAX_FOOTER_CHARS - 1);
    expect(renderFooter(short)).toBe(short);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('truncates footer longer than MAX_FOOTER_CHARS and logs a warning', () => {
    const long = 'y'.repeat(MAX_FOOTER_CHARS + 40);
    const out = renderFooter(long);
    expect(out.length).toBe(MAX_FOOTER_CHARS);
    expect(out).toBe('y'.repeat(MAX_FOOTER_CHARS));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toMatch(/Footer/);
    expect(message).toMatch(/too long/);
    expect(message).toContain(String(MAX_FOOTER_CHARS + 40));
  });
});
