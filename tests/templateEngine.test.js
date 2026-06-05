/**
 * Tests for templateEngine
 */

const { renderTemplate, renderButtons, MAX_BUTTONS } = require('../src/templateEngine');

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
