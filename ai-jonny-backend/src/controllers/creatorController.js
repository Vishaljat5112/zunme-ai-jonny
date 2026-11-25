import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class CreatorController {
  /**
   * GET /api/creator/profile
   */
  static async getProfile(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';

      let [rows] = await pool.query('SELECT * FROM creator_profiles WHERE user_id = ?', [userId]);

      if (rows.length === 0) {
        // Auto-provision profile if first arrival
        const id = 'cp_' + crypto.randomBytes(6).toString('hex');
        const name = req.user?.name || 'Creator Member';
        await pool.query(
          `INSERT INTO creator_profiles (id, user_id, display_name, bio, tier_level, is_verified, total_earnings, pending_balance, followers_count)
           VALUES (?, ?, ?, 'Autonomous AI workflows & prompt engineering.', 'Tier 1', 1, 4260.00, 850.00, 1420)`,
          [id, userId, name]
        );
        [rows] = await pool.query('SELECT * FROM creator_profiles WHERE user_id = ?', [userId]);
      }

      return res.status(200).json({ success: true, profile: rows[0] });
    } catch (err) {
      console.error('[CreatorController] getProfile error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/creator/profile
   */
  static async updateProfile(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const { displayName, bio, tierLevel } = req.body;

      await pool.query(
        `UPDATE creator_profiles
         SET display_name = COALESCE(?, display_name),
             bio = COALESCE(?, bio),
             tier_level = COALESCE(?, tier_level)
         WHERE user_id = ?`,
        [displayName, bio, tierLevel, userId]
      );

      return res.status(200).json({ success: true, message: 'Profile updated.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/creator/submissions
   */
  static async listSubmissions(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [rows] = await pool.query(
        'SELECT * FROM creator_submissions WHERE creator_id = ? ORDER BY submitted_at DESC',
        [userId]
      );
      return res.status(200).json({ success: true, submissions: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/creator/submissions
   */
  static async createSubmission(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const { title, type, category } = req.body;

      if (!title || !category) {
        return res.status(400).json({ success: false, error: 'Title and category are required.' });
      }

      const id = 'sub_' + crypto.randomBytes(4).toString('hex');
      await pool.query(
        `INSERT INTO creator_submissions (id, creator_id, title, type, category, status, downloads, feedback)
         VALUES (?, ?, ?, ?, ?, 'IN_REVIEW', 0, 'Under routine moderation review by Operations.')`,
        [id, userId, title, type || 'Template', category]
      );

      return res.status(201).json({
        success: true,
        submission: {
          id,
          title,
          type: type || 'Template',
          category,
          status: 'IN_REVIEW',
          submittedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/creator/earnings
   */
  static async getEarnings(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [profRows] = await pool.query('SELECT total_earnings, pending_balance FROM creator_profiles WHERE user_id = ?', [userId]);

      const totalEarnings = profRows[0]?.total_earnings || '4260.00';
      const pendingBalance = profRows[0]?.pending_balance || '850.00';

      return res.status(200).json({
        success: true,
        earnings: {
          totalEarnings: Number(totalEarnings),
          pendingBalance: Number(pendingBalance),
          currency: 'USD',
          creatorSplitPercentage: 60,
          payoutSchedule: 'Monthly on 1st'
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/creator/payouts & POST /api/creator/payouts
   */
  static async listPayouts(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [rows] = await pool.query('SELECT * FROM creator_payouts WHERE creator_id = ? ORDER BY requested_at DESC', [userId]);
      return res.status(200).json({ success: true, payouts: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async requestPayout(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const { amount, payoutMethod } = req.body;

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: 'Valid payout amount required.' });
      }

      const id = 'po_' + crypto.randomBytes(6).toString('hex');
      await pool.query(
        `INSERT INTO creator_payouts (id, creator_id, amount, status, payout_method)
         VALUES (?, ?, ?, 'PENDING', ?)`,
        [id, userId, Number(amount), payoutMethod || 'Direct Bank / ACH']
      );

      return res.status(201).json({
        success: true,
        payoutId: id,
        message: 'Payout request dispatched. Status: PENDING review by operations.'
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin Endpoints: /api/admin/creator/submissions
   */
  static async adminListSubmissions(req, res) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM creator_submissions ORDER BY submitted_at DESC');
      return res.status(200).json({ success: true, submissions: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async adminReviewSubmission(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { status, feedback } = req.body;

      await pool.query(
        `UPDATE creator_submissions
         SET status = COALESCE(?, status),
             feedback = COALESCE(?, feedback)
         WHERE id = ?`,
        [status, feedback, id]
      );

      return res.status(200).json({ success: true, id, status });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

