import { getPool } from '../db/pool.js';
import crypto from 'crypto';

export class SeoController {
  /**
   * GET /api/seo/keywords
   */
  static async listKeywords(req, res) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM seo_keywords ORDER BY created_at DESC');

      const keywords = rows.map((r) => ({
        id: r.id,
        keyword: r.keyword,
        searchVolume: r.search_volume,
        difficulty: r.difficulty,
        difficultyScore: r.difficulty_score,
        cpc: r.cpc,
        intent: r.intent,
        status: r.status,
        projectId: r.project_id,
        createdAt: r.created_at
      }));

      return res.status(200).json({ success: true, keywords });
    } catch (err) {
      console.error('[SeoController] listKeywords error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/seo/keywords
   */
  static async createKeyword(req, res) {
    try {
      const pool = getPool();
      const { keyword, searchVolume, difficulty, difficultyScore, cpc, intent, status, projectId } = req.body;

      if (!keyword) {
        return res.status(400).json({ success: false, error: 'Keyword is required.' });
      }

      const id = 'kw_' + crypto.randomBytes(4).toString('hex');
      await pool.query(
        `INSERT INTO seo_keywords (id, project_id, keyword, search_volume, difficulty, difficulty_score, cpc, intent, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          projectId || null,
          keyword,
          searchVolume || '12,000/mo',
          difficulty || 'Moderate',
          difficultyScore || 50,
          cpc || '$3.50',
          intent || 'Commercial',
          status || 'Targeted'
        ]
      );

      return res.status(201).json({
        success: true,
        keyword: {
          id,
          keyword,
          searchVolume: searchVolume || '12,000/mo',
          difficulty: difficulty || 'Moderate',
          difficultyScore: difficultyScore || 50,
          cpc: cpc || '$3.50',
          intent: intent || 'Commercial',
          status: status || 'Targeted'
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/seo/keywords/:id
   */
  static async updateKeyword(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { status, searchVolume, difficulty } = req.body;

      await pool.query(
        `UPDATE seo_keywords
         SET status = COALESCE(?, status),
             search_volume = COALESCE(?, search_volume),
             difficulty = COALESCE(?, difficulty)
         WHERE id = ?`,
        [status, searchVolume, difficulty, id]
      );

      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/seo/keywords/:id
   */
  static async deleteKeyword(req, res) {
    try {
      const pool = getPool();
      const { id } = req.params;
      await pool.query('DELETE FROM seo_keywords WHERE id = ?', [id]);
      return res.status(200).json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Projects: GET /api/seo/projects & POST /api/seo/projects
   */
  static async listProjects(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const [rows] = await pool.query('SELECT * FROM seo_projects WHERE user_id = ? ORDER BY created_at DESC', [userId]);
      return res.status(200).json({ success: true, projects: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createProject(req, res) {
    try {
      const pool = getPool();
      const userId = req.user?.id || 'usr_creator';
      const { name, domain, targetCountry } = req.body;
      const id = 'seop_' + crypto.randomBytes(4).toString('hex');

      await pool.query(
        'INSERT INTO seo_projects (id, user_id, name, domain, target_country) VALUES (?, ?, ?, ?, ?)',
        [id, userId, name || 'SEO Project', domain || 'example.com', targetCountry || 'US']
      );

      return res.status(201).json({ success: true, project: { id, name, domain } });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

