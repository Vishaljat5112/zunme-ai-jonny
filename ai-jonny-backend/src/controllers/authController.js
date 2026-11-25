import { AuthService } from '../services/authService.js';
import { getPool } from '../db/pool.js';

export class AuthController {
  /**
   * POST /api/auth/register
   * Body: { name, email, password }
   */
  static async register(req, res) {
    try {
      const { name, email, password } = req.body;
      const result = await AuthService.register({ name, email, password });
      return res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        ...result
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Registration failed.'
      });
    }
  }

  /**
   * POST /api/auth/login
   * Body: { email, password }
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });
      return res.json({
        success: true,
        message: 'Logged in successfully!',
        ...result
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: err.message || 'Login failed.'
      });
    }
  }

  /**
   * GET /api/auth/me
   * Requires Authorization header. Returns current logged-in user or guest info.
   */
  static async me(req, res) {
    try {
      if (!req.user || req.user.isGuest) {
        return res.json({
          success: true,
          authenticated: false,
          user: null,
          isGuest: true
        });
      }

      const user = await AuthService.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          authenticated: false,
          error: 'User account not found.'
        });
      }

      const role = (user.plan_badge === 'Super Admin' || user.email === 'superadmin@zunme.ai')
        ? 'SUPER_ADMIN'
        : (user.plan_badge === 'Admin' || user.email === 'admin@zunme.ai')
          ? 'ADMIN'
          : 'USER';

      return res.json({
        success: true,
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role,
          avatar_initials: user.avatar_initials,
          plan_badge: user.plan_badge,
          created_at: user.created_at
        },
        isGuest: false
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/auth/persona-login
   * Authenticates predefined personas securely without exposing passwords in client code.
   */
  static async personaLogin(req, res) {
    try {
      const { persona, role } = req.body;
      const target = (persona || role || '').toString().toLowerCase();

      const personaEmailMap = {
        super_admin: 'superadmin@zunme.ai',
        'super admin': 'superadmin@zunme.ai',
        'super admin governance': 'superadmin@zunme.ai',
        admin: 'admin@zunme.ai',
        'admin operations hub': 'admin@zunme.ai',
        user: 'alex.creator@zunme.ai',
        'user ai workspace': 'alex.creator@zunme.ai',
        creator: 'alex.creator@zunme.ai',
        ads: 'ads@zunme.ai',
        'zunme ads platform': 'ads@zunme.ai',
        social: 'social@zunme.ai',
        'social & content scheduler': 'social@zunme.ai',
        business: 'business@zunme.ai',
        'business & crm hub': 'business@zunme.ai'
      };

      const email = personaEmailMap[target];
      if (!email) {
        return res.status(400).json({ success: false, error: 'Invalid persona or role identifier.' });
      }

      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Persona account not found in database.' });
      }
      const user = rows[0];

      const assignedRole = (user.plan_badge === 'Super Admin' || user.email === 'superadmin@zunme.ai')
        ? 'SUPER_ADMIN'
        : (user.plan_badge === 'Admin' || user.email === 'admin@zunme.ai')
          ? 'ADMIN'
          : 'USER';

      const token = AuthService.generateToken({
        id: user.id,
        email: user.email,
        role: assignedRole
      });

      return res.json({
        success: true,
        message: 'Authenticated persona successfully!',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: assignedRole,
          avatar_initials: user.avatar_initials,
          plan_badge: user.plan_badge,
          created_at: user.created_at
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

