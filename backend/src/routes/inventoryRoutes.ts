import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { inventoryController } from '../controllers/inventoryController';

const router = Router();

router.get('/:projectId', authMiddleware, (req, res) =>
  inventoryController.getProjectInventory(req, res)
);
router.get('/:projectId/sku/:skuId', authMiddleware, (req, res) =>
  inventoryController.getSKUInventory(req, res)
);
router.post('/:projectId/adjust', authMiddleware, roleMiddleware('storekeeper', 'admin'), (req, res) =>
  inventoryController.adjustInventory(req, res)
);
router.post('/:projectId/transfer', authMiddleware, roleMiddleware('storekeeper', 'admin'), (req, res) =>
  inventoryController.transferInventory(req, res)
);
router.get('/:projectId/transactions', authMiddleware, (req, res) =>
  inventoryController.getInventoryTransactions(req, res)
);
router.get('/:projectId/low-stock', authMiddleware, (req, res) =>
  inventoryController.getLowStockItems(req, res)
);

export default router;
