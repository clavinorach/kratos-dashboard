import { Router } from 'express';
import { requireAuthApi } from '../middleware/auth';
import { 
  getEmailFromIdentity, 
  getNameFromIdentity, 
  getPictureFromIdentity 
} from '../services/kratos';

const router = Router();

/**
 * GET /me
 * Returns the current user's identity and role information
 */
router.get('/', requireAuthApi, async (req, res) => {
  if (!req.identity) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const identity = req.identity;
  
  res.json({
    id: identity.id,
    email: getEmailFromIdentity(identity),
    name: getNameFromIdentity(identity),
    picture: getPictureFromIdentity(identity),
    role: req.userRole,
    isPending: req.userRole === null,
    isAdmin: req.userRole === 'admin',
    createdAt: identity.created_at,
    updatedAt: identity.updated_at,
  });
});

export default router;
