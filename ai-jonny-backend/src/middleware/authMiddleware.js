import { getPool } from '../db/pool.js';
import { AuthService } from '../services/authService.js';

/**
 * Authentication & Session Isolation Middleware
 * 
 * - If Bearer Token is provided: Validates user identity and sets req.user (isGuest: false).
 * - If Guest Mode (or no credentials): Sets req.user (isGuest: true).
 * - Supports legacy/test X-User-Id header for test suite backward compatibility.
 */
export async function authMiddleware(req, res, next) {
  // 1. Check Bearer Token (Registered Logged-in User)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const decoded = AuthService.verifyToken(token);

    if (decoded && decoded.id) {
      let role = decoded.role;
      if (!role) {
        if (decoded.email === 'superadmin@zunme.ai') role = 'SUPER_ADMIN';
        else if (decoded.email === 'admin@zunme.ai') role = 'ADMIN';
        else role = 'USER';
      }
      req.user = {
        id: decoded.id,
        name: decoded.name || 'User',
        email: decoded.email,
        role,
        isGuest: false
      };
      return next();
    }

    // Invalid or expired token: strictly treat as unauthenticated guest
    req.user = {
      id: 'guest',
      name: 'Guest',
      email: 'guest@workspace.local',
      role: 'USER',
      isGuest: true
    };
    return next();
  }

  // 2. Unauthenticated Visitor / Guest Mode
  // X-User-Id is strictly a device identifier for guest sessions and NEVER grants authenticated status.
  const headerUserId = req.headers['x-user-id'];
  const effectiveUserId = (headerUserId && headerUserId !== 'guest')
    ? headerUserId
    : 'user_default';

  req.user = {
    id: effectiveUserId,
    name: effectiveUserId === 'user_default' ? 'Alex Creator' : `User ${effectiveUserId.slice(-4)}`,
    email: `${effectiveUserId}@workspace.local`,
    role: 'USER',
    isGuest: true
  };

  try {
    const pool = getPool();
    await pool.query(
      `INSERT IGNORE INTO users (id, name, email, avatar_initials, plan_badge)
       VALUES (?, ?, ?, 'KU', 'Active Member')`,
      [effectiveUserId, req.user.name, req.user.email]
    );
  } catch {
    // Non-blocking
  }

  next();
}

/**
 * Require valid JWT authentication (Strictly non-guest).
 */
export function requireAuth(req, res, next) {
  if (!req.user || req.user.isGuest) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in with valid credentials.'
    });
  }
  next();
}

/**
 * Require specific role(s) for access (Authorization / RBAC).
 * Super Admin always has full access.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || req.user.isGuest) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to perform this action.'
      });
    }

    const userRole = (req.user.role || 'USER').toUpperCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

    // SUPER_ADMIN has master access to all protected resources
    if (userRole === 'SUPER_ADMIN' || normalizedAllowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Access Denied: You do not have permission to perform this action. Required role: [${allowedRoles.join(', ')}]. Current role: ${userRole}.`
    });
  };
}
