/**
 * Kiaan AI Conversation Summarizer (Step 8)
 * Compresses older conversation history into bounded executive digests
 * to prevent context explosion and preserve long-term conversation intent.
 */

export class ConversationSummarizer {
  /**
   * Deterministic, fast extractive summarizer that extracts key topics, decisions,
   * and requests from older conversation turns without requiring external model latency.
   * @param {Array<{role: string, content: string}>} messages
   * @returns {string} Condensed summary text
   */
  static generateExtractiveSummary(messages = []) {
    if (!messages || messages.length === 0) return '';

    const userPoints = [];
    const assistantOutcomes = [];

    for (const msg of messages) {
      if (!msg.content || typeof msg.content !== 'string') continue;
      const text = msg.content.trim();
      const firstLine = text.split('\n')[0].slice(0, 120);

      if (msg.role === 'user') {
        userPoints.push(firstLine);
      } else if (msg.role === 'assistant') {
        assistantOutcomes.push(firstLine);
      }
    }

    const summaryParts = [];
    if (userPoints.length > 0) {
      const topUserTopics = userPoints.slice(0, 4).map((p) => `* User inquired/requested: "${p}"`);
      summaryParts.push('User Topics Discussed:\n' + topUserTopics.join('\n'));
    }

    if (assistantOutcomes.length > 0) {
      const topResponses = assistantOutcomes.slice(0, 3).map((p) => `* System resolved/provided: "${p}"`);
      summaryParts.push('Key Decisions & Solutions:\n' + topResponses.join('\n'));
    }

    return summaryParts.join('\n\n');
  }

  /**
   * Checks whether a conversation warrants summarization based on turn count.
   * @param {number} messageCount
   * @param {number} threshold (default 8)
   */
  static shouldSummarize(messageCount, threshold = 8) {
    return messageCount >= threshold;
  }
}

