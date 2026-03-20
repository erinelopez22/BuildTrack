// Frontend API Client Service - Replace Supabase calls with REST API

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7069';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('accessToken');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('accessToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        window.location.href = '/login';
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, password }),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  async logout() {
    const response = await fetch(`${this.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    this.clearToken();
    return this.handleResponse<ApiResponse<void>>(response);
  }

  async refreshToken(refreshToken: string) {
    const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ refreshToken }),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  // User endpoints
  async getCurrentUser() {
    const response = await fetch(`${this.baseUrl}/api/users/me`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  async getUser(id: string) {
    const response = await fetch(`${this.baseUrl}/api/users/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  async getAllUsers(page = 1, pageSize = 10) {
    const response = await fetch(`${this.baseUrl}/api/users?page=${page}&pageSize=${pageSize}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ApiResponse<PaginatedResponse<any>>>(response);
  }

  async updateUser(id: string, data: any) {
    const response = await fetch(`${this.baseUrl}/api/users/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  async changePassword(id: string, data: any) {
    const response = await fetch(`${this.baseUrl}/api/users/${id}/change-password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<ApiResponse<void>>(response);
  }

  async assignRole(userId: string, role: string) {
    const response = await fetch(`${this.baseUrl}/api/users/${userId}/roles`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, role }),
    });

    return this.handleResponse<ApiResponse<void>>(response);
  }

  // Project endpoints
  async getProject(id: string) {
    const response = await fetch(`${this.baseUrl}/api/projects/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  async getAllProjects(page = 1, pageSize = 10, includeHidden = false) {
    const url = new URL(`${this.baseUrl}/api/projects`);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('pageSize', pageSize.toString());
    url.searchParams.append('includeHidden', includeHidden.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ApiResponse<PaginatedResponse<any>>>(response);
  }

  async createProject(data: any) {
    const response = await fetch(`${this.baseUrl}/api/projects`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  async updateProject(id: string, data: any) {
    const response = await fetch(`${this.baseUrl}/api/projects/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  async request<T>(method: string, path: string, body?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async deleteProject(id: string) {
    const response = await fetch(`${this.baseUrl}/api/projects/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ApiResponse<void>>(response);
  }

  // Order endpoints
  async getOrder(id: string) {
    const response = await fetch(`${this.baseUrl}/api/orders/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  async getOrdersByProject(projectId: string, status?: string, page = 1, pageSize = 10) {
    const url = new URL(`${this.baseUrl}/api/orders/project/${projectId}`);
    if (status) url.searchParams.append('status', status);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('pageSize', pageSize.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ApiResponse<PaginatedResponse<any>>>(response);
  }

  async createOrder(data: any) {
    const response = await fetch(`${this.baseUrl}/api/orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  async updateOrder(id: string, data: any) {
    const response = await fetch(`${this.baseUrl}/api/orders/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<ApiResponse<any>>(response);
  }

  async approveOrder(id: string, data: any) {
    const response = await fetch(`${this.baseUrl}/api/orders/${id}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<ApiResponse<void>>(response);
  }

  async rejectOrder(id: string, data: any) {
    const response = await fetch(`${this.baseUrl}/api/orders/${id}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<ApiResponse<void>>(response);
  }

  async deleteOrder(id: string) {
    const response = await fetch(`${this.baseUrl}/api/orders/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ApiResponse<void>>(response);
  }
}

export const apiClient = new ApiClient();
