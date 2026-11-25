import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class WarehouseController {
  /**
   * GET /api/warehouse/templates
   * Lists approved templates (or all if admin).
   */
  static async listTemplates(req, res) {
    try {
      const pool = getPool();
      const userRole = (req.user?.role || 'USER').toUpperCase();
      const { category, search, includeAll } = req.query;

      let query = 'SELECT * FROM warehouse_templates WHERE 1=1';
      const params = [];

      if (!includeAll && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        query += " AND moderation_status = 'APPROVED'";
      }

      if (category && category !== 'ALL') {
        query += ' AND category = ?';
        params.push(category);
      }

      if (search && search.trim()) {
        query += ' AND (title LIKE ? OR description LIKE ? OR creator_name LIKE ? OR tags LIKE ?)';
        const wild = `%${search.trim()}%`;
        params.push(wild, wild, wild, wild);
      }

      query += ' ORDER BY downloads DESC, rating DESC';

      const [rows] = await pool.query(query, params);

      const templates = rows.map((r) => {
        let tags = [];
        try { tags = JSON.parse(r.tags) || []; } catch {}
        return {
          id: r.id,
          title: r.title,
          description: r.description,
          category: r.category,
          creatorName: r.creator_name,
          creatorId: r.creator_id,
          isVerifiedCreator: Boolean(r.is_verified_creator),
          tags,
          licensing: r.licensing,
          downloads: r.downloads,
          likes: r.likes,
          format: r.format,
          rating: r.rating,
          moderationStatus: r.moderation_status,
          isSaved: Boolean(r.is_saved),
          createdAt: r.created_at
        };
      });

      return res.status(200).json({ success: true, templates, count: templates.length });
    } catch (err) {
      console.error('[WarehouseController] listTemplates error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/warehouse/templates/:id
   */
  static async getTemplate(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const [rows] = await pool.query('SELECT * FROM warehouse_templates WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Template not found.' });
      }

      const r = rows[0];
      let tags = [];
      try { tags = JSON.parse(r.tags); } catch {}

      return res.status(200).json({
        success: true,
        template: {
          ...r,
          tags,
          isVerifiedCreator: Boolean(r.is_verified_creator),
          isSaved: Boolean(r.is_saved)
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/warehouse/templates
   */
  static async createTemplate(req, res) {
    try {
      const pool = getPool();
      const { title, description, category, licensing, format, tags } = req.body;
      const creatorName = req.user?.name || 'Creator';
      const creatorId = req.user?.id || null;
      const id = 'asset_' + crypto.randomBytes(4).toString('hex');

      await pool.query(
        `INSERT INTO warehouse_templates (id, title, description, category, creator_name, creator_id, is_verified_creator, tags, licensing, format, moderation_status)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'PENDING')`,
        [id, title, description, category || 'Templates', creatorName, creatorId, JSON.stringify(tags || []), licensing || 'Commercial Pro', format || 'Structured Prompt']
      );

      return res.status(201).json({ success: true, id, message: 'Template submitted for moderation.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/warehouse/templates/:id
   */
  static async updateTemplate(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { title, description, category, moderationStatus, isSaved, likes, downloads } = req.body;

      await pool.query(
        `UPDATE warehouse_templates
         SET title = COALESCE(?, title),
             description = COALESCE(?, description),
             category = COALESCE(?, category),
             moderation_status = COALESCE(?, moderation_status),
             is_saved = COALESCE(?, is_saved),
             likes = COALESCE(?, likes),
             downloads = COALESCE(?, downloads)
         WHERE id = ?`,
        [title, description, category, moderationStatus, isSaved !== undefined ? (isSaved ? 1 : 0) : null, likes, downloads, id]
      );

      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/warehouse/templates/:id
   */
  static async deleteTemplate(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      await pool.query('DELETE FROM warehouse_templates WHERE id = ?', [id]);
      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/warehouse/templates/:id/deploy
   * Executes genuine template deployment into user's active workspace.
   */
  static async deployTemplate(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const userId = req.user?.id || 'usr_creator';
      const { targetEnvironment } = req.body;

      // 1. Verify template exists
      const [tRows] = await pool.query('SELECT * FROM warehouse_templates WHERE id = ?', [id]);
      if (tRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Template not found.' });
      }

      // 2. Increment download count in DB
      await pool.query('UPDATE warehouse_templates SET downloads = downloads + 1 WHERE id = ?', [id]);

      // 3. Record deployment
      const depId = 'dep_' + crypto.randomBytes(6).toString('hex');
      await pool.query(
        `INSERT INTO user_template_deployments (id, user_id, template_id, target_environment, deployment_status)
         VALUES (?, ?, ?, ?, 'ACTIVE')`,
        [depId, userId, id, targetEnvironment || 'workspace']
      );

      return res.status(200).json({
        success: true,
        deploymentId: depId,
        templateTitle: tRows[0].title,
        message: `Successfully deployed "${tRows[0].title}" to your active workspace.`
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/warehouse/deployments
   */
  static async listDeployments(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [rows] = await pool.query(
        `SELECT d.*, t.title as template_title, t.category, t.format
         FROM user_template_deployments d
         JOIN warehouse_templates t ON d.template_id = t.id
         WHERE d.user_id = ?
         ORDER BY d.deployed_at DESC`,
        [userId]
      );
      return res.status(200).json({ success: true, deployments: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/warehouse/categories
   */
  static async listCategories(req, res) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM warehouse_categories ORDER BY display_order ASC');
      return res.status(200).json({ success: true, categories: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

