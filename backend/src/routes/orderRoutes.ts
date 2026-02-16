import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { orderController } from '../controllers/orderController';

const router = Router();

router.get('/:orderId', authMiddleware, (req, res) => orderController.getOrder(req, res));
router.get('/project/:projectId', authMiddleware, (req, res) =>
  orderController.getOrdersByProject(req, res)
);
router.post('/', authMiddleware, roleMiddleware('procurement', 'admin'), (req, res) =>
  orderController.createOrder(req, res)
);
router.put('/:orderId', authMiddleware, roleMiddleware('procurement', 'admin'), (req, res) =>
  orderController.updateOrder(req, res)
);
router.post('/:orderId/approve', authMiddleware, roleMiddleware('approver', 'admin'), (req, res) =>
  orderController.approveOrder(req, res)
);
router.post('/:orderId/reject', authMiddleware, roleMiddleware('approver', 'admin'), (req, res) =>
  orderController.rejectOrder(req, res)
);

export default router;
