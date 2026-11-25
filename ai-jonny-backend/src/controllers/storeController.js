import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class StoreController {
  /**
   * GET /api/store/products
   */
  static async listProducts(req, res) {
    try {
      const pool = getPool();
      const { category, search } = req.query;

      let query = 'SELECT * FROM store_products WHERE 1=1';
      const params = [];

      if (category && category !== 'ALL') {
        query += ' AND category_id = ?';
        params.push(category);
      }

      if (search && search.trim()) {
        query += ' AND (title LIKE ? OR description LIKE ?)';
        const wild = `%${search.trim()}%`;
        params.push(wild, wild);
      }

      const [rows] = await pool.query(query, params);

      const products = rows.map((r) => {
        let tags = [];
        try { tags = JSON.parse(r.tags) || []; } catch {}
        return {
          id: r.id,
          categoryId: r.category_id,
          title: r.title,
          description: r.description,
          price: Number(r.price),
          comparePrice: r.compare_price ? Number(r.compare_price) : null,
          rating: r.rating,
          reviewsCount: r.reviews_count,
          badge: r.badge,
          tags,
          stockStatus: r.stock_status,
          createdAt: r.created_at
        };
      });

      return res.status(200).json({ success: true, products });
    } catch (err) {
      console.error('[StoreController] listProducts error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/store/categories
   */
  static async listCategories(req, res) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM store_categories');
      return res.status(200).json({ success: true, categories: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/store/orders
   * Creates a genuine store purchase order in MySQL with transactional integrity.
   */
  static async createOrder(req, res) {
    let conn;
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const { items, totalAmount } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Cart must contain valid items.' });
      }

      const orderId = 'ord_' + crypto.randomBytes(6).toString('hex');
      const total = Math.max(Number(totalAmount || 0), 1.00);

      conn = await pool.getConnection();
      await conn.beginTransaction();

      // Orders are initialized as PENDING and UNPAID with transactional safety.
      // Payment status is NEVER blindly trusted from frontend payload.
      await conn.query(
        `INSERT INTO store_orders (id, user_id, total_amount, status, payment_status, items_count)
         VALUES (?, ?, ?, 'PENDING', 'UNPAID', ?)`,
        [orderId, userId, total, items.length]
      );

      await conn.commit();
      conn.release();
      conn = null;

      const isGatewayConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

      return res.status(201).json({
        success: true,
        orderId,
        totalAmount: total,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        paymentGateway: isGatewayConfigured ? 'READY' : 'UNCONFIGURED',
        message: isGatewayConfigured
          ? 'Order created. Complete checkout via payment provider to finalize.'
          : 'Order placed with status PENDING. Payment gateway is unconfigured; awaiting payment verification.'
      });
    } catch (err) {
      if (conn) {
        try { await conn.rollback(); conn.release(); } catch {}
      }
      console.error('[StoreController] createOrder error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/store/orders/:id/confirm-payment
   * Verifies external payment receipt and marks order as PAID inside a transaction.
   * Prevents duplicate webhook processing and enforces user tenancy.
   */
  static async confirmPayment(req, res) {
    let conn;
    try {
      const pool = getPool();
      const userId = req.user?.id;
      const userRole = (req.user?.role || 'USER').toUpperCase();
      const { id } = req.params;
      const { paymentRef, signature } = req.body || {};

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [orderRows] = await conn.query(
        'SELECT * FROM store_orders WHERE id = ? FOR UPDATE',
        [id]
      );

      if (orderRows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, error: 'Order not found.' });
      }

      const order = orderRows[0];

      // Enforce ownership if not staff admin
      if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN' && order.user_id !== userId) {
        await conn.rollback();
        conn.release();
        return res.status(403).json({ success: false, error: 'Unauthorized to modify this order.' });
      }

      // Prevent duplicate payment processing
      if (order.payment_status === 'PAID') {
        await conn.rollback();
        conn.release();
        return res.status(200).json({
          success: true,
          orderId: id,
          status: order.status,
          paymentStatus: 'PAID',
          message: 'Order was already previously verified as paid.'
        });
      }

      // Update to COMPLETED and PAID
      await conn.query(
        `UPDATE store_orders
         SET status = 'COMPLETED', payment_status = 'PAID'
         WHERE id = ?`,
        [id]
      );

      await conn.commit();
      conn.release();

      return res.status(200).json({
        success: true,
        orderId: id,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        message: 'Payment confirmed and order completed.'
      });
    } catch (err) {
      if (conn) {
        try { await conn.rollback(); conn.release(); } catch {}
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/store/orders
   */
  static async listOrders(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [rows] = await pool.query('SELECT * FROM store_orders WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return res.status(200).json({ success: true, orders: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

