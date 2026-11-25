import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class MerchantController {
  /**
   * GET /api/merchant/profile
   * Returns current user's merchant store profile and sales overview.
   */
  static async getProfile(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';

      let [rows] = await pool.query('SELECT * FROM merchant_profiles WHERE user_id = ?', [userId]);

      if (rows.length === 0) {
        // Create initial merchant profile
        const id = 'mer_' + crypto.randomBytes(6).toString('hex');
        await pool.query(
          `INSERT INTO merchant_profiles (id, user_id, store_name, payout_account, status)
           VALUES (?, ?, ?, ?, 'ACTIVE')`,
          [id, userId, 'Zunme Merchant Store', 'Direct ACH / Stripe Connect']
        );
        [rows] = await pool.query('SELECT * FROM merchant_profiles WHERE id = ?', [id]);
      }

      const p = rows[0];

      // Aggregate transactions for revenue
      let revenue = 0;
      let balance = 0;
      try {
        const [txRows] = await pool.query(
          'SELECT SUM(amount) as gross, SUM(net_amount) as bal FROM merchant_transactions WHERE merchant_id = ?',
          [p.id]
        );
        revenue = Number(txRows[0]?.gross || 0);
        balance = Number(txRows[0]?.bal || 0);
      } catch {}

      return res.status(200).json({
        success: true,
        profile: {
          id: p.id,
          userId: p.user_id,
          storeName: p.store_name,
          payoutAccount: p.payout_account,
          status: p.status,
          grossRevenue: revenue,
          balance: balance,
          createdAt: p.created_at
        }
      });
    } catch (err) {
      console.error('[MerchantController] getProfile error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/merchant/profile
   */
  static async updateProfile(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const { storeName, payoutAccount } = req.body;

      await pool.query(
        'UPDATE merchant_profiles SET store_name = COALESCE(?, store_name), payout_account = COALESCE(?, payout_account) WHERE user_id = ?',
        [storeName, payoutAccount, userId]
      );

      return res.status(200).json({ success: true, message: 'Merchant profile updated.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/merchant/transactions
   */
  static async listTransactions(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';

      // Find merchant id
      const [mRows] = await pool.query('SELECT id FROM merchant_profiles WHERE user_id = ?', [userId]);
      const merchantId = mRows[0]?.id;

      if (!merchantId) {
        return res.status(200).json({ success: true, transactions: [] });
      }

      const [txRows] = await pool.query(
        'SELECT * FROM merchant_transactions WHERE merchant_id = ? ORDER BY created_at DESC',
        [merchantId]
      );

      return res.status(200).json({ success: true, transactions: txRows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
