/**
 * NlpDialogueEngine
 *
 * Core engine that:
 *  - Loads dialogue.json (singleton)
 *  - Trains node-nlp NlpManager with intents
 *  - Processes user inputs (text and button)
 *  - Extracts entities
 *  - Executes actions with state transitions
 *  - Persists user context in PostgreSQL
 *  - Renders response templates
 */

const { NlpManager } = require('node-nlp');
const { validateDialogueSchema } = require('./utils/dialogueValidator');
const { extractAll } = require('./entityExtractor');
const { renderTemplate } = require('./templateEngine');
const {
  getContext,
  updateContext,
  cleanupExpiredSessions
} = require('./contextStore');

const FALLBACK_SCORE_THRESHOLD = parseFloat(process.env.FALLBACK_SCORE_THRESHOLD || '0.7');
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || '1800000', 10); // 30 min

class NlpDialogueEngine {
  constructor() {
    this.dialogue = null;
    this.manager = null;
    this.initialized = false;
  }

  static getInstance() {
    if (!NlpDialogueEngine._instance) {
      NlpDialogueEngine._instance = new NlpDialogueEngine();
    }
    return NlpDialogueEngine._instance;
  }

  /**
   * Load and validate dialogue.json, then train the NLP manager
   */
  async initialize(dialoguePath) {
    if (this.initialized) {
      return;
    }

    const path = dialoguePath || process.env.DIALOGUE_PATH || './dialogue.json';
    const fs = require('fs');

    let dialogue;
    try {
      const raw = fs.readFileSync(path, 'utf-8');
      dialogue = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to load dialogue.json at ${path}: ${err.message}`);
    }

    // Validate
    try {
      validateDialogueSchema(dialogue);
    } catch (err) {
      throw new Error(`Dialogue validation failed: ${err.message}`);
    }

    this.dialogue = dialogue;
    this.manager = new NlpManager({
      languages: [dialogue.meta.language],
      forceNER: true,
      nlu: { log: false }
    });

    this._trainIntents();
    this._trainAnswers();
    await this.manager.train();
    console.log('🧠 NLP training completed');

    // Initialize database tables
    const { initDatabase } = require('./contextStore');
    await initDatabase();

    this.initialized = true;
    console.log(`✅ NlpDialogueEngine initialized with dialogue: ${dialogue.meta.name} v${dialogue.meta.version}`);
  }

  _trainIntents() {
    for (const intent of this.dialogue.intents) {
      for (const utterance of intent.utterances) {
        this.manager.addDocument(
          this.dialogue.meta.language,
          utterance,
          intent.name
        );
      }
    }
  }

  _trainAnswers() {
    for (const [actionName, action] of Object.entries(this.dialogue.actions)) {
      if (action.response) {
        this.manager.addAnswer(
          this.dialogue.meta.language,
          actionName,
          action.response
        );
      }
    }
  }

  /**
   * Process a free-text message from the user
   * @param {string} userId - WhatsApp user phone number
   * @param {string} utterance - User message
   * @returns {Promise<{text: string, buttons: Array, nextState: string|null}>}
   */
  async processInput(userId, utterance) {
    this._ensureInitialized();

    try {
      // 1. Load user context
      const ctx = await getContext(userId, this.dialogue.context.variables);
      const slots = {};

      // 2. Extract entities from utterance
      const entities = extractAll(utterance, this.dialogue.entities, this.dialogue.intents);
      for (const ent of entities) {
        slots[ent.slotName] = ent.value;
      }

      // 3. Classify intent
      const result = await this.manager.process(this.dialogue.meta.language, utterance);
      const intent = result.intent;
      const score = result.score || 0;

      // 4. Check fallback conditions
      if (score < FALLBACK_SCORE_THRESHOLD || intent === 'None' || !this.dialogue.actions[intent]) {
        return this._renderFallback(ctx);
      }

      // 5. Find action for this intent
      const actionName = intent;
      const action = this.dialogue.actions[actionName];
      if (!action) {
        return this._renderFallback(ctx);
      }

      // 6. Update variables using action.set_variables with template substitution
      const updatedVars = { ...ctx.variables };
      if (action.set_variables) {
        for (const [k, v] of Object.entries(action.set_variables)) {
          updatedVars[k] = renderTemplate(v, updatedVars, slots);
        }
      }

      // 7. Determine next state
      const nextState = action.next_state || null;

      // 8. Persist new context
      await updateContext(userId, nextState, updatedVars);

      // 9. Render response and buttons
      return {
        text: renderTemplate(action.response, updatedVars, slots),
        buttons: this._renderButtons(action.buttons),
        nextState
      };
    } catch (err) {
      console.error('Error in processInput:', err.message);
      return this._renderFallback({ variables: this.dialogue.context.variables });
    }
  }

  /**
   * Process a button click from the user
   * @param {string} userId
   * @param {string} buttonId
   */
  async processButton(userId, buttonId) {
    this._ensureInitialized();

    try {
      const handler = this.dialogue.button_handlers[buttonId];
      if (!handler) {
        const ctx = await getContext(userId, this.dialogue.context.variables);
        return this._renderFallback(ctx);
      }

      const action = this.dialogue.actions[handler.action];
      if (!action) {
        const ctx = await getContext(userId, this.dialogue.context.variables);
        return this._renderFallback(ctx);
      }

      const ctx = await getContext(userId, this.dialogue.context.variables);
      const slots = handler.slots || {};

      const updatedVars = { ...ctx.variables };
      if (action.set_variables) {
        for (const [k, v] of Object.entries(action.set_variables)) {
          updatedVars[k] = renderTemplate(v, updatedVars, slots);
        }
      }

      const nextState = action.next_state || null;
      await updateContext(userId, nextState, updatedVars);

      return {
        text: renderTemplate(action.response, updatedVars, slots),
        buttons: this._renderButtons(action.buttons),
        nextState
      };
    } catch (err) {
      console.error('Error in processButton:', err.message);
      return this._renderFallback({ variables: this.dialogue.context.variables });
    }
  }

  _renderButtons(buttons) {
    if (!buttons || !Array.isArray(buttons)) return [];
    if (buttons.length > 13) {
      console.warn(`Action has more than 13 buttons (${buttons.length}). Truncating.`);
      buttons = buttons.slice(0, 13);
    }
    return buttons.map(b => {
      const title = (b.title || '').slice(0, 25);
      return { id: b.id, title };
    });
  }

  _renderFallback(ctx) {
    const fb = this.dialogue.fallback;
    return {
      text: renderTemplate(fb.response, ctx.variables || this.dialogue.context.variables, {}),
      buttons: this._renderButtons(fb.buttons),
      nextState: null
    };
  }

  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('NlpDialogueEngine not initialized. Call initialize() first.');
    }
  }

  /**
   * Cleanup expired sessions periodically
   */
  async cleanup() {
    await cleanupExpiredSessions(SESSION_TIMEOUT_MS);
  }
}

module.exports = NlpDialogueEngine;
