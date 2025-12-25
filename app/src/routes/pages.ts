/**
 * Public Pages Routes
 * 
 * Handles public-facing page viewing with role-based access control.
 * Uses /p/ prefix to avoid routing collisions with other routes.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getEmailFromIdentity, getNameFromIdentity, getPictureFromIdentity } from '../services/kratos';
import { getAllPages, getPageBySlug } from '../db/pages';
import { renderMarkdown } from '../services/markdown';

const router = Router();

/**
 * GET /p
 * 
 * Lists all pages accessible by the current user's role.
 * Redirects to login if not authenticated.
 */
router.get('/p', requireAuth, async (req: Request, res: Response) => {
  try {
    const userRole = req.userRole;

    if (!userRole || !req.identity) {
      const userData = {
        id: req.identity?.id,
        email: req.identity ? getEmailFromIdentity(req.identity) : '',
        name: req.identity ? getNameFromIdentity(req.identity) : '',
        picture: req.identity ? getPictureFromIdentity(req.identity) : '',
        role: null,
      };
      return res.status(403).render('pending', {
        user: userData,
        message: 'You do not have a role assigned yet. Please wait for admin approval.',
      });
    }

    const pages = await getAllPages(userRole);
    const userData = {
      id: req.identity.id,
      email: getEmailFromIdentity(req.identity),
      name: getNameFromIdentity(req.identity),
      picture: getPictureFromIdentity(req.identity),
      role: userRole,
    };

    res.render('pages-list', {
      user: userData,
      pages,
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /p/:slug
 * 
 * Displays a single page by slug.
 * Enforces role-based access control - returns 403 if user's role
 * is not in the page's allowed_roles array.
 */
router.get('/p/:slug', requireAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const userRole = req.userRole;

    if (!userRole || !req.identity) {
      const userData = {
        id: req.identity?.id,
        email: req.identity ? getEmailFromIdentity(req.identity) : '',
        name: req.identity ? getNameFromIdentity(req.identity) : '',
        picture: req.identity ? getPictureFromIdentity(req.identity) : '',
        role: null,
      };
      return res.status(403).render('pending', {
        user: userData,
        message: 'You do not have a role assigned yet. Please wait for admin approval.',
      });
    }

    // Fetch the page
    const page = await getPageBySlug(slug);

    if (!page) {
      return res.status(404).send('Page not found');
    }

    // Security Check: Verify user's role is in allowed_roles
    if (!page.allowed_roles.includes(userRole)) {
      const userData = {
        id: req.identity.id,
        email: getEmailFromIdentity(req.identity),
        name: getNameFromIdentity(req.identity),
        picture: getPictureFromIdentity(req.identity),
        role: userRole,
      };
      return res.status(403).render('error', {
        user: userData,
        title: 'Access Denied',
        message: 'You do not have permission to view this page.',
      });
    }

    // Render markdown to safe HTML
    const htmlContent = renderMarkdown(page.content);
    const userData = {
      id: req.identity.id,
      email: getEmailFromIdentity(req.identity),
      name: getNameFromIdentity(req.identity),
      picture: getPictureFromIdentity(req.identity),
      role: userRole,
    };

    res.render('page-view', {
      user: userData,
      page: {
        ...page,
        htmlContent,
      },
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).send('Internal server error');
  }
});

export default router;
