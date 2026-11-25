import crypto from 'crypto';
import { getPool } from '../../db/pool.js';
import { MEMORY_TYPES, validateMemoryPayload } from './memoryTypes.js';
import { MemorySanitizer } from './memorySanitizer.js';
import { ConversationSummarizer } from './conversationSummarizer.js';

export class AdvancedMemoryService {
  /**
   * Saves or updates a scoped memory record.
   */
  static async saveMemory({
    userId,
    keyName,
    valueText,
    memoryType = MEMORY_TYPES.USER,
    softwareId = null,
    projectId = null,
    conversationId = null,
    metadata = null,
    expiresAt = null,
    category = 'general'
  }) {
    // 1. Validate payload structure
    validateMemoryPayload({ userId, keyName, valueText, memoryType });

    const cleanKey = keyName.trim();
    const cleanValue = valueText.trim();
    const cleanSoftwareId = softwareId ? String(softwareId).trim().toLowerCase() : null;
    const cleanProjectId = projectId ? String(projectId).trim() : null;
    const cleanConversationId = conversationId ? String(conversationId).trim() : null;

    // 2. Security validation: secrets and prompt injection guard
    MemorySanitizer.validateContent(cleanKey, cleanValue);

    // 3. Serialize metadata
    let serializedMeta = null;
    if (metadata) {
      serializedMeta = typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata);
    }

    const pool = getPool();

    // 4. Check for existing record within same scope
    let existingQuery = `
      SELECT id, version FROM user_memories
      WHERE user_id = ? AND key_name = ? AND memory_type = ?
    `;
    const queryParams = [userId, cleanKey, memoryType];

    if (cleanSoftwareId) {
      existingQuery += ' AND software_id = ?';
      queryParams.push(cleanSoftwareId);
    } else {
      existingQuery += ' AND software_id IS NULL';
    }

    if (cleanConversationId) {
      existingQuery += ' AND conversation_id = ?';
      queryParams.push(cleanConversationId);
    } else {
      existingQuery += ' AND conversation_id IS NULL';
    }

    const [existing] = await pool.query(existingQuery, queryParams);

    if (existing && existing.length > 0) {
      const existingId = existing[0].id;
      const nextVersion = (existing[0].version || 1) + 1;

      await pool.query(
        `UPDATE user_memories 
         SET value_text = ?, 
             category = ?, 
             project_id = ?, 
             metadata = ?, 
             expires_at = ?, 
             version = ?, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [cleanValue, category, cleanProjectId, serializedMeta, expiresAt, nextVersion, existingId, userId]
      );

      const [updated] = await pool.query('SELECT * FROM user_memories WHERE id = ?', [existingId]);
      return this._formatRow(updated[0]);
    } else {
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO user_memories (
          id, user_id, key_name, value_text, category, 
          memory_type, software_id, project_id, conversation_id, 
          metadata, expires_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, userId, cleanKey, cleanValue, category,
          memoryType, cleanSoftwareId, cleanProjectId, cleanConversationId,
          serializedMeta, expiresAt, 1
        ]
      );

      const [created] = await pool.query('SELECT * FROM user_memories WHERE id = ?', [id]);
      return this._formatRow(created[0]);
    }
  }

  /**
   * Retrieves memories matching specified scopes with strict user isolation.
   */
  static async getMemories({
    userId,
    memoryType = null,
    softwareId = null,
    projectId = null,
    conversationId = null,
    includeExpired = false
  }) {
    if (!userId) {
      throw new Error('AdvancedMemoryService: userId is required to retrieve memories.');
    }

    const pool = getPool();
    const conditions = ['user_id = ?'];
    const params = [userId];

    if (memoryType) {
      conditions.push('memory_type = ?');
      params.push(memoryType);
    }

    if (softwareId !== undefined && softwareId !== null) {
      conditions.push('software_id = ?');
      params.push(String(softwareId).toLowerCase());
    }

    if (projectId) {
      conditions.push('project_id = ?');
      params.push(projectId);
    }

    if (conversationId) {
      conditions.push('conversation_id = ?');
      params.push(conversationId);
    }

    if (!includeExpired) {
      conditions.push('(expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)');
    }

    const query = `
      SELECT * FROM user_memories
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC, created_at DESC
    `;

    const [rows] = await pool.query(query, params);
    return rows.map((r) => this._formatRow(r));
  }

  /**
   * Deletes a memory item ensuring strict user isolation.
   */
  static async deleteMemory(id, userId) {
    if (!id || !userId) {
      throw new Error('AdvancedMemoryService: id and userId are required for deletion.');
    }

    const pool = getPool();
    const [result] = await pool.query(
      'DELETE FROM user_memories WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Memory item not found or unauthorized.');
    }
    return { success: true, id };
  }

  /**
   * Prunes all expired memories across the entire system.
   */
  static async pruneExpiredMemories() {
    const pool = getPool();
    const [result] = await pool.query(
      'DELETE FROM user_memories WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP'
    );
    return { prunedCount: result.affectedRows };
  }

  /**
   * Summarizes a conversation and stores the condensed result as a persistent summary memory.
   */
  static async summarizeAndPersistConversation({ userId, conversationId, messages = [] }) {
    if (!userId || !conversationId || messages.length === 0) {
      return null;
    }

    const summaryText = ConversationSummarizer.generateExtractiveSummary(messages);
    if (!summaryText) return null;

    return await this.saveMemory({
      userId,
      keyName: `summary_${conversationId.slice(0, 8)}`,
      valueText: summaryText,
      memoryType: MEMORY_TYPES.SUMMARY,
      conversationId,
      category: 'summary'
    });
  }

  /**
   * Multi-Tier Contextual Memory Retrieval
   * Retrieves relevant memories prioritized across 5 tiers with strict scope isolation:
   * 1. Current Conversation Context / Summary
   * 2. Active Task Context
   * 3. Authorized Software Context (strictly partitioned)
   * 4. User Preferences
   * 5. General / Long-term User Context
   */
  static async getContextualMemories({
    userId,
    conversationId = null,
    softwareId = null,
    projectId = null,
    limit = 6
  }) {
    if (!userId) return [];

    const contextualItems = [];
    const seenIds = new Set();

    const pushUnique = (items) => {
      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          contextualItems.push(item);
          if (contextualItems.length >= limit) return true;
        }
      }
      return false;
    };

    // Tier 1: Current Conversation Context & Summary
    if (conversationId) {
      const convMemories = await this.getMemories({
        userId,
        conversationId,
        includeExpired: false
      });
      if (pushUnique(convMemories)) return contextualItems;
    }

    // Tier 2: Active Task Memories (for ongoing execution)
    const taskMemories = await this.getMemories({
      userId,
      memoryType: MEMORY_TYPES.TASK,
      softwareId: softwareId ? String(softwareId).toLowerCase() : null,
      includeExpired: false
    });
    if (pushUnique(taskMemories)) return contextualItems;

    // Tier 3: Authorized Software Context (strictly partitioned by softwareId)
    if (softwareId) {
      const softwareMemories = await this.getMemories({
        userId,
        memoryType: MEMORY_TYPES.SOFTWARE,
        softwareId: String(softwareId).toLowerCase(),
        includeExpired: false
      });
      if (pushUnique(softwareMemories)) return contextualItems;
    }

    // Tier 4: User Preferences (communication style, preferred tools, format)
    const userPrefs = await this.getMemories({
      userId,
      memoryType: MEMORY_TYPES.USER,
      includeExpired: false
    });
    // Sort preferences first
    const sortedPrefs = userPrefs.filter(
      (m) => m.category === 'preference' || m.key_name.toLowerCase().includes('prefer')
    );
    if (pushUnique(sortedPrefs)) return contextualItems;

    // Tier 5: General Project & Long-Term Memories
    if (projectId) {
      const projMemories = await this.getMemories({
        userId,
        projectId,
        includeExpired: false
      });
      if (pushUnique(projMemories)) return contextualItems;
    }

    // Remaining user memories if slots remain
    pushUnique(userPrefs);

    return contextualItems.slice(0, limit);
  }

  /**
   * Helper to format raw database rows safely.
   */
  static _formatRow(row) {
    if (!row) return null;
    let meta = null;
    if (row.metadata) {
      try {
        meta = JSON.parse(row.metadata);
      } catch {
        meta = row.metadata;
      }
    }
    return {
      id: row.id,
      user_id: row.user_id,
      key_name: row.key_name,
      value_text: row.value_text,
      category: row.category,
      memory_type: row.memory_type || MEMORY_TYPES.USER,
      software_id: row.software_id || null,
      project_id: row.project_id || null,
      conversation_id: row.conversation_id || null,
      metadata: meta,
      expires_at: row.expires_at || null,
      version: row.version || 1,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

