import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class AdsController {
  /**
   * GET /api/ads/campaigns
   */
  static async listCampaigns(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [rows] = await pool.query(
        'SELECT * FROM ad_campaigns WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return res.status(200).json({ success: true, campaigns: rows });
    } catch (err) {
      console.error('[AdsController] listCampaigns error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/ads/campaigns
   */
  static async createCampaign(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const { name, objective, budgetAmount, budgetType, startDate } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: 'Campaign name is required.' });
      }

      const id = 'adcamp_' + crypto.randomBytes(4).toString('hex');
      await pool.query(
        `INSERT INTO ad_campaigns (id, user_id, name, objective, status, budget_amount, budget_type, start_date)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
        [id, userId, name, objective || 'Lead Generation', Number(budgetAmount || 500), budgetType || 'DAILY', startDate || '2026-11-01']
      );

      return res.status(201).json({
        success: true,
        campaign: { id, name, objective: objective || 'Lead Generation', status: 'ACTIVE', budgetAmount }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/ads/campaigns/:id
   */
  static async getCampaign(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const [rows] = await pool.query('SELECT * FROM ad_campaigns WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Campaign not found.' });
      }
      const [creatives] = await pool.query('SELECT * FROM ad_creatives WHERE campaign_id = ?', [id]);
      return res.status(200).json({ success: true, campaign: rows[0], creatives });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/ads/campaigns/:id
   */
  static async updateCampaign(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { name, status, budgetAmount } = req.body;

      await pool.query(
        `UPDATE ad_campaigns
         SET name = COALESCE(?, name),
             status = COALESCE(?, status),
             budget_amount = COALESCE(?, budget_amount)
         WHERE id = ?`,
        [name, status, budgetAmount, id]
      );

      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/ads/campaigns/:id
   */
  static async deleteCampaign(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      await pool.query('DELETE FROM ad_campaigns WHERE id = ?', [id]);
      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

