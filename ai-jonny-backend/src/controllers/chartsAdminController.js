import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class ChartsAdminController {
  /**
   * Helper to check if charts module is globally enabled.
   */
  static async isModuleEnabled() {
    try {
      const pool = getPool();
      const [rows] = await pool.query(
        'SELECT setting_value FROM platform_settings WHERE setting_key = ?',
        ['charts_module_enabled']
      );
      if (rows.length === 0) return true;
      return rows[0].setting_value !== 'false';
    } catch {
      return true;
    }
  }

  /**
   * GET /api/charts/status
   * Returns current module availability status.
   */
  static async getStatus(req, res) {
    try {
      const enabled = await ChartsAdminController.isModuleEnabled();
      return res.status(200).json({
        success: true,
        enabled,
        module: 'EgoLytics BFOV Charts'
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/admin/charts/stats
   * Returns real MySQL database metrics for all saved charts.
   */
  static async getStats(req, res) {
    try {
      const pool = getPool();

      // Aggregate counts from library_items
      const [aggRows] = await pool.query(`
        SELECT 
          COUNT(*) as totalCharts,
          COUNT(DISTINCT user_id) as uniqueCreators,
          MAX(created_at) as lastCreatedAt
        FROM library_items
        WHERE content_type = 'CHART'
      `);

      // Recent 10 charts
      const [recentRows] = await pool.query(`
        SELECT id, user_id, title, preview_text, source_metadata, tags, created_at, updated_at
        FROM library_items
        WHERE content_type = 'CHART'
        ORDER BY created_at DESC
        LIMIT 10
      `);

      const recentCharts = recentRows.map((r) => {
        let meta = null;
        let tags = [];
        try { meta = JSON.parse(r.source_metadata); } catch {}
        try { tags = JSON.parse(r.tags) || []; } catch {}
        return {
          id: r.id,
          userId: r.user_id,
          title: r.title,
          previewText: r.preview_text,
          diagramMode: meta?.diagramMode || 'flowchart',
          nodeCount: meta?.nodeCount || 0,
          edgeCount: meta?.edgeCount || 0,
          tags,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        };
      });

      const totalCharts = Number(aggRows[0]?.totalCharts || 0);
      const uniqueCreators = Number(aggRows[0]?.uniqueCreators || 0);
      const lastCreatedAt = aggRows[0]?.lastCreatedAt || null;

      // Mode breakdown
      const modeBreakdown = {
        flowchart: 0,
        orgchart: 0,
        mindmap: 0,
        architecture: 0,
        other: 0
      };

      recentCharts.forEach((c) => {
        const mode = (c.diagramMode || '').toLowerCase();
        if (mode.includes('org')) modeBreakdown.orgchart++;
        else if (mode.includes('flow')) modeBreakdown.flowchart++;
        else if (mode.includes('mind')) modeBreakdown.mindmap++;
        else if (mode.includes('arch')) modeBreakdown.architecture++;
        else modeBreakdown.other++;
      });

      return res.status(200).json({
        success: true,
        stats: {
          totalCharts,
          uniqueCreators,
          lastCreatedAt,
          modeBreakdown,
          recentCharts
        }
      });
    } catch (err) {
      console.error('[ChartsAdminController] getStats error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/admin/charts/settings
   * Returns current charts module settings.
   */
  static async getSettings(req, res) {
    try {
      const enabled = await ChartsAdminController.isModuleEnabled();
      return res.status(200).json({
        success: true,
        settings: {
          chartsEnabled: enabled
        }
      });
    } catch (err) {
      console.error('[ChartsAdminController] getSettings error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/admin/charts/settings
   * Updates charts module availability and audits the change.
   */
  static async updateSettings(req, res) {
    try {
      const pool = getPool();
      const { chartsEnabled } = req.body;

      if (typeof chartsEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'chartsEnabled boolean field is required'
        });
      }

      const strVal = chartsEnabled ? 'true' : 'false';
      const actorName = req.user?.fullName || req.user?.email || 'Admin';
      const id = 'set_charts_' + crypto.randomBytes(4).toString('hex');

      await pool.query(
        `INSERT INTO platform_settings (id, setting_key, setting_value, category, updated_by)
         VALUES (?, 'charts_module_enabled', ?, 'modules', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [id, strVal, actorName]
      );

      // Audit entry if settings_audit_logs exists
      try {
        const auditId = 'audit_' + crypto.randomBytes(6).toString('hex');
        await pool.query(
          `INSERT INTO settings_audit_logs (id, actor, role, action, resource, ip_address, status)
           VALUES (?, ?, ?, 'CHARTS_MODULE_TOGGLE', ?, ?, 'SUCCESS')`,
          [
            auditId,
            actorName,
            req.user?.role || 'ADMIN',
            `Set charts_module_enabled to ${strVal}`,
            req.ip || '127.0.0.1'
          ]
        );
      } catch {}

      return res.status(200).json({
        success: true,
        message: `EgoLytics BFOV Charts module is now ${chartsEnabled ? 'ENABLED' : 'DISABLED'}.`,
        settings: {
          chartsEnabled
        }
      });
    } catch (err) {
      console.error('[ChartsAdminController] updateSettings error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
