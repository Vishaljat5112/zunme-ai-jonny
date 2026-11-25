import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class SocialController {
  /**
   * GET /api/social/accounts
   */
  static async listAccounts(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [rows] = await pool.query('SELECT * FROM social_accounts WHERE user_id = ?', [userId]);
      return res.status(200).json({ success: true, accounts: rows });
    } catch (err) {
      console.error('[SocialController] listAccounts error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/social/accounts/connect
   */
  static async connectAccount(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const { platform, accountHandle, avatarUrl } = req.body;

      const id = 'soc_' + crypto.randomBytes(4).toString('hex');
      await pool.query(
        `INSERT INTO social_accounts (id, user_id, platform, account_handle, avatar_url, status)
         VALUES (?, ?, ?, ?, ?, 'CONNECTED')`,
        [id, userId, platform || 'LinkedIn', accountHandle || '@creator', avatarUrl || null]
      );

      return res.status(201).json({ success: true, account: { id, platform, accountHandle } });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/social/accounts/:id
   */
  static async disconnectAccount(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      await pool.query('DELETE FROM social_accounts WHERE id = ?', [id]);
      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/social/posts & POST /api/social/posts
   */
  static async listPosts(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [rows] = await pool.query(
        'SELECT * FROM social_posts WHERE user_id = ? ORDER BY scheduled_date ASC',
        [userId]
      );
      return res.status(200).json({ success: true, posts: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createPost(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const { platform, title, content, format, scheduledDate, status } = req.body;

      if (!title || !scheduledDate) {
        return res.status(400).json({ success: false, error: 'Title and scheduledDate are required.' });
      }

      const id = 'post_' + crypto.randomBytes(4).toString('hex');
      await pool.query(
        `INSERT INTO social_posts (id, user_id, platform, title, content, format, scheduled_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, platform || 'LinkedIn', title, content || '', format || 'Post', scheduledDate, status || 'Scheduled']
      );

      return res.status(201).json({
        success: true,
        post: { id, platform, title, scheduledDate, status: status || 'Scheduled' }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async updatePost(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { title, content, status, scheduledDate } = req.body;

      await pool.query(
        `UPDATE social_posts
         SET title = COALESCE(?, title),
             content = COALESCE(?, content),
             status = COALESCE(?, status),
             scheduled_date = COALESCE(?, scheduled_date)
         WHERE id = ?`,
        [title, content, status, scheduledDate, id]
      );

      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async deletePost(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      await pool.query('DELETE FROM social_posts WHERE id = ?', [id]);
      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/social/calendar
   */
  static async getCalendar(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [rows] = await pool.query(
        'SELECT id, title, platform, scheduled_date as date, status, format FROM social_posts WHERE user_id = ? ORDER BY scheduled_date ASC',
        [userId]
      );
      return res.status(200).json({ success: true, events: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

