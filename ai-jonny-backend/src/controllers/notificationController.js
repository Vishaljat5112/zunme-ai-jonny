import { getPool } from '../db/pool.js';

function formatRelativeTime(dateInput) {
  if (!dateInput) return 'just now';
  const now = Date.now();
  const past = new Date(dateInput).getTime();
  if (isNaN(past)) return 'recently';
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export class NotificationController {
  /**
   * GET /api/notifications
   * Returns list of dynamic notifications tailored to the active user's identity and role.
   * Strictly isolates private notifications by user_id and allows role broadcasts only when user_id IS NULL.
   */
  static async list(req, res) {
    try {
      const pool = getPool();
      const userRole = (req.user?.role || 'USER').toUpperCase();
      const userId = req.user?.id || 'user_default';

      const [rows] = await pool.query(
        `SELECT id, user_id, role, title, message, category, priority, icon_type, is_read, created_at
         FROM notifications
         WHERE (user_id = ?)
            OR (user_id IS NULL AND (role = ? OR role = 'ALL' OR (role = 'ADMIN' AND ? = 'SUPER_ADMIN')))
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId, userRole, userRole]
      );

      const notifications = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        role: r.role,
        title: r.title,
        message: r.message,
        category: r.category || 'General',
        priority: r.priority || 'normal',
        iconType: r.icon_type || 'bell',
        isRead: Boolean(r.is_read),
        time: formatRelativeTime(r.created_at),
        createdAt: r.created_at
      }));

      const unreadCount = notifications.filter((n) => !n.isRead).length;

      return res.status(200).json({
        success: true,
        notifications,
        unreadCount
      });
    } catch (err) {
      console.error('[NotificationController] list error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/notifications
   * Create a new notification in MySQL database with validation and caller authorization.
   */
  static async create(req, res) {
    try {
      const pool = getPool();
      const userRole = (req.user?.role || 'USER').toUpperCase();
      const callerId = req.user?.id || 'user_default';

      const { title, message, category, priority, iconType, userId, role } = req.body;

      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ success: false, error: 'Notification title is required.' });
      }
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Notification message is required.' });
      }

      let targetUserId = userId || null;
      let targetRole = role || null;

      // Normal users can only emit private notifications to themselves
      if (userRole === 'USER') {
        targetUserId = callerId;
        targetRole = null;
      } else if (!targetUserId && !targetRole) {
        targetUserId = callerId;
      }

      const id = 'notif_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
      const cleanPriority = ['high', 'normal', 'low'].includes(priority) ? priority : 'normal';
      const cleanCategory = (category && typeof category === 'string') ? category.trim() : 'General';
      const cleanIcon = (iconType && typeof iconType === 'string') ? iconType.trim() : 'bell';

      await pool.query(
        `INSERT INTO notifications (id, user_id, role, title, message, category, priority, icon_type, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, NOW())`,
        [id, targetUserId, targetRole, title.trim(), message.trim(), cleanCategory, cleanPriority, cleanIcon]
      );

      return res.status(201).json({
        success: true,
        notification: {
          id,
          userId: targetUserId,
          role: targetRole,
          title: title.trim(),
          message: message.trim(),
          category: cleanCategory,
          priority: cleanPriority,
          iconType: cleanIcon,
          isRead: false,
          time: 'just now',
          createdAt: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('[NotificationController] create error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Mark a specific notification as read with ownership verification.
   */
  static async markRead(req, res) {
    try {
      const { id } = req.params;
      const userRole = (req.user?.role || 'USER').toUpperCase();
      const userId = req.user?.id || 'user_default';
      const pool = getPool();

      // Check existence and ownership
      const [rows] = await pool.query('SELECT id, user_id, role FROM notifications WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Notification not found.' });
      }

      const notif = rows[0];
      const isOwner = notif.user_id === userId;
      const isBroadcastForRole = !notif.user_id && (notif.role === userRole || notif.role === 'ALL' || (notif.role === 'ADMIN' && userRole === 'SUPER_ADMIN'));
      const isSuperAdmin = userRole === 'SUPER_ADMIN';

      if (!isOwner && !isBroadcastForRole && !isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify another user\'s notification.' });
      }

      await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id]);
      return res.status(200).json({ success: true, id, isRead: true });
    } catch (err) {
      console.error('[NotificationController] markRead error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/notifications/mark-all-read
   * Mark all notifications accessible to the active user/role as read.
   */
  static async markAllRead(req, res) {
    try {
      const pool = getPool();
      const userRole = (req.user?.role || 'USER').toUpperCase();
      const userId = req.user?.id || 'user_default';

      await pool.query(
        `UPDATE notifications 
         SET is_read = TRUE 
         WHERE (user_id = ?) 
            OR (user_id IS NULL AND (role = ? OR role = 'ALL' OR (role = 'ADMIN' AND ? = 'SUPER_ADMIN')))`,
        [userId, userRole, userRole]
      );

      return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
      console.error('[NotificationController] markAllRead error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Dismiss/delete a specific notification with ownership check.
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const userRole = (req.user?.role || 'USER').toUpperCase();
      const userId = req.user?.id || 'user_default';
      const pool = getPool();

      const [rows] = await pool.query('SELECT id, user_id, role FROM notifications WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Notification not found.' });
      }

      const notif = rows[0];
      const isOwner = notif.user_id === userId;
      const isPrivileged = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

      if (!isOwner && !(isPrivileged && !notif.user_id)) {
        return res.status(403).json({ success: false, error: 'Forbidden: Cannot delete another user\'s notification.' });
      }

      await pool.query('DELETE FROM notifications WHERE id = ?', [id]);
      return res.status(200).json({ success: true, id });
    } catch (err) {
      console.error('[NotificationController] delete error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/notifications/clear-all
   * Clear all notifications for the active user. Only SUPER_ADMIN can clear platform-wide broadcasts.
   */
  static async clearAll(req, res) {
    try {
      const pool = getPool();
      const userRole = (req.user?.role || 'USER').toUpperCase();
      const userId = req.user?.id || 'user_default';

      if (userRole === 'SUPER_ADMIN') {
        await pool.query('DELETE FROM notifications');
      } else {
        await pool.query('DELETE FROM notifications WHERE user_id = ?', [userId]);
      }

      return res.status(200).json({ success: true, message: 'Notifications cleared.' });
    } catch (err) {
      console.error('[NotificationController] clearAll error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
