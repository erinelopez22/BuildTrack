import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { dashboardController } from '../controllers/dashboardController';

const router = Router();

router.get('/', authMiddleware, (req, res) => dashboardController.getStats(req, res));

export default router;
