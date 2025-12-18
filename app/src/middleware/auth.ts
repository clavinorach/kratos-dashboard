import { Request, Response, NextFunction } from 'express';
import { Identity, Session } from '@ory/client';
import { validateSession } from '../services/kratos';
import { queryOne } from '../db/client';
import { config } from '../config';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      session?: Session;
      identity?: Identity;
      userRole?: 'admin' | 'user' | null;
    }
  }
}

interface UserRole {
  identity_id: string;
  role: 'admin' | 'user';
}

/**
 * Middleware to authenticate requests via Kratos session
 * Validates the session cookie and merges app-level role data
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Get cookies from request
  const cookie = req.headers.cookie;
  
  if (!cookie) {
    return res.redirect(`${config.kratosUiUrl}/login?return_to=${encodeURIComponent(config.appUrl + req.originalUrl)}`);
  }

  // Validate session with Kratos
  const kratosSession = await validateSession(cookie);
  
  if (!kratosSession) {
    return res.redirect(`${config.kratosUiUrl}/login?return_to=${encodeURIComponent(config.appUrl + req.originalUrl)}`);
  }

  // Attach session and identity to request
  req.session = kratosSession.session;
  req.identity = kratosSession.identity;

  // Fetch user role from app database
  const userRole = await queryOne<UserRole>(
    'SELECT identity_id, role FROM user_roles WHERE identity_id = $1',
    [kratosSession.identity.id]
  );

  req.userRole = userRole?.role || null;

  next();
}

/**
 * Middleware for API endpoints - returns JSON errors instead of redirects
 */
export async function requireAuthApi(req: Request, res: Response, next: NextFunction) {
  const cookie = req.headers.cookie;
  
  if (!cookie) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No session cookie provided' });
  }

  const kratosSession = await validateSession(cookie);
  
  if (!kratosSession) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session' });
  }

  req.session = kratosSession.session;
  req.identity = kratosSession.identity;

  // Fetch user role from app database
  const userRole = await queryOne<UserRole>(
    'SELECT identity_id, role FROM user_roles WHERE identity_id = $1',
    [kratosSession.identity.id]
  );

  req.userRole = userRole?.role || null;

  next();
}

/**
 * Optional auth middleware - doesn't redirect if not authenticated
 * Useful for pages that work with or without authentication
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const cookie = req.headers.cookie;
  
  if (cookie) {
    const kratosSession = await validateSession(cookie);
    
    if (kratosSession) {
      req.session = kratosSession.session;
      req.identity = kratosSession.identity;

      const userRole = await queryOne<UserRole>(
        'SELECT identity_id, role FROM user_roles WHERE identity_id = $1',
        [kratosSession.identity.id]
      );

      req.userRole = userRole?.role || null;
    }
  }

  next();
}

