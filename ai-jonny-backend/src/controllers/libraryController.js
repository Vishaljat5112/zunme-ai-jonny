import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class LibraryController {
  /**
   * GET /api/library
   * Returns all saved library items for the authenticated user.
   */
  static async listItems(req, res) {
    try {
      const pool = getPool();
      if (req.user?.isGuest || !req.user?.id) {
        return res.status(200).json({ success: true, items: [], count: 0 });
      }
      const userId = req.user.id;
      const { category, search } = req.query;

      let query = `
        SELECT id, user_id, folder_id, title, content_type, content, preview_text, source_metadata, tags, created_at, updated_at
        FROM library_items
        WHERE user_id = ?
      `;
      const params = [userId];

      if (category && category !== 'ALL') {
        query += ' AND content_type = ?';
        params.push(category);
      }

      if (search && search.trim()) {
        query += ' AND (title LIKE ? OR preview_text LIKE ? OR content LIKE ?)';
        const wild = `%${search.trim()}%`;
        params.push(wild, wild, wild);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await pool.query(query, params);

      const items = rows.map((r) => {
        let sourceMetadata = null;
        let tags = [];
        try { sourceMetadata = JSON.parse(r.source_metadata); } catch {}
        try { tags = JSON.parse(r.tags) || []; } catch {}

        return {
          id: r.id,
          title: r.title,
          contentType: r.content_type,
          content: r.content,
          previewText: r.preview_text,
          folderId: r.folder_id,
          sourceMetadata,
          tags,
          createdAt: r.created_at
        };
      });

      return res.status(200).json({ success: true, items, count: items.length });
    } catch (err) {
      console.error('[LibraryController] listItems error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/library/:id
   */
  static async getItem(req, res) {
    try {
      const pool = getPool();
      if (req.user?.isGuest || !req.user?.id) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const userId = req.user.id;
      const { id } = req.params;

      const [rows] = await pool.query(
        'SELECT * FROM library_items WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Library item not found.' });
      }

      const r = rows[0];
      let sourceMetadata = null;
      let tags = [];
      try { sourceMetadata = JSON.parse(r.source_metadata); } catch {}
      try { tags = JSON.parse(r.tags); } catch {}

      return res.status(200).json({
        success: true,
        item: {
          id: r.id,
          title: r.title,
          contentType: r.content_type,
          content: r.content,
          previewText: r.preview_text,
          sourceMetadata,
          tags,
          createdAt: r.created_at
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/library
   * Saves content into user's cloud library.
   */
  static async createItem(req, res) {
    try {
      const pool = getPool();
      if (req.user?.isGuest || !req.user?.id) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const userId = req.user.id;
      const { title, contentType, content, previewText, sourceMetadata, tags, folderId } = req.body;

      if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required.' });
      }

      // Validate JSON structure and check module availability for chart assets
      if (contentType === 'CHART') {
        const [sett] = await pool.query(
          "SELECT setting_value FROM platform_settings WHERE setting_key = 'charts_module_enabled'"
        );
        if (sett.length > 0 && sett[0].setting_value === 'false') {
          const userRole = req.user?.role;
          if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
            return res.status(403).json({
              success: false,
              error: 'EgoLytics BFOV Charts module is currently disabled by administrator.'
            });
          }
        }

        try {
          const parsed = typeof content === 'string' ? JSON.parse(content) : content;
          if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
            return res.status(400).json({ success: false, error: 'Malformed chart JSON: nodes and edges arrays are required.' });
          }
        } catch {
          return res.status(400).json({ success: false, error: 'Invalid JSON format for chart specification.' });
        }
      }

      const id = 'lib_' + crypto.randomBytes(6).toString('hex');
      const safePreview = previewText || content.slice(0, 160) + '...';
      const metaStr = sourceMetadata ? JSON.stringify(sourceMetadata) : null;
      const tagsStr = tags ? JSON.stringify(tags) : '[]';

      await pool.query(
        `INSERT INTO library_items (id, user_id, folder_id, title, content_type, content, preview_text, source_metadata, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, folderId || null, title, contentType || 'TEXT', content, safePreview, metaStr, tagsStr]
      );

      return res.status(201).json({
        success: true,
        item: {
          id,
          title,
          contentType: contentType || 'TEXT',
          content,
          previewText: safePreview,
          createdAt: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('[LibraryController] createItem error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/library/:id
   */
  static async updateItem(req, res) {
    try {
      const pool = getPool();
      if (req.user?.isGuest || !req.user?.id) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const userId = req.user.id;
      const { id } = req.params;
      const { title, content, previewText, folderId, sourceMetadata, tags } = req.body;

      // Check existing item and verify chart module availability
      const [existing] = await pool.query('SELECT * FROM library_items WHERE id = ? AND user_id = ?', [id, userId]);
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: 'Library item not found or unauthorized.' });
      }

      if (existing[0].content_type === 'CHART') {
        const [sett] = await pool.query(
          "SELECT setting_value FROM platform_settings WHERE setting_key = 'charts_module_enabled'"
        );
        if (sett.length > 0 && sett[0].setting_value === 'false') {
          const userRole = req.user?.role;
          if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
            return res.status(403).json({
              success: false,
              error: 'EgoLytics BFOV Charts module is currently disabled by administrator.'
            });
          }
        }
      }

      // Validate chart JSON if content is provided
      if (content) {
        try {
          const parsed = typeof content === 'string' ? JSON.parse(content) : content;
          if (parsed && typeof parsed === 'object') {
            if (parsed.nodes && !Array.isArray(parsed.nodes)) {
              return res.status(400).json({ success: false, error: 'Malformed chart JSON: nodes must be an array.' });
            }
            if (parsed.edges && !Array.isArray(parsed.edges)) {
              return res.status(400).json({ success: false, error: 'Malformed chart JSON: edges must be an array.' });
            }
          }
        } catch {
          return res.status(400).json({ success: false, error: 'Invalid JSON format for chart specification.' });
        }
      }

      const metaStr = sourceMetadata !== undefined ? (sourceMetadata ? JSON.stringify(sourceMetadata) : null) : null;
      const tagsStr = tags !== undefined ? (tags ? JSON.stringify(tags) : '[]') : null;

      const [result] = await pool.query(
        `UPDATE library_items 
         SET title = COALESCE(?, title),
             content = COALESCE(?, content),
             preview_text = COALESCE(?, preview_text),
             folder_id = COALESCE(?, folder_id),
             source_metadata = CASE WHEN ? IS NOT NULL THEN ? ELSE source_metadata END,
             tags = CASE WHEN ? IS NOT NULL THEN ? ELSE tags END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [
          title || null,
          content || null,
          previewText || null,
          folderId || null,
          metaStr, metaStr,
          tagsStr, tagsStr,
          id,
          userId
        ]
      );

      if (result.matchedRows === 0) {
        return res.status(404).json({ success: false, error: 'Library item not found or unauthorized.' });
      }

      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/library/:id
   */
  static async deleteItem(req, res) {
    try {
      const pool = getPool();
      if (req.user?.isGuest || !req.user?.id) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const userId = req.user.id;
      const { id } = req.params;

      const [result] = await pool.query('DELETE FROM library_items WHERE id = ? AND user_id = ?', [id, userId]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Library item not found or unauthorized.' });
      }
      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Folders endpoints
   */
  static async listFolders(req, res) {
    try {
      const pool = getPool();
      if (req.user?.isGuest || !req.user?.id) {
        return res.status(200).json({ success: true, folders: [] });
      }
      const userId = req.user.id;
      const [rows] = await pool.query('SELECT * FROM library_folders WHERE user_id = ? ORDER BY name ASC', [userId]);
      return res.status(200).json({ success: true, folders: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createFolder(req, res) {
    try {
      const pool = getPool();
      if (req.user?.isGuest || !req.user?.id) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const userId = req.user.id;
      const { name, color } = req.body;
      const id = 'fld_' + crypto.randomBytes(6).toString('hex');
      await pool.query(
        'INSERT INTO library_folders (id, user_id, name, color) VALUES (?, ?, ?, ?)',
        [id, userId, name || 'New Folder', color || '#6E56CF']
      );
      return res.status(201).json({ success: true, folder: { id, name, color } });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

