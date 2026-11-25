import { AdvancedMemoryService } from '../ai/memory/advancedMemoryService.js';
import { MEMORY_TYPES } from '../ai/memory/memoryTypes.js';
import { MemorySanitizer } from '../ai/memory/memorySanitizer.js';

export class MemoryService {
  /**
   * Get all persistent memories for a user.
   * Fully backward compatible with legacy getMemories(userId).
   */
  static async getMemories(userId = 'user_default', options = {}) {
    return AdvancedMemoryService.getMemories({
      userId,
      memoryType: options.memoryType || null,
      softwareId: options.softwareId || null,
      projectId: options.projectId || null,
      conversationId: options.conversationId || null,
      includeExpired: options.includeExpired || false
    });
  }

  /**
   * Save or update a persistent memory item for a user.
   * Fully backward compatible with legacy saveMemory payload.
   */
  static async saveMemory({
    userId = 'user_default',
    keyName,
    valueText,
    category = 'general',
    memoryType = MEMORY_TYPES.USER,
    softwareId = null,
    projectId = null,
    conversationId = null,
    metadata = null,
    expiresAt = null
  }) {
    return AdvancedMemoryService.saveMemory({
      userId,
      keyName,
      valueText,
      category,
      memoryType,
      softwareId,
      projectId,
      conversationId,
      metadata,
      expiresAt
    });
  }

  /**
   * Delete a memory item with user isolation check.
   */
  static async deleteMemory(id, userId = 'user_default') {
    return AdvancedMemoryService.deleteMemory(id, userId);
  }

  /**
   * Multi-tier contextual memory retrieval prioritized for prompt synthesis.
   */
  static async getContextualMemories(params) {
    return AdvancedMemoryService.getContextualMemories(params);
  }

  /**
   * Encloses retrieved memories in a passive, non-instructional frame.
   */
  static formatSafeMemoryBlock(memories) {
    return MemorySanitizer.formatSafeMemoryBlock(memories);
  }
}
