/**
 * Token estimation — derived from Chatbox's token-estimation package.
 *
 * Simplified for ChatBridge's server-authoritative model:
 *   - No async queue or background workers (server does the heavy lifting)
 *   - Simple heuristic estimator for client-side context awareness
 *   - Used for context window display and compaction threshold detection
 *
 * Original: chatbox/src/renderer/packages/token-estimation/tokenizer.ts
 */

/**
 * Estimate the number of tokens in a string using a fast heuristic.
 *
 * This matches the approach used in Chatbox when tiktoken is unavailable:
 *   - English words/numbers/symbols: ~0.3 tokens per character
 *   - CJK characters: ~0.6 tokens per character
 *   - Whitespace: ~1 token per character
 *
 * For accurate counts, the server should use tiktoken directly.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  let tokens = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x20) {
      // Whitespace / control chars
      tokens += 1;
    } else if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
      (code >= 0x3000 && code <= 0x303f) || // CJK Symbols
      (code >= 0xff00 && code <= 0xffef) // Fullwidth Forms
    ) {
      tokens += 0.6;
    } else {
      tokens += 0.3;
    }
  }

  // Add overhead for message framing (~4 tokens per message)
  return Math.ceil(tokens) + 4;
}

/**
 * Estimate tokens for an array of messages.
 */
export function estimateConversationTokens(
  messages: { role: string; content: string }[]
): number {
  // Base overhead for the conversation
  let total = 3;
  for (const msg of messages) {
    total += estimateTokens(msg.content);
  }
  return total;
}
