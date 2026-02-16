import { Router } from 'express';
import { supabaseShimController } from '../controllers/supabaseShimController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Basic CRUD proxy for frontend legacy supabase usage. Protected by auth.
router.get('/:table', authMiddleware, (req, res) => supabaseShimController.get(req, res));
router.post('/:table', authMiddleware, (req, res) => supabaseShimController.post(req, res));
router.put('/:table', authMiddleware, (req, res) => supabaseShimController.put(req, res));
router.delete('/:table', authMiddleware, (req, res) => supabaseShimController.del(req, res));

export default router;
