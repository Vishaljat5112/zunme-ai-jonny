import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class SupportController {
  /**
   * GET /api/support/tickets
   */
  static async listUserTickets(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [rows] = await pool.query(
        'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return res.status(200).json({ success: true, tickets: rows });
    } catch (err) {
      console.error('[SupportController] listUserTickets error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/support/tickets
   */
  static async createTicket(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const userEmail = req.user?.email || 'creator@zunme.ai';
      const userName = req.user?.name || 'Creator User';
      const { subject, category, message, priority } = req.body;

      if (!subject || !message) {
        return res.status(400).json({ success: false, error: 'Subject and message are required.' });
      }

      const id = 'tkt_' + crypto.randomBytes(4).toString('hex');
      await pool.query(
        `INSERT INTO support_tickets (id, user_id, user_email, user_name, subject, category, status, priority, message)
         VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
        [id, userId, userEmail, userName, subject, category || 'Technical', priority || 'Medium', message]
      );

      return res.status(201).json({
        success: true,
        ticket: {
          id,
          subject,
          category: category || 'Technical',
          status: 'OPEN',
          priority: priority || 'Medium',
          createdAt: new Date().toISOString()
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/support/tickets/:id
   */
  static async getTicket(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const [tRows] = await pool.query('SELECT * FROM support_tickets WHERE id = ?', [id]);
      if (tRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Ticket not found.' });
      }

      const [mRows] = await pool.query('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC', [id]);

      return res.status(200).json({
        success: true,
        ticket: tRows[0],
        messages: mRows
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/support/tickets/:id/messages
   */
  static async addMessage(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { message } = req.body;
      const senderId = req.user?.id || 'usr_creator';
      const senderRole = req.user?.role || 'USER';

      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
      }

      const msgId = 'tmsg_' + crypto.randomBytes(6).toString('hex');
      await pool.query(
        `INSERT INTO support_messages (id, ticket_id, sender_id, sender_role, message)
         VALUES (?, ?, ?, ?, ?)`,
        [msgId, id, senderId, senderRole, message.trim()]
      );

      // If sender is admin, update status to IN_PROGRESS
      if (senderRole === 'ADMIN' || senderRole === 'SUPER_ADMIN') {
        await pool.query("UPDATE support_tickets SET status = 'IN_PROGRESS' WHERE id = ?", [id]);
      }

      return res.status(201).json({ success: true, messageId: msgId });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin Endpoints: /api/admin/support/tickets
   */
  static async adminListTickets(req, res) {
    try {
      const pool = getPool();
      const { status, category, search } = req.query;

      let query = 'SELECT * FROM support_tickets WHERE 1=1';
      const params = [];

      if (status && status !== 'ALL') {
        query += ' AND status = ?';
        params.push(status);
      }

      if (category && category !== 'ALL') {
        query += ' AND category = ?';
        params.push(category);
      }

      if (search && search.trim()) {
        query += ' AND (subject LIKE ? OR message LIKE ? OR user_email LIKE ? OR user_name LIKE ?)';
        const wild = `%${search.trim()}%`;
        params.push(wild, wild, wild, wild);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await pool.query(query, params);
      return res.status(200).json({ success: true, tickets: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async adminUpdateTicket(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { status, priority } = req.body;

      await pool.query(
        `UPDATE support_tickets
         SET status = COALESCE(?, status),
             priority = COALESCE(?, priority)
         WHERE id = ?`,
        [status, priority, id]
      );

      return res.status(200).json({ success: true, id, status, priority });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

