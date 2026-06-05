/**
 * TemplateEngine
 *
 * Replaces placeholders in response templates:
 *   - {{vars.x}}   → context variable
 *   - {{slots.x}}  → slot extracted from current utterance
 *
 * Also renders and validates button lists.
 */

const MAX_BUTTONS = 13;
const MAX_TITLE_CHARS = 25;

const PLACEHOLDER_RE = /\{\{\s*(vars|slots)\.([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Render a template string by substituting vars and slots placeholders.
 *
 * @param {string} template - the template text (e.g. "Hi {{vars.nome}}")
 * @param {object} vars - context variables
 * @param {object} slots - slot values from the current utterance
 * @returns {string} rendered text
 */
function renderTemplate(template, vars = {}, slots = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(PLACEHOLDER_RE, (match, kind, name) => {
    if (kind === 'vars') {
      const v = vars[name];
      return v === undefined || v === null ? '' : String(v);
    }
    if (kind === 'slots') {
      const s = slots[name];
      return s === undefined || s === null ? '' : String(s);
    }
    return match;
  });
}

/**
 * Render and validate an array of buttons.
 * Truncates titles > 25 chars and logs a warning.
 * Caps the number of buttons to 13.
 *
 * @param {Array<{id: string, title: string}>} buttons
 * @returns {Array<{id: string, title: string}>}
 */
function renderButtons(buttons) {
  if (!Array.isArray(buttons)) return [];

  if (buttons.length > MAX_BUTTONS) {
    console.warn(
      `Too many buttons: ${buttons.length} (max ${MAX_BUTTONS}). Truncating.`
    );
    buttons = buttons.slice(0, MAX_BUTTONS);
  }

  return buttons
    .filter(b => b && b.id && b.title)
    .map(b => {
      if (b.title.length > MAX_TITLE_CHARS) {
        console.warn(
          `Button "${b.id}" title too long (${b.title.length} chars). Truncating.`
        );
      }
      return {
        id: b.id,
        title: b.title.slice(0, MAX_TITLE_CHARS)
      };
    });
}

module.exports = {
  renderTemplate,
  renderButtons,
  MAX_BUTTONS,
  MAX_TITLE_CHARS
};
