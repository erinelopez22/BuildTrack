import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { projectController } from '../controllers/projectController';

const router = Router();

router.get('/:projectId', authMiddleware, (req, res) => projectController.getProject(req, res));
router.get('/', authMiddleware, (req, res) => projectController.getAllProjects(req, res));
router.post('/', authMiddleware, roleMiddleware('admin', 'project_manager'), (req, res) =>
  projectController.createProject(req, res)
);
router.put('/:projectId', authMiddleware, roleMiddleware('admin', 'project_manager'), (req, res) =>
  projectController.updateProject(req, res)
);

router.get('/:projectId/members', authMiddleware, (req, res) =>
  projectController.getProjectMembers(req, res)
);
router.post('/:projectId/members', authMiddleware, roleMiddleware('admin', 'project_manager'), (req, res) =>
  projectController.addProjectMember(req, res)
);
router.delete('/:projectId/members/:memberId', authMiddleware, roleMiddleware('admin', 'project_manager'), (req, res) =>
  projectController.removeProjectMember(req, res)
);

export default router;
