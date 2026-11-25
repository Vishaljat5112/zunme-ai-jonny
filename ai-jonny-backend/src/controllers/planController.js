import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class PlanController {
  /**
   * GET /api/admin/plans (also public / authenticated for user checkout)
   */
  static async listPlans(req, res) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM pricing_plans ORDER BY active_subscribers DESC');

      const plans = rows.map((r) => {
        let features = [];
        try { features = JSON.parse(r.features) || []; } catch {}
        return {
          id: r.id,
          name: r.name,
          price: r.price,
          billingPeriod: r.billing_period,
          description: r.description,
          features,
          badge: r.badge,
          isCurrent: Boolean(r.is_current),
          activeSubscribers: r.active_subscribers || 0
        };
      });

      return res.status(200).json({ success: true, plans });
    } catch (err) {
      console.error('[PlanController] listPlans error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/admin/plans
   */
  static async createPlan(req, res) {
    try {
      const pool = getPool();
      const { id, name, price, billingPeriod, description, features, badge } = req.body;
      const planId = id || 'plan_' + crypto.randomBytes(4).toString('hex');
      const featStr = JSON.stringify(features || []);

      await pool.query(
        `INSERT INTO pricing_plans (id, name, price, billing_period, description, features, badge, is_current, active_subscribers)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [planId, name, price, billingPeriod || 'per month', description || '', featStr, badge || null]
      );

      return res.status(201).json({ success: true, planId });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/admin/plans/:id
   */
  static async updatePlan(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { name, price, billingPeriod, description, features, badge, isCurrent, activeSubscribers } = req.body;
      const featStr = features ? JSON.stringify(features) : null;

      await pool.query(
        `UPDATE pricing_plans
         SET name = COALESCE(?, name),
             price = COALESCE(?, price),
             billing_period = COALESCE(?, billing_period),
             description = COALESCE(?, description),
             features = COALESCE(?, features),
             badge = COALESCE(?, badge),
             is_current = COALESCE(?, is_current),
             active_subscribers = COALESCE(?, active_subscribers)
         WHERE id = ?`,
        [name, price, billingPeriod, description, featStr, badge, isCurrent !== undefined ? (isCurrent ? 1 : 0) : null, activeSubscribers, id]
      );

      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/admin/plans/:id
   */
  static async deletePlan(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      await pool.query('DELETE FROM pricing_plans WHERE id = ?', [id]);
      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/subscriptions/me
   * Returns current user's active plan subscription and entitlements.
   */
  static async getMySubscription(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';

      const [userRows] = await pool.query('SELECT plan_badge FROM users WHERE id = ?', [userId]);
      const planBadge = userRows[0]?.plan_badge || 'Active Member';

      const [subRows] = await pool.query(
        `SELECT us.*, p.name as plan_name, p.price, p.billing_period, p.features
         FROM user_subscriptions us
         JOIN pricing_plans p ON us.plan_id = p.id
         WHERE us.user_id = ? AND us.status = 'ACTIVE'
         ORDER BY us.started_at DESC LIMIT 1`,
        [userId]
      );

      let sub = subRows[0] || null;
      if (sub && sub.features) {
        try { sub.features = JSON.parse(sub.features); } catch {}
      }

      return res.status(200).json({
        success: true,
        planBadge,
        subscription: sub || {
          plan_name: planBadge,
          price: '$29',
          billing_period: 'per month',
          status: 'ACTIVE'
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/admin/users/:id/assign-plan
   */
  static async assignPlan(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { planId, planName } = req.body;

      await pool.query('UPDATE users SET plan_badge = ? WHERE id = ?', [planName || 'Pro Member', id]);

      const subId = 'sub_' + crypto.randomBytes(6).toString('hex');
      await pool.query(
        `INSERT INTO user_subscriptions (id, user_id, plan_id, status)
         VALUES (?, ?, ?, 'ACTIVE')`,
        [subId, id, planId || 'plan_pro']
      );

      return res.status(200).json({ success: true, userId: id, planBadge: planName });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

