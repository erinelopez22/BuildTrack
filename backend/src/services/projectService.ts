import { query, execute } from '../config/database';
import { CreateProjectDTO, UpdateProjectDTO, ProjectResponseDTO, AddProjectMemberDTO } from '../dto/project.dto';
import { v4 as uuidv4 } from 'uuid';

export class ProjectService {
  async getProjectById(projectId: string): Promise<ProjectResponseDTO | null> {
    const sql = `
      SELECT 
        id, name, code, location, description, status, 
        start_date, end_date, project_manager_id, estimated_cost, 
        created_at, updated_at, created_by
      FROM projects
      WHERE id = @projectId
    `;

    const result = await query(sql, { projectId });
    return result.length > 0 ? (result[0] as ProjectResponseDTO) : null;
  }

  async getAllProjects(skip: number = 0, take: number = 10): Promise<{ projects: ProjectResponseDTO[], total: number }> {
    const countSql = 'SELECT COUNT(*) as total FROM projects WHERE status != \'deleted\'';
    const countResult = await query(countSql);
    const total = (countResult[0] as any).total;

    const sql = `
      SELECT 
        id, name, code, location, description, status, 
        start_date, end_date, project_manager_id, estimated_cost, 
        created_at, updated_at, created_by
      FROM projects
      WHERE status != 'deleted'
      ORDER BY created_at DESC
      OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
    `;

    const projects = await query(sql, { skip, take });
    return { projects: projects as ProjectResponseDTO[], total };
  }

  async createProject(dto: CreateProjectDTO, createdBy: string): Promise<ProjectResponseDTO> {
    const projectId = uuidv4();

    const sql = `
      INSERT INTO projects 
        (id, name, code, location, description, status, start_date, end_date, project_manager_id, estimated_cost, created_by, created_at, updated_at)
      VALUES 
        (@id, @name, @code, @location, @description, 'active', @startDate, @endDate, @projectManagerId, @estimatedCost, @createdBy, GETUTCDATE(), GETUTCDATE())
    `;

    await execute(sql, {
      id: projectId,
      name: dto.name,
      code: dto.code || null,
      location: dto.location || null,
      description: dto.description || null,
      startDate: dto.start_date || null,
      endDate: dto.end_date || null,
      projectManagerId: dto.project_manager_id || null,
      estimatedCost: dto.estimated_cost || null,
      createdBy,
    });

    return this.getProjectById(projectId) as Promise<ProjectResponseDTO>;
  }

  async updateProject(projectId: string, dto: UpdateProjectDTO): Promise<ProjectResponseDTO> {
    let sql = 'UPDATE projects SET updated_at = GETUTCDATE()';
    const params: Record<string, any> = { projectId };

    if (dto.name !== undefined) {
      sql += ', name = @name';
      params.name = dto.name;
    }
    if (dto.location !== undefined) {
      sql += ', location = @location';
      params.location = dto.location;
    }
    if (dto.description !== undefined) {
      sql += ', description = @description';
      params.description = dto.description;
    }
    if (dto.status !== undefined) {
      sql += ', status = @status';
      params.status = dto.status;
    }
    if (dto.start_date !== undefined) {
      sql += ', start_date = @startDate';
      params.startDate = dto.start_date;
    }
    if (dto.end_date !== undefined) {
      sql += ', end_date = @endDate';
      params.endDate = dto.end_date;
    }
    if (dto.estimated_cost !== undefined) {
      sql += ', estimated_cost = @estimatedCost';
      params.estimatedCost = dto.estimated_cost;
    }

    sql += ' WHERE id = @projectId';
    await execute(sql, params);

    return this.getProjectById(projectId) as Promise<ProjectResponseDTO>;
  }

  async addProjectMember(projectId: string, dto: AddProjectMemberDTO, createdBy: string): Promise<void> {
    const memberSql = `
      INSERT INTO project_members (id, project_id, user_id, role, created_by, created_at)
      VALUES (@id, @projectId, @userId, @role, @createdBy, GETUTCDATE())
    `;

    await execute(memberSql, {
      id: uuidv4(),
      projectId,
      userId: dto.user_id,
      role: dto.role,
      createdBy,
    });
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    const sql = 'DELETE FROM project_members WHERE project_id = @projectId AND user_id = @userId';
    await execute(sql, { projectId, userId });
  }

  async getProjectMembers(projectId: string): Promise<any[]> {
    const sql = `
      SELECT pm.id, pm.project_id, pm.user_id, pm.role, u.full_name, u.email
      FROM project_members pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = @projectId
    `;

    return query(sql, { projectId });
  }
}

export const projectService = new ProjectService();
