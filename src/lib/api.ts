import { apiClient } from  './apiClient';
import {
  CreateUserDTO,
  UpdateUserDTO,
  UserResponseDTO,
  LoginDTO,
  LoginResponseDTO,
} from '../../backend/src/dto/user.dto';

export const authAPI = {
  login: async (dto: LoginDTO): Promise<LoginResponseDTO> => {
    const response = await apiClient.post('/api/auth/login', dto);
    return response.data.data;
  },

  getProfile: async (): Promise<UserResponseDTO> => {
    const response = await apiClient.get('/api/auth/profile');
    return response.data.data;
  },

  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    const response = await apiClient.post('/api/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  },

  logout: () => {
    apiClient.clearAuthToken();
    localStorage.removeItem('user');
  },
};

export const usersAPI = {
  getAllUsers: async (page = 1, limit = 10) => {
    const response = await apiClient.get('/api/users', {
      params: { page, limit },
    });
    return response.data.data;
  },

  getUserById: async (userId: string): Promise<UserResponseDTO> => {
    const response = await apiClient.get(`/api/users/${userId}`);
    return response.data.data;
  },

  createUser: async (dto: CreateUserDTO): Promise<UserResponseDTO> => {
    const response = await apiClient.post('/api/users', dto);
    return response.data.data;
  },

  updateProfile: async (dto: UpdateUserDTO): Promise<UserResponseDTO> => {
    const response = await apiClient.put('/api/users/profile', dto);
    return response.data.data;
  },

  deactivateUser: async (userId: string) => {
    const response = await apiClient.delete(`/api/users/${userId}`);
    return response.data;
  },
};

export const projectsAPI = {
  getAllProjects: async (page = 1, limit = 10) => {
    const response = await apiClient.get('/api/projects', {
      params: { page, limit },
    });
    return response.data.data;
  },

  getProjectById: async (projectId: string) => {
    const response = await apiClient.get(`/api/projects/${projectId}`);
    return response.data.data;
  },

  createProject: async (dto: any) => {
    const response = await apiClient.post('/api/projects', dto);
    return response.data.data;
  },

  updateProject: async (projectId: string, dto: any) => {
    const response = await apiClient.put(`/api/projects/${projectId}`, dto);
    return response.data.data;
  },

  getProjectMembers: async (projectId: string) => {
    const response = await apiClient.get(`/api/projects/${projectId}/members`);
    return response.data.data;
  },

  addProjectMember: async (projectId: string, userId: string, role: string) => {
    const response = await apiClient.post(`/api/projects/${projectId}/members`, {
      user_id: userId,
      role,
    });
    return response.data.data;
  },

  removeProjectMember: async (projectId: string, memberId: string) => {
    const response = await apiClient.delete(`/api/projects/${projectId}/members/${memberId}`);
    return response.data;
  },
};

export const ordersAPI = {
  getOrderById: async (orderId: string) => {
    const response = await apiClient.get(`/api/orders/${orderId}`);
    return response.data.data;
  },

  getOrdersByProject: async (projectId: string, page = 1, limit = 10) => {
    const response = await apiClient.get(`/api/orders/project/${projectId}`, {
      params: { page, limit },
    });
    return response.data.data;
  },

  createOrder: async (dto: any) => {
    const response = await apiClient.post('/api/orders', dto);
    return response.data.data;
  },

  updateOrder: async (orderId: string, dto: any) => {
    const response = await apiClient.put(`/api/orders/${orderId}`, dto);
    return response.data.data;
  },

  approveOrder: async (orderId: string, approvedBy: string) => {
    const response = await apiClient.post(`/api/orders/${orderId}/approve`, {
      approved_by: approvedBy,
    });
    return response.data.data;
  },

  rejectOrder: async (orderId: string, rejectionReason: string) => {
    const response = await apiClient.post(`/api/orders/${orderId}/reject`, {
      rejection_reason: rejectionReason,
    });
    return response.data.data;
  },
};

export const skusAPI = {
  getAllSKUs: async (page = 1, limit = 10, activeOnly = true) => {
    const response = await apiClient.get('/api/skus', {
      params: { page, limit, activeOnly },
    });
    return response.data.data;
  },

  getSKUById: async (skuId: string) => {
    const response = await apiClient.get(`/api/skus/${skuId}`);
    return response.data.data;
  },

  createSKU: async (dto: any) => {
    const response = await apiClient.post('/api/skus', dto);
    return response.data.data;
  },

  updateSKU: async (skuId: string, dto: any) => {
    const response = await apiClient.put(`/api/skus/${skuId}`, dto);
    return response.data.data;
  },

  searchSKUs: async (searchTerm: string) => {
    const response = await apiClient.get('/api/skus/search', {
      params: { q: searchTerm },
    });
    return response.data.data;
  },
};

export const inventoryAPI = {
  getProjectInventory: async (projectId: string) => {
    const response = await apiClient.get(`/api/inventory/${projectId}`);
    return response.data.data;
  },

  getSKUInventory: async (projectId: string, skuId: string) => {
    const response = await apiClient.get(`/api/inventory/${projectId}/sku/${skuId}`);
    return response.data.data;
  },

  adjustInventory: async (projectId: string, skuId: string, quantity: number, notes?: string) => {
    const response = await apiClient.post(`/api/inventory/${projectId}/adjust`, {
      sku_id: skuId,
      quantity,
      notes,
    });
    return response.data.data;
  },

  transferInventory: async (
    projectId: string,
    skuId: string,
    quantity: number,
    targetProjectId: string,
    notes?: string
  ) => {
    const response = await apiClient.post(`/api/inventory/${projectId}/transfer`, {
      sku_id: skuId,
      quantity,
      target_project_id: targetProjectId,
      notes,
    });
    return response.data.data;
  },

  getInventoryTransactions: async (projectId: string, page = 1, limit = 20) => {
    const response = await apiClient.get(`/api/inventory/${projectId}/transactions`, {
      params: { page, limit },
    });
    return response.data.data;
  },

  getLowStockItems: async (projectId: string) => {
    const response = await apiClient.get(`/api/inventory/${projectId}/low-stock`);
    return response.data.data;
  },
};

export const dashboardAPI = {
  getStats: async () => {
    const response = await apiClient.get('/api/dashboard');
    return response.data.data;
  },
};

export const settingsAPI = {
  getSMS: async () => {
    const response = await apiClient.get('/api/settings/sms');
    return response.data.data;
  },
  upsertSMS: async (payload: any) => {
    const response = await apiClient.post('/api/settings/sms', payload);
    return response.data.data;
  },
};
