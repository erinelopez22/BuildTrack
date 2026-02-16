import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { userController } from '../controllers/userController';
import { userService } from '../services/userService';
import { env } from '../config/environment';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../dto/common.dto';

const router = Router();

router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body;
		if (!email || !password) return res.status(400).json(new ApiResponse(false, null, 'Email and password are required'));

		const auth = await userService.authenticate(email, password);
		if (!auth || !auth.user) return res.status(401).json(new ApiResponse(false, null, 'Invalid credentials'));

		const token = jwt.sign({ id: auth.user.id, email: auth.user.email, roles: auth.user.roles }, env.jwt.secret, { expiresIn: env.jwt.expiration });

		return res.json(new ApiResponse(true, { access_token: token, user: auth.user }, 'Login successful'));
	} catch (error) {
		console.error('Login handler error:', error);
		return res.status(500).json(new ApiResponse(false, null, 'Login failed', { message: (error as any)?.message }));
	}
});

router.get('/profile', authMiddleware, (req, res) => userController.getProfile(req, res));
router.post('/change-password', authMiddleware, (req, res) => userController.changePassword(req, res));

export default router;
