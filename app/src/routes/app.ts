import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { query } from '../db/client';
import { 
  listIdentities,
  getEmailFromIdentity, 
  getNameFromIdentity,
  getPictureFromIdentity
} from '../services/kratos';
import { config } from '../config';

const router = Router();

interface UserRole {
  identity_id: string;
  role: 'admin' | 'user';
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /app
 * Main application entry point
 * Routes to appropriate view based on user's role
 */
router.get('/', requireAuth, async (req, res) => {
  if (!req.identity) {
    return res.redirect(`${config.kratosUiUrl}/login`);
  }

  const identity = req.identity;
  const userRole = req.userRole;

  // Prepare common user data
  const userData = {
    id: identity.id,
    email: getEmailFromIdentity(identity),
    name: getNameFromIdentity(identity),
    picture: getPictureFromIdentity(identity),
    role: userRole,
    kratosUiUrl: config.kratosUiUrl,
  };

  // Route based on role
  if (!userRole) {
    // No role assigned - show pending page
    return res.render('pending', { user: userData });
  }

  if (userRole === 'admin') {
    // Admin - show admin dashboard with user list
    try {
      const identities = await listIdentities();
      const roles = await query<UserRole>('SELECT * FROM user_roles');
      const roleMap = new Map(roles.map(r => [r.identity_id, r]));

      const users = identities.map(id => ({
        id: id.id,
        email: getEmailFromIdentity(id),
        name: getNameFromIdentity(id),
        picture: getPictureFromIdentity(id),
        role: roleMap.get(id.id)?.role || null,
        isPending: !roleMap.has(id.id),
        createdAt: id.created_at,
      }));

      return res.render('admin', { 
        user: userData, 
        users,
        stats: {
          total: users.length,
          admins: users.filter(u => u.role === 'admin').length,
          users: users.filter(u => u.role === 'user').length,
          pending: users.filter(u => u.isPending).length,
        }
      });
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      return res.render('admin', { user: userData, users: [], stats: { total: 0, admins: 0, users: 0, pending: 0 }, error: 'Failed to load user list' });
    }
  }

  // Regular user - show user dashboard
  return res.render('dashboard', { user: userData });
});

/**
 * GET /app/settings
 * Redirect to Kratos settings
 */
router.get('/settings', requireAuth, (req, res) => {
  res.redirect(`${config.kratosUiUrl}/settings`);
});

/**
 * GET /logout
 * Redirect to Kratos logout
 */
router.get('/logout', (req, res) => {
  res.redirect(`${config.kratosBrowserUrl}/self-service/logout/browser`);
});

export default router;
