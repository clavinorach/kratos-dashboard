import { Request, Response, NextFunction } from 'express';

type Role = 'admin' | 'user';

/**
 * Middleware factory to require specific role(s)
 * Should be used AFTER requireAuth middleware
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user is authenticated
    if (!req.identity) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    // Check if user has a role assigned
    if (!req.userRole) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Your account is pending approval. Please wait for an administrator to assign a role.' 
      });
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
}

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to require any role (user or admin)
 * Essentially checks that the user has been approved
 */
export const requireApproved = requireRole('admin', 'user');

