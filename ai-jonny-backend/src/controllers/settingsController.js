import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class SettingsController {
  /**
   * GET /api/admin/settings
   * Returns all platform configuration key-values.
   */
  static async getSettings(req, res) {
    try {
      const pool = getPool();
      const [rows] = await pool.query(
        'SELECT id, setting_key, setting_value, category, updated_by, updated_at FROM platform_settings'
      );

      const settingsMap = {};
      for (const r of rows) {
        let val = r.setting_value;
        try {
          val = JSON.parse(r.setting_value);
        } catch {}
        settingsMap[r.setting_key] = val;
      }

      return res.status(200).json({
        success: true,
        settings: settingsMap,
        raw: rows
      });
    } catch (err) {
      console.error('[SettingsController] getSettings error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/admin/settings
   * Updates multiple global platform settings and creates an audit trail.
   */
  static async updateSettings(req, res) {
    try {
      const pool = getPool();
      const updates = req.body || {};
      const actorName = req.user?.name || 'SuperAdmin';
      const actorRole = req.user?.role || 'SUPER_ADMIN';

      for (const [key, val] of Object.entries(updates)) {
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        const id = 'set_' + crypto.randomBytes(6).toString('hex');

        await pool.query(
          `INSERT INTO platform_settings (id, setting_key, setting_value, updated_by)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
          [id, key, strVal, actorName]
        );
      }

      // Log audit
      const auditId = 'audit_' + crypto.randomBytes(6).toString('hex');
      await pool.query(
        `INSERT INTO settings_audit_logs (id, actor, role, action, resource, ip_address, status)
         VALUES (?, ?, ?, 'SETTINGS_BATCH_UPDATE', ?, ?, 'SUCCESS')`,
        [
          auditId,
          actorName,
          actorRole,
          `Updated keys: ${Object.keys(updates).join(', ')}`,
          req.ip || '127.0.0.1'
        ]
      );

      return res.status(200).json({
        success: true,
        message: 'Platform configuration updated successfully.',
        updatedKeys: Object.keys(updates)
      });
    } catch (err) {
      console.error('[SettingsController] updateSettings error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/admin/settings/:key
   */
  static async getSettingByKey(req, res) {
    try {
      const pool = getPool();
      const { key } = req.params;
      const [rows] = await pool.query(
        'SELECT setting_value FROM platform_settings WHERE setting_key = ?',
        [key]
      );
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: `Setting '${key}' not found.` });
      }
      let val = rows[0].setting_value;
      try { val = JSON.parse(val); } catch {}
      return res.status(200).json({ success: true, key, value: val });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

