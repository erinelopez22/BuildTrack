export class CreateProjectDTO {
  name!: string;
  code?: string;
  location?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  project_manager_id?: string;
  estimated_cost?: number;
}

export class UpdateProjectDTO {
  name?: string;
  location?: string;
  description?: string;
  status?: 'active' | 'on_hold' | 'completed' | 'cancelled';
  start_date?: string;
  end_date?: string;
  estimated_cost?: number;
}

export class ProjectResponseDTO {
  id!: string;
  name!: string;
  code?: string;
  location?: string;
  description?: string;
  status!: string;
  start_date?: string;
  end_date?: string;
  project_manager_id?: string;
  estimated_cost?: number;
  created_at!: string;
  updated_at!: string;
  created_by?: string;
}

export class AddProjectMemberDTO {
  user_id!: string;
  role!: string;
}

export class ProjectMemberResponseDTO {
  id!: string;
  project_id!: string;
  user_id!: string;
  role!: string;
  created_at!: string;
}
