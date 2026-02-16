import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { settingsController } from '../controllers/settingsController';

const router = Router();

router.get('/sms', authMiddleware, (req, res) => settingsController.getSMSSettings(req, res));
router.post('/sms', authMiddleware, (req, res) => settingsController.upsertSMSSettings(req, res));
router.put('/sms', authMiddleware, (req, res) => settingsController.upsertSMSSettings(req, res));

export default router;
