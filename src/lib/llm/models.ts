/**
 * The only place a model id may appear.
 *
 * Policy (Z, 16 Aug 2026): no Opus anywhere in ARC's own features. Haiku is
 * the default for volume work — invoice parsing, chat intent parsing, idea
 * generation. Sonnet is reserved for genuinely hard turns (multi-entity
 * escalations). The previous parser hardcoded claude-opus-5 and burned the
 * key's entire credit; that is what this file exists to prevent.
 */

export const HAIKU = "claude-haiku-4-5";
export const SONNET = "claude-sonnet-5";
