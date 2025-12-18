import { Router } from 'express';
import { requireAuthApi } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireRole';
import { query, queryOne } from '../db/client';
import { 
  listIdentities, 
  getIdentity,
  getEmailFromIdentity, 
  getNameFromIdentity,
  getPictureFromIdentity
} from '../services/kratos';

const router = Router();

interface UserRole {
  identity_id: string;
  role: 'admin' | 'user';
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /admin/users
 * List all users with their roles
 */
router.get('/users', requireAuthApi, requireAdmin, async (req, res) => {
  try {
    // Get all identities from Kratos
    const identities = await listIdentities();
    
    // Get all roles from app database
    const roles = await query<UserRole>('SELECT * FROM user_roles');
    const roleMap = new Map(roles.map(r => [r.identity_id, r]));

    // Merge identity and role data
    const users = identities.map(identity => {
      const roleRecord = roleMap.get(identity.id);
      return {
        id: identity.id,
        email: getEmailFromIdentity(identity),
        name: getNameFromIdentity(identity),
        picture: getPictureFromIdentity(identity),
        role: roleRecord?.role || null,
        isPending: !roleRecord,
        createdAt: identity.created_at,
        roleAssignedAt: roleRecord?.created_at,
      };
    });

    res.json({
      users,
      total: users.length,
      pending: users.filter(u => u.isPending).length,
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /admin/users/:identityId
 * Get a specific user by identity ID
 */
router.get('/users/:identityId', requireAuthApi, requireAdmin, async (req, res) => {
  try {
    const { identityId } = req.params;
    
    // Get identity from Kratos
    const identity = await getIdentity(identityId);
    
    if (!identity) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get role from app database
    const roleRecord = await queryOne<UserRole>(
      'SELECT * FROM user_roles WHERE identity_id = $1',
      [identityId]
    );

    res.json({
      id: identity.id,
      email: getEmailFromIdentity(identity),
      name: getNameFromIdentity(identity),
      picture: getPictureFromIdentity(identity),
      role: roleRecord?.role || null,
      isPending: !roleRecord,
      createdAt: identity.created_at,
      roleAssignedAt: roleRecord?.created_at,
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/users/:identityId/role
 * Assign or update a user's role
 */
router.post('/users/:identityId/role', requireAuthApi, requireAdmin, async (req, res) => {
  try {
    const { identityId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role', 
        message: 'Role must be either "admin" or "user"' 
      });
    }

    // Verify the identity exists in Kratos
    const identity = await getIdentity(identityId);
    
    if (!identity) {
      return res.status(404).json({ error: 'User not found in Kratos' });
    }

    // Prevent admins from demoting themselves
    if (identityId === req.identity?.id && role !== 'admin') {
      return res.status(400).json({ 
        error: 'Cannot demote self', 
        message: 'You cannot remove your own admin role' 
      });
    }

    // Insert or update role
    const result = await queryOne<UserRole>(
      `INSERT INTO user_roles (identity_id, role) 
       VALUES ($1, $2) 
       ON CONFLICT (identity_id) 
       DO UPDATE SET role = $2, updated_at = NOW()
       RETURNING *`,
      [identityId, role]
    );

    res.json({
      message: 'Role updated successfully',
      user: {
        id: identity.id,
        email: getEmailFromIdentity(identity),
        name: getNameFromIdentity(identity),
        role: result?.role,
      },
    });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /admin/users/:identityId/role
 * Remove a user's role (set to pending)
 */
router.delete('/users/:identityId/role', requireAuthApi, requireAdmin, async (req, res) => {
  try {
    const { identityId } = req.params;

    // Prevent admins from demoting themselves
    if (identityId === req.identity?.id) {
      return res.status(400).json({ 
        error: 'Cannot demote self', 
        message: 'You cannot remove your own role' 
      });
    }

    // Delete the role
    await query('DELETE FROM user_roles WHERE identity_id = $1', [identityId]);

    res.json({
      message: 'Role removed successfully. User is now pending approval.',
    });
  } catch (error) {
    console.error('Error removing role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
