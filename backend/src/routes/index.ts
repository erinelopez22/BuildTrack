import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import projectRoutes from './projectRoutes';
import orderRoutes from './orderRoutes';
import skuRoutes from './skuRoutes';
import inventoryRoutes from './inventoryRoutes';
import dashboardRoutes from './dashboardRoutes';
import settingsRoutes from './settingsRoutes';
import supabaseShimRoutes from './supabaseShimRoutes';

const router = Router();

router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);
router.use('/api/projects', projectRoutes);
router.use('/api/orders', orderRoutes);
router.use('/api/skus', skuRoutes);
router.use('/api/inventory', inventoryRoutes);
router.use('/api/dashboard', dashboardRoutes);
router.use('/api/settings', settingsRoutes);
router.use('/api/_supabase', supabaseShimRoutes);

export default router;
