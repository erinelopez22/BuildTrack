import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { userController } from '../controllers/userController';

const router = Router();

router.get('/:userId', authMiddleware, (req, res) => userController.getProfile(req, res));
router.get('/', authMiddleware, (req, res) => userController.getAllUsers(req, res));
router.post('/', authMiddleware, roleMiddleware('admin', 'super_admin'), (req, res) =>
  userController.createUser(req, res)
);
router.put('/profile', authMiddleware, (req, res) => userController.updateProfile(req, res));
router.delete('/:userId', authMiddleware, roleMiddleware('admin', 'super_admin'), (req, res) =>
  userController.deactivateUser(req, res)
);

export default router;
