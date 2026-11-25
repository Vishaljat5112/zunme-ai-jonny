import { MemoryService } from '../services/memoryService.js';

export class MemoryController {
  static async getMemories(req, res, next) {
    try {
      const { memoryType, softwareId, projectId, conversationId, includeExpired } = req.query;
      const memories = await MemoryService.getMemories(req.user.id, {
        memoryType,
        softwareId,
        projectId,
        conversationId,
        includeExpired: includeExpired === 'true'
      });
      res.json({ success: true, memories });
    } catch (err) {
      next(err);
    }
  }

  static async saveMemory(req, res, next) {
    try {
      const {
        keyName,
        valueText,
        category,
        memoryType,
        softwareId,
        projectId,
        conversationId,
        metadata,
        expiresAt
      } = req.body;

      const memory = await MemoryService.saveMemory({
        userId: req.user.id,
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
      res.status(201).json({ success: true, memory });
    } catch (err) {
      next(err);
    }
  }

  static async deleteMemory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await MemoryService.deleteMemory(id, req.user.id);
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }
}
