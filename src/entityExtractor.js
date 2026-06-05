/**
 * EntityExtractor
 *
 * Extracts structured entities from user utterances.
 * Supports two entity types:
 *   - "enum": match against canonical values + synonyms
 *   - "regex": match against a regular expression pattern
 */

class EntityExtractor {
  constructor(entities = {}) {
    this.entities = entities;
    // Build reverse lookup table for enum synonyms
    this._synonymMap = {};
    for (const [name, def] of Object.entries(entities)) {
      if (def.type === 'enum' && def.synonyms) {
        for (const [canonical, synonyms] of Object.entries(def.synonyms)) {
          for (const syn of synonyms) {
            this._synonymMap[syn.toLowerCase()] = {
              entity: name,
              value: canonical
            };
          }
        }
      }
    }
  }

  /**
   * Extract a single enum entity from the utterance.
   * @returns {string|null} canonical value or null
   */
  extractEnum(utterance, entityDef) {
    if (!entityDef || entityDef.type !== 'enum') return null;
    const lower = utterance.toLowerCase();

    // Direct match against canonical values (unicode-aware boundary)
    for (const v of entityDef.values) {
      if (wordContains(lower, v.toLowerCase())) return v;
    }

    // Synonym match
    for (const [syn, info] of Object.entries(this._synonymMap)) {
      if (!entityDef.values.includes(info.value)) continue;
      if (wordContains(lower, syn)) {
        return info.value;
      }
    }

    return null;
  }

  /**
   * Extract a single regex entity from the utterance.
   * @returns {string|null} matched value or null
   */
  extractRegex(utterance, entityDef) {
    if (!entityDef || entityDef.type !== 'regex') return null;
    try {
      const re = new RegExp(entityDef.pattern, 'i');
      const m = utterance.match(re);
      return m ? m[0] : null;
    } catch (e) {
      console.error('Invalid regex pattern:', entityDef.pattern, e.message);
      return null;
    }
  }

  /**
   * Extract a number slot.
   * @returns {number|null}
   */
  extractNumber(utterance, slotDef) {
    if (!slotDef || slotDef.type !== 'number') return null;
    const m = utterance.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return null;
    const value = parseFloat(m[0].replace(',', '.'));
    if (Number.isNaN(value)) return null;
    if (slotDef.min !== undefined && value < slotDef.min) return null;
    if (slotDef.max !== undefined && value > slotDef.max) return null;
    return value;
  }

  /**
   * Extract all slots from the utterance for the given intents.
   * Returns an array of { slotName, value, entity, type }
   */
  extractAll(utterance, entities, intents) {
    const results = [];

    // Iterate each intent's slots and try to extract values
    for (const intent of intents || []) {
      for (const [slotName, slotDef] of Object.entries(intent.slots || {})) {
        let value = null;

        if (slotDef.type === 'entity' && slotDef.entity) {
          const entDef = entities[slotDef.entity];
          if (!entDef) continue;
          if (entDef.type === 'enum') {
            value = this.extractEnum(utterance, entDef);
          } else if (entDef.type === 'regex') {
            value = this.extractRegex(utterance, entDef);
          }
        } else if (slotDef.type === 'number') {
          value = this.extractNumber(utterance, slotDef);
        }

        if (value !== null && value !== undefined) {
          results.push({
            slotName,
            value,
            entity: slotDef.entity || null,
            type: slotDef.type
          });
        }
      }
    }

    return results;
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check whether `needle` appears in `haystack` surrounded by non-letter boundaries.
 * Works for accented characters (unlike JS regex \b which is ASCII-only).
 */
function wordContains(haystack, needle) {
  if (!needle) return false;
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const before = idx === 0 ? ' ' : haystack[idx - 1];
  const afterIdx = idx + needle.length;
  const after = afterIdx >= haystack.length ? ' ' : haystack[afterIdx];
  return !isLetter(before) && !isLetter(after);
}

function isLetter(ch) {
  return /[\p{L}\p{N}_]/u.test(ch);
}

// Singleton-style helper used by the engine
let _extractor = null;
function extractAll(utterance, entities, intents) {
  if (!_extractor) {
    _extractor = new EntityExtractor(entities);
  }
  return _extractor.extractAll(utterance, entities, intents);
}

function resetExtractor() {
  _extractor = null;
}

module.exports = {
  EntityExtractor,
  extractAll,
  resetExtractor
};
