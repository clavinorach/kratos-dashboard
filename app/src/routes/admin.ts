import { Router } from 'express';
import { requireAuthApi, requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireRole';
import { query, queryOne } from '../db/client';
import { 
  listIdentities, 
  getIdentity,
  getEmailFromIdentity, 
  getNameFromIdentity,
  getPictureFromIdentity
} from '../services/kratos';
import {
  getAllPagesAdmin,
  getPageById,
  createPage,
  updatePage,
  deletePage,
} from '../db/pages';

const router = Router();

// ============================================================================
// HTML Routes for Page Management (Before API routes)
// ============================================================================

/**
 * GET /admin/pages/new
 * Show page creation form
 */
router.get('/pages/new', requireAuth, requireAdmin, async (req, res) => {
  const userData = {
    id: req.identity?.id,
    email: req.identity ? getEmailFromIdentity(req.identity) : '',
    name: req.identity ? getNameFromIdentity(req.identity) : '',
    picture: req.identity ? getPictureFromIdentity(req.identity) : '',
    role: req.userRole,
  };
  res.render('admin/page-editor', {
    user: userData,
    page: null,
  });
});

/**
 * GET /admin/pages/:id/edit
 * Show page editing form
 */
router.get('/pages/:id/edit', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).send('Invalid page ID');
    }

    const page = await getPageById(id);

    if (!page) {
      return res.status(404).send('Page not found');
    }

    const userData = {
      id: req.identity?.id,
      email: req.identity ? getEmailFromIdentity(req.identity) : '',
      name: req.identity ? getNameFromIdentity(req.identity) : '',
      picture: req.identity ? getPictureFromIdentity(req.identity) : '',
      role: req.userRole,
    };

    res.render('admin/page-editor', {
      user: userData,
      page,
    });
  } catch (error) {
    console.error('Error loading page editor:', error);
    res.status(500).send('Internal server error');
  }
});

// ============================================================================
// API Routes for User Management
// ============================================================================

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

// ============================================================================
// Page Management Routes
// ============================================================================

/**
 * GET /admin/pages
 * List all pages (no role filtering)
 */
router.get('/pages', requireAuthApi, requireAdmin, async (req, res) => {
  try {
    const pages = await getAllPagesAdmin();
    res.json({
      pages,
      total: pages.length,
    });
  } catch (error) {
    console.error('Error listing pages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /admin/pages/:id
 * Get a specific page by ID
 */
router.get('/pages/:id', requireAuthApi, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid page ID' });
    }

    const page = await getPageById(id);

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ page });
  } catch (error) {
    console.error('Error getting page:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/pages
 * Create a new page
 */
router.post('/pages', requireAuthApi, requireAdmin, async (req, res) => {
  try {
    const { slug, title, content, allowed_roles } = req.body;

    // Validation
    if (!slug || !title || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'slug, title, and content are required'
      });
    }

    if (!allowed_roles || !Array.isArray(allowed_roles) || allowed_roles.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid allowed_roles',
        message: 'allowed_roles must be a non-empty array'
      });
    }

    // Validate roles
    const validRoles = ['admin', 'user'];
    const invalidRoles = allowed_roles.filter(r => !validRoles.includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid roles',
        message: `Invalid roles: ${invalidRoles.join(', ')}`
      });
    }

    const page = await createPage({
      slug,
      title,
      content,
      allowed_roles,
    });

    res.status(201).json({
      message: 'Page created successfully',
      page,
    });
  } catch (error: any) {
    console.error('Error creating page:', error);
    if (error.message.includes('slug')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /admin/pages/:id
 * Update an existing page
 */
router.put('/pages/:id', requireAuthApi, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid page ID' });
    }

    const { slug, title, content, allowed_roles } = req.body;

    // Validate roles if provided
    if (allowed_roles !== undefined) {
      if (!Array.isArray(allowed_roles) || allowed_roles.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid allowed_roles',
          message: 'allowed_roles must be a non-empty array'
        });
      }

      const validRoles = ['admin', 'user'];
      const invalidRoles = allowed_roles.filter(r => !validRoles.includes(r));
      if (invalidRoles.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid roles',
          message: `Invalid roles: ${invalidRoles.join(', ')}`
        });
      }
    }

    const page = await updatePage(id, {
      slug,
      title,
      content,
      allowed_roles,
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({
      message: 'Page updated successfully',
      page,
    });
  } catch (error: any) {
    console.error('Error updating page:', error);
    if (error.message.includes('slug')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /admin/pages/:id
 * Delete a page
 */
router.delete('/pages/:id', requireAuthApi, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid page ID' });
    }

    const deleted = await deletePage(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({
      message: 'Page deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
