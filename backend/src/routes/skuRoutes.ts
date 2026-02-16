import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { skuController } from '../controllers/skuController';

const router = Router();

router.get('/:skuId', authMiddleware, (req, res) => skuController.getSKU(req, res));
router.get('/', authMiddleware, (req, res) => skuController.getAllSKUs(req, res));
router.post('/', authMiddleware, roleMiddleware('admin', 'storekeeper'), (req, res) =>
  skuController.createSKU(req, res)
);
router.put('/:skuId', authMiddleware, roleMiddleware('admin', 'storekeeper'), (req, res) =>
  skuController.updateSKU(req, res)
);
router.get('/search', authMiddleware, (req, res) => skuController.searchSKUs(req, res));

export default router;
