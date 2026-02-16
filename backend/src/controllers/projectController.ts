import { Request, Response } from 'express';
import { projectService } from '../services/projectService';
import { CreateProjectDTO, UpdateProjectDTO, AddProjectMemberDTO } from '../dto/project.dto';
import { ApiResponse } from '../dto/common.dto';

export class ProjectController {
  async getProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const project = await projectService.getProjectById(projectId);

      if (!project) {
        return res.status(404).json(new ApiResponse(false, null, 'Project not found'));
      }

      return res.json(new ApiResponse(true, project, 'Project retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving project', error));
    }
  }

  async getAllProjects(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const { projects, total } = await projectService.getAllProjects(skip, limit);

      return res.json(new ApiResponse(true, {
        projects,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }, 'Projects retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving projects', error));
    }
  }

  async createProject(req: Request, res: Response) {
    try {
      const dto: CreateProjectDTO = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json(new ApiResponse(false, null, 'Unauthorized'));
      }

      const project = await projectService.createProject(dto, userId);
      return res.status(201).json(new ApiResponse(true, project, 'Project created successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error creating project', error));
    }
  }

  async updateProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const dto: UpdateProjectDTO = req.body;

      const project = await projectService.updateProject(projectId, dto);
      return res.json(new ApiResponse(true, project, 'Project updated successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error updating project', error));
    }
  }

  async getProjectMembers(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const members = await projectService.getProjectMembers(projectId);

      return res.json(new ApiResponse(true, members, 'Project members retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving project members', error));
    }
  }

  async addProjectMember(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const dto: AddProjectMemberDTO = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json(new ApiResponse(false, null, 'Unauthorized'));
      }

      await projectService.addProjectMember(projectId, dto, userId);
      return res.status(201).json(new ApiResponse(true, null, 'Project member added successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error adding project member', error));
    }
  }

  async removeProjectMember(req: Request, res: Response) {
    try {
      const { projectId, memberId } = req.params;

      await projectService.removeProjectMember(projectId, memberId);
      return res.json(new ApiResponse(true, null, 'Project member removed successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error removing project member', error));
    }
  }
}

export const projectController = new ProjectController();
