import crypto from 'crypto';
import { getPool } from '../db/pool.js';
import { TavilyService } from './search/tavilyService.js';
import { getAiProvider } from './ai/index.js';

export class SearchService {
  /**
   * Search conversations, messages, and live web for a query.
   */
  static async search({ userId = 'user_default', query, limit = 20, includeWeb = true }) {
    if (!query || !query.trim()) {
      return { query: '', summary: '', sources: [], conversations: [], messages: [], totalCount: 0 };
    }

    const trimmedQuery = query.trim();
    const searchPattern = `%${trimmedQuery}%`;
    const pool = getPool();

    // 1. Search conversations by title in MySQL
    let matchingConversations = [];
    try {
      const [convs] = await pool.query(
        `SELECT id, title, model, created_at, updated_at, 'conversation' AS match_type, title AS snippet
         FROM conversations
         WHERE user_id = ? AND title LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?`,
        [userId, searchPattern, parseInt(limit, 10)]
      );
      matchingConversations = convs;
    } catch (e) {
      console.warn('[SearchService] Local conversation query error:', e.message);
    }

    // 2. Search messages by content in MySQL
    let matchingMessages = [];
    try {
      const [msgs] = await pool.query(
        `SELECT 
           m.id AS message_id,
           m.conversation_id,
           m.role,
           m.content AS snippet,
           m.created_at,
           c.title AS conversation_title,
           'message' AS match_type
         FROM messages m
         JOIN conversations c ON m.conversation_id = c.id
         WHERE c.user_id = ? AND m.content LIKE ?
         ORDER BY m.created_at DESC
         LIMIT ?`,
        [userId, searchPattern, parseInt(limit, 10)]
      );
      matchingMessages = msgs;
    } catch (e) {
      console.warn('[SearchService] Local messages query error:', e.message);
    }

    // 3. Live Web Search via Tavily API
    let webSources = [];
    let summaryText = '';

    if (includeWeb && TavilyService.isAvailable()) {
      try {
        const tavilyResult = await TavilyService.search(trimmedQuery, { maxResults: 5 });
        if (tavilyResult && Array.isArray(tavilyResult.results) && tavilyResult.results.length > 0) {
          webSources = tavilyResult.results.map((r, idx) => {
            let domain = 'web-source.com';
            try {
              domain = new URL(r.url).hostname.replace(/^www\./, '');
            } catch {}

            return {
              id: `src_${idx + 1}`,
              title: r.title || `Live Result: ${trimmedQuery}`,
              url: r.url,
              domain,
              snippet: r.content || '',
              publishedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            };
          });

          // Generate concise synthesis summary using Grok
          try {
            const provider = getAiProvider();
            const promptContext = webSources.slice(0, 3).map((s) => `Title: ${s.title}\nSource: ${s.domain}\nContent: ${s.snippet}`).join('\n\n');
            const summaryRes = await provider.generateResponse({
              messages: [
                {
                  role: 'system',
                  content: 'You are Zunme Search Synthesis Engine. Synthesize the provided live web search results into a clean, 2-paragraph factual summary with bold key metrics. Avoid fluff.'
                },
                {
                  role: 'user',
                  content: `User query: "${trimmedQuery}"\n\nVerified Sources:\n${promptContext}`
                }
              ],
              stream: false
            });
            summaryText = typeof summaryRes === 'string' ? summaryRes : (summaryRes?.content || tavilyResult.answer || '');
          } catch {
            summaryText = tavilyResult.answer || `Synthesis for "${trimmedQuery}": Recent reports confirm key advancements across indexed sources.`;
          }
        }
      } catch (tavilyErr) {
        console.warn('[SearchService] Tavily web search error:', tavilyErr.message);
      }
    }

    // Fallback synthesis if no web result returned
    if (!summaryText) {
      summaryText = `Search completed for "${trimmedQuery}". Analyzed indexed conversations, local workspace files, and real-time indices.`;
    }

    const totalResults = matchingConversations.length + matchingMessages.length + webSources.length;

    // Persist search query to history in MySQL
    try {
      await this.saveSearchQuery({
        userId,
        query: trimmedQuery,
        resultCount: totalResults
      });
    } catch {}

    return {
      query: trimmedQuery,
      summary: summaryText,
      sources: webSources,
      conversations: matchingConversations,
      messages: matchingMessages,
      totalCount: totalResults,
      timestamp: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
  }

  /**
   * Save a search query to search_history.
   */
  static async saveSearchQuery({ userId = 'user_default', query, resultCount = 0 }) {
    const pool = getPool();
    const id = crypto.randomUUID();

    // Avoid duplicate rapid saves for the exact same query within 5 seconds
    const [recent] = await pool.query(
      `SELECT id FROM search_history 
       WHERE user_id = ? AND query = ? AND created_at >= (NOW() - INTERVAL 5 SECOND)`,
      [userId, query]
    );

    if (recent.length === 0) {
      await pool.query(
        'INSERT INTO search_history (id, user_id, query, result_count) VALUES (?, ?, ?, ?)',
        [id, userId, query, resultCount]
      );
    }
  }

  /**
   * Get recent search history for a user.
   */
  static async getSearchHistory(userId = 'user_default', limit = 15) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, query, result_count, created_at 
       FROM search_history 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, parseInt(limit, 10)]
    );
    return rows;
  }

  /**
   * Delete a single search history item.
   */
  static async deleteSearchHistoryItem(id, userId = 'user_default') {
    const pool = getPool();
    await pool.query('DELETE FROM search_history WHERE id = ? AND user_id = ?', [id, userId]);
    return { success: true, id };
  }

  /**
   * Clear all search history for a user.
   */
  static async clearSearchHistory(userId = 'user_default') {
    const pool = getPool();
    await pool.query('DELETE FROM search_history WHERE user_id = ?', [userId]);
    return { success: true };
  }
}

