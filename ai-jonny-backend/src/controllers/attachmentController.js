import path from 'path';
import fs from 'fs';
import { AttachmentService } from '../services/attachmentService.js';
import { ConversationService } from '../services/conversationService.js';
import { getPool } from '../db/pool.js';
import { config } from '../config/index.js';

export class AttachmentController {
  static async uploadFiles(req, res, next) {
    try {
      const { conversationId } = req.body;
      if (!conversationId) {
        return res.status(400).json({ success: false, error: 'conversationId is required' });
      }

      if (req.user?.isGuest || !req.user?.id) {
        return res.status(401).json({ success: false, error: 'Authentication required to upload attachments' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: 'No files uploaded' });
      }

      const pool = getPool();
      const [convRows] = await pool.query(
        'SELECT user_id FROM conversations WHERE id = ?',
        [conversationId]
      );

      if (convRows.length > 0 && convRows[0].user_id !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Conversation belongs to another user' });
      }

      if (convRows.length === 0) {
        await ConversationService.createConversation({
          id: conversationId,
          userId: req.user.id,
          title: 'New Conversation',
          model: config.ai.ollamaDefaultModel || 'gemma3:4b'
        });
      }

      const attachments = [];
      for (const file of req.files) {
        const saved = await AttachmentService.saveAttachment({
          conversationId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          storagePath: file.path
        });
        attachments.push(saved);
      }

      res.status(201).json({ success: true, attachments });
    } catch (err) {
      next(err);
    }
  }

  static async getFile(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (req.user?.isGuest || !userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const attachment = await AttachmentService.getAttachmentById(id, userId);

      if (!attachment) {
        return res.status(404).json({ success: false, error: 'Attachment not found or unauthorized' });
      }

      if (!fs.existsSync(attachment.storage_path)) {
        return res.status(404).json({ success: false, error: 'File not found on server' });
      }

      res.setHeader('Content-Type', attachment.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.original_name)}"`);
      const fileStream = fs.createReadStream(attachment.storage_path);
      fileStream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAttachment(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (req.user?.isGuest || !userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const result = await AttachmentService.deleteAttachment(id, userId);
      res.json({ success: true, result });
    } catch (err) {
      if (err.message && err.message.includes('unauthorized')) {
        return res.status(403).json({ success: false, error: err.message });
      }
      next(err);
    }
  }
}

