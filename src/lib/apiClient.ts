// BuildTrack REST API Client
// Replaces all Supabase direct calls

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5069';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

// ── Token management ──────────────────────────────────────────────────────────

let _accessToken: string | null = localStorage.getItem('bt_access_token');
let _refreshToken: string | null = localStorage.getItem('bt_refresh_token');
let _refreshPromise: Promise<boolean> | null = null;

export const tokenStore = {
  set(access: string, refresh: string) {
    _accessToken = access;
    _refreshToken = refresh;
    localStorage.setItem('bt_access_token', access);
    localStorage.setItem('bt_refresh_token', refresh);
  },
  clear() {
    _accessToken = null;
    _refreshToken = null;
    localStorage.removeItem('bt_access_token');
    localStorage.removeItem('bt_refresh_token');
  },
  getAccess: () => _accessToken,
  getRefresh: () => _refreshToken,
};

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry && _refreshToken) {
    // Deduplicate concurrent refresh calls
    if (!_refreshPromise) {
      _refreshPromise = refreshTokens().finally(() => (_refreshPromise = null));
    }
    const refreshed = await _refreshPromise;
    if (refreshed) return request(path, options, false);
    tokenStore.clear();
    window.location.href = '/login';
    return { success: false, message: 'Session expired.' };
  }

  if (!res.ok && res.status !== 401) {
    const body = await res.json().catch(() => ({}));
    return { success: false, message: body.message || `HTTP ${res.status}`, errors: body.errors };
  }

  return res.json() as Promise<ApiResponse<T>>;
}

async function refreshTokens(): Promise<boolean> {
  const refresh = _refreshToken;
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.success && data.data) {
      tokenStore.set(data.data.accessToken, data.data.refreshToken);
      return true;
    }
  } catch {}
  return false;
}

// ── Convenience methods ───────────────────────────────────────────────────────

const get = <T>(path: string) => request<T>(path, { method: 'GET' });
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (loginId: string, password: string, companyId?: string) =>
    post<AuthResponse>('/api/auth/login', { loginId, password, companyId: companyId || null }),
  refresh: (refreshToken: string) =>
    post<AuthResponse>('/api/auth/refresh', { refreshToken }),
  logout: () => post('/api/auth/logout'),
  me: () => get<UserSession>('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    post('/api/auth/change-password', { currentPassword, newPassword }),
};

// ── Companies ────────────────────────────────────────────────────────────────

export const companiesApi = {
  getList: () => get<CompanyListItem[]>('/api/companies/list'),
  getAll: () => get<Company[]>('/api/companies'),
  getById: (id: string) => get<Company>(`/api/companies/${id}`),
  create: (data: CreateCompanyRequest) => post<Company>('/api/companies', data),
  update: (id: string, data: Partial<CreateCompanyRequest> & { isActive?: boolean }) =>
    put<Company>(`/api/companies/${id}`, data),
  delete: (id: string) => del(`/api/companies/${id}`),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const usersApi = {
  getAll: () => get<User[]>('/api/users'),
  getById: (id: string) => get<User>(`/api/users/${id}`),
  getMe: () => get<User>('/api/users/me'),
  create: (data: CreateUserRequest) => post<User>('/api/users', data),
  update: (id: string, data: Partial<UpdateUserRequest>) => put<User>(`/api/users/${id}`, data),
  delete: (id: string) => del(`/api/users/${id}`),
  getRoles: (id: string) => get<string[]>(`/api/users/${id}/roles`),
  assignRole: (id: string, role: string) =>
    post(`/api/users/${id}/roles`, { role }),
  removeRole: (id: string, role: string) => del(`/api/users/${id}/roles/${role}`),
};

// ── Projects ──────────────────────────────────────────────────────────────────

export const projectsApi = {
  getAll: (params?: { includeHidden?: boolean; status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.includeHidden) qs.set('includeHidden', 'true');
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString() ? `?${qs}` : '';
    return get<Project[]>(`/api/projects${query}`);
  },
  getById: (id: string) => get<Project>(`/api/projects/${id}`),
  create: (data: CreateProjectRequest) => post<Project>('/api/projects', data),
  update: (id: string, data: Partial<CreateProjectRequest>) => put<Project>(`/api/projects/${id}`, data),
  delete: (id: string) => del(`/api/projects/${id}`),
  getMembers: (id: string) => get<ProjectMember[]>(`/api/projects/${id}/members`),
  addMember: (id: string, data: { userId: string; role?: string }) =>
    post<ProjectMember>(`/api/projects/${id}/members`, data),
  removeMember: (id: string, userId: string) =>
    del(`/api/projects/${id}/members/${userId}`),
  getProgress: (id: string) => get<ProjectProgress>(`/api/projects/${id}/progress`),
  getActivity: (id: string, limit = 50) =>
    get<ActivityLog[]>(`/api/projects/${id}/activity?limit=${limit}`),
};

// ── Orders ────────────────────────────────────────────────────────────────────

export const ordersApi = {
  getAll: (params?: { status?: string; projectId?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.projectId) qs.set('projectId', params.projectId);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString() ? `?${qs}` : '';
    return get<Order[]>(`/api/orders${query}`);
  },
  getById: (id: string) => get<Order>(`/api/orders/${id}`),
  getByProject: (projectId: string, status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return get<Order[]>(`/api/orders/project/${projectId}${qs}`);
  },
  create: (data: CreateOrderRequest) => post<Order>('/api/orders', data),
  update: (id: string, data: Partial<UpdateOrderRequest>) => put<Order>(`/api/orders/${id}`, data),
  delete: (id: string) => del(`/api/orders/${id}`),
  submit: (id: string) => post<Order>(`/api/orders/${id}/submit`),
  approve: (id: string, notes?: string) => post<Order>(`/api/orders/${id}/approve`, { notes }),
  reject: (id: string, reason: string) => post<Order>(`/api/orders/${id}/reject`, { reason }),
  updateStatus: (id: string, status: string, notes?: string) =>
    post<Order>(`/api/orders/${id}/status`, { status, notes }),
};

// ── SKUs ──────────────────────────────────────────────────────────────────────

export const skusApi = {
  getAll: (params?: {
    search?: string;
    isActive?: boolean;
    category?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.isActive !== undefined) qs.set('isActive', String(params.isActive));
    if (params?.category) qs.set('category', params.category);
    if (params?.sortBy) qs.set('sortBy', params.sortBy);
    if (params?.sortOrder) qs.set('sortOrder', params.sortOrder);
    const query = qs.toString() ? `?${qs}` : '';
    return get<SKU[]>(`/api/skus${query}`);
  },
  getById: (id: string) => get<SKU>(`/api/skus/${id}`),
  create: (data: CreateSKURequest) => post<SKU>('/api/skus', data),
  update: (id: string, data: Partial<CreateSKURequest>) => put<SKU>(`/api/skus/${id}`, data),
  delete: (id: string) => del(`/api/skus/${id}`),
};

// ── Inventory ─────────────────────────────────────────────────────────────────

export const inventoryApi = {
  getAll: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : '';
    return get<ProjectInventoryItem[]>(`/api/inventory${qs}`);
  },
  getByProject: (projectId: string) =>
    get<ProjectInventoryItem[]>(`/api/inventory/project/${projectId}`),
  getTransactions: (projectId?: string, skuId?: string, limit = 100) => {
    const qs = new URLSearchParams();
    if (projectId) qs.set('projectId', projectId);
    if (skuId) qs.set('skuId', skuId);
    qs.set('limit', String(limit));
    return get<InventoryTransaction[]>(`/api/inventory/transactions?${qs}`);
  },
  createTransaction: (data: CreateInventoryTransactionRequest) =>
    post<InventoryTransaction>('/api/inventory/transactions', data),
};

// ── Company Assets ────────────────────────────────────────────────────────────

export const companyAssetsApi = {
  getAll: (params?: { search?: string; assetType?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.assetType) qs.set('assetType', params.assetType);
    const query = qs.toString() ? `?${qs}` : '';
    return get<CompanyAsset[]>(`/api/company-assets${query}`);
  },
  getById: (id: string) => get<CompanyAsset>(`/api/company-assets/${id}`),
  create: (data: CreateCompanyAssetRequest) => post<CompanyAsset>('/api/company-assets', data),
  update: (id: string, data: Partial<CreateCompanyAssetRequest>) =>
    put<CompanyAsset>(`/api/company-assets/${id}`, data),
  delete: (id: string) => del(`/api/company-assets/${id}`),
  getBorrows: (id: string) => get<BorrowTransaction[]>(`/api/company-assets/${id}/borrows`),
  getAllBorrows: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : '';
    return get<BorrowTransaction[]>(`/api/company-assets/borrow-transactions${qs}`);
  },
  borrow: (data: BorrowRequest) => post<BorrowTransaction>('/api/company-assets/borrow', data),
  returnAsset: (txnId: string, data: ReturnRequest) =>
    post<BorrowTransaction>(`/api/company-assets/borrow-transactions/${txnId}/return`, data),
};

// ── Quotations ────────────────────────────────────────────────────────────────

export const quotationsApi = {
  getAll: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : '';
    return get<ProjectQuotation[]>(`/api/quotations${qs}`);
  },
  getById: (id: string) => get<ProjectQuotation>(`/api/quotations/${id}`),
  create: (data: CreateQuotationRequest) => post<ProjectQuotation>('/api/quotations', data),
  delete: (id: string) => del(`/api/quotations/${id}`),
  updateItem: (quotationId: string, itemId: string, data: Partial<QuotationItem>) =>
    put<QuotationItem>(`/api/quotations/${quotationId}/items/${itemId}`, data),
  getChangeRequests: (projectId?: string, status?: string) => {
    const qs = new URLSearchParams();
    if (projectId) qs.set('projectId', projectId);
    if (status) qs.set('status', status);
    return get<QuotationChangeRequest[]>(`/api/quotations/change-requests?${qs}`);
  },
  createChangeRequest: (data: CreateChangeRequestPayload) =>
    post<QuotationChangeRequest>('/api/quotations/change-requests', data),
  reviewChangeRequest: (id: string, data: { status: string; reviewRemarks?: string }) =>
    put<QuotationChangeRequest>(`/api/quotations/change-requests/${id}`, data),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  getAll: (unreadOnly = false) => {
    const qs = unreadOnly ? '?unreadOnly=true' : '';
    return get<Notification[]>(`/api/notifications${qs}`);
  },
  markRead: (id: string) => put(`/api/notifications/${id}/read`),
  markAllRead: () => put('/api/notifications/read-all'),
  delete: (id: string) => del(`/api/notifications/${id}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: () => get<DashboardStats>('/api/dashboard/stats'),
};

// ── File Upload ───────────────────────────────────────────────────────────────

export const filesApi = {
  upload: async (file: File): Promise<ApiResponse<{ fileUrl: string; fileName: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    const token = _accessToken;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, message: body.message || `HTTP ${res.status}` };
    }
    const json = await res.json() as ApiResponse<{ fileUrl: string; fileName: string }>;
    // Prefix relative path with API base so frontend can load the image
    if (json.success && json.data && json.data.fileUrl.startsWith('/')) {
      json.data.fileUrl = `${API_BASE}${json.data.fileUrl}`;
    }
    return json;
  },
};

// ── Tracking Assignments ──────────────────────────────────────────────────────

export const trackingApi = {
  getAssignments: (orderId: string) =>
    get<TrackingAssignmentDto[]>(`/api/orders/${orderId}/tracking-assignments`),
  saveAssignments: (orderId: string, data: SaveTrackingRequest) =>
    post<TrackingAssignmentDto[]>(`/api/orders/${orderId}/tracking-assignments`, data),
  markArrived: (orderId: string, assignmentId: string) =>
    put<TrackingAssignmentDto>(`/api/orders/${orderId}/tracking-assignments/${assignmentId}/arrived`, {}),
  holdDriver: (orderId: string, assignmentId: string, remarks?: string) =>
    put<TrackingAssignmentDto>(`/api/orders/${orderId}/tracking-assignments/${assignmentId}/hold`, { remarks }),
  resumeDriver: (orderId: string, assignmentId: string, remarks?: string) =>
    put<TrackingAssignmentDto>(`/api/orders/${orderId}/tracking-assignments/${assignmentId}/resume`, { remarks }),
  saveRemarks: (orderId: string, assignmentId: string, remarks?: string) =>
    put<TrackingAssignmentDto>(`/api/orders/${orderId}/tracking-assignments/${assignmentId}/remarks`, { remarks }),
  saveReceiverEvidence: (orderId: string, assignmentId: string, evidence: TrackingEvidenceItem[]) =>
    put<TrackingAssignmentDto>(`/api/orders/${orderId}/tracking-assignments/${assignmentId}/receiver-evidence`, { evidence }),
};

// ── Audit Logs ────────────────────────────────────────────────────────────────

export const auditLogsApi = {
  log: (data: {
    tableName: string;
    recordId?: string;
    action: string;
    oldValues?: string;
    newValues?: string;
    userId?: string;
  }) => post('/api/audit-logs', data),
  getForOrder: (orderId: string) =>
    get<ActivityLog[]>(`/api/audit-logs?tableName=orders&recordId=${orderId}`),
};

// ══════════════════════════════════════════════════════════════════════════════
// TypeScript interfaces matching the backend DTOs
// ══════════════════════════════════════════════════════════════════════════════

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: UserSession;
}

export interface UserSession {
  id: string;
  email: string;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
  phone?: string;
  smsOptIn: boolean;
  isActive: boolean;
  roles: string[];
  companyId?: string;
  companyName?: string;
}

export interface User {
  id: string;
  email: string;
  fullName?: string;
  username?: string;
  address?: string;
  phone?: string;
  avatarUrl?: string;
  smsOptIn: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  roles: string[];
  companyId?: string;
  companyName?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  username?: string;
  phone?: string;
  address?: string;
  smsOptIn?: boolean;
  role?: string;
  companyId?: string;
}

export interface UpdateUserRequest {
  fullName?: string;
  username?: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  smsOptIn?: boolean;
  isActive?: boolean;
  companyId?: string;
}

export interface Project {
  id: string;
  name: string;
  code?: string;
  location?: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  projectManagerId?: string;
  projectManagerName?: string;
  estimatedCost?: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  memberCount: number;
}

export interface CreateProjectRequest {
  name: string;
  code?: string;
  location?: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  projectManagerId?: string;
  estimatedCost?: number;
  isHidden?: boolean;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role?: string;
  createdAt: string;
  userFullName?: string;
  userEmail?: string;
  userUsername?: string;
  userAvatarUrl?: string;
}

export interface ProjectProgress {
  projectId: string;
  projectName: string;
  hasQuotation: boolean;
  materials: MaterialProgress[];
  overallProgress: number;
}

export interface MaterialProgress {
  quotationItemId: string;
  materialName: string;
  unit?: string;
  totalQuantity: number;
  receivedQuantity: number;
  progressPercent: number;
}

export interface ActivityLog {
  id: string;
  tableName: string;
  action: string;
  createdAt: string;
  userName?: string;
  oldValues?: string;
  newValues?: string;
}

export interface Order {
  id: string;
  projectId: string;
  projectName?: string;
  orderNumber: string;
  orderType?: string;
  status: string;
  supplierName?: string;
  supplierContact?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  totalAmount?: number;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  onTransitAt?: string;
  deliveredAt?: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  skuId: string;
  skuCode?: string;
  skuName?: string;
  unit?: string;
  quotationItemId?: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice?: number;
  notes?: string;
  createdAt: string;
}

export interface CreateOrderRequest {
  projectId: string;
  orderType?: string;
  supplierName?: string;
  supplierContact?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  items: {
    skuId?: string;
    materialName?: string;
    unit?: string;
    quotationItemId?: string;
    quantityOrdered: number;
    unitPrice?: number;
    notes?: string;
  }[];
}

export interface UpdateOrderRequest {
  supplierName?: string;
  supplierContact?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  status?: string;
}

export interface SKU {
  id: string;
  skuCode: string;
  name: string;
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  brand?: string;
  specifications?: string;
  defaultMinThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSKURequest {
  skuCode: string;
  name: string;
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  brand?: string;
  specifications?: string;
  defaultMinThreshold?: number;
  isActive?: boolean;
}

export interface ProjectInventoryItem {
  id: string;
  projectId: string;
  projectName?: string;
  skuId: string;
  skuCode?: string;
  skuName?: string;
  unit?: string;
  onHand: number;
  reserved: number;
  minThreshold: number;
  locationInSite?: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  projectId: string;
  projectName?: string;
  skuId: string;
  skuName?: string;
  skuCode?: string;
  transactionType: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface CreateInventoryTransactionRequest {
  projectId: string;
  skuId: string;
  transactionType: string;
  quantity: number;
  transferProjectId?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}

export interface CompanyAsset {
  id: string;
  assetName: string;
  assetType?: string;
  assetCode?: string;
  unit?: string;
  totalQuantity: number;
  condition?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  borrowedQuantity: number;
  availableQuantity: number;
}

export interface CreateCompanyAssetRequest {
  assetName: string;
  assetType?: string;
  assetCode?: string;
  unit?: string;
  totalQuantity?: number;
  condition?: string;
  notes?: string;
}

export interface BorrowTransaction {
  id: string;
  assetId: string;
  assetName?: string;
  projectId?: string;
  projectName?: string;
  borrowedQty: number;
  borrowedBy?: string;
  borrowedByName?: string;
  borrowedAt: string;
  expectedReturnDate?: string;
  returnedQty: number;
  returnedAt?: string;
  returnRemarks?: string;
  status: string;
  createdAt: string;
}

export interface BorrowRequest {
  assetId: string;
  projectId?: string;
  quantity: number;
  expectedReturnDate?: string;
}

export interface ReturnRequest {
  returnedQty: number;
  remarks?: string;
}

export interface ProjectQuotation {
  id: string;
  projectId: string;
  projectName?: string;
  createdBy?: string;
  createdByName?: string;
  notes?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  items: QuotationItem[];
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  materialName: string;
  unit?: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationRequest {
  projectId: string;
  notes?: string;
  category?: string;
  items: { materialName: string; unit?: string; quantity: number }[];
}

export interface QuotationChangeRequest {
  id: string;
  projectId: string;
  quotationId?: string;
  changeType?: string;
  status: string;
  requestedBy?: string;
  requestedByName?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewRemarks?: string;
  payload?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChangeRequestPayload {
  projectId: string;
  quotationId?: string;
  changeType?: string;
  payload?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message?: string;
  type?: string;
  referenceType?: string;
  referenceId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardStats {
  activeProjects: number;
  pendingOrders: number;
  lowStockItems: number;
  totalUsers: number;
  ordersByStatus: { status: string; count: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    projectName?: string;
    supplierName?: string;
    createdAt: string;
  }[];
}

export interface TrackingMaterialDto {
  id: string;
  orderItemId: string;
  skuName?: string;
  unit?: string;
  assignedQuantity: number;
  quantityOrdered: number;
}

export interface TrackingEvidenceItem {
  fileUrl: string;
  fileName: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

export interface TrackingAssignmentDto {
  id: string;
  orderId: string;
  driverUserId: string;
  driverName?: string;
  driverEmail: string;
  plateNumber: string;
  trackingReference?: string;
  notes?: string;
  trackingStatus: string;
  arrivedAt?: string;
  holdRemarks?: string;
  heldAt?: string;
  resumeRemarks?: string;
  resumedAt?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  materials: TrackingMaterialDto[];
  evidence: TrackingEvidenceItem[];
  receiverEvidence: TrackingEvidenceItem[];
}

export interface SaveTrackingRequest {
  assignments: {
    driverUserId: string;
    plateNumber: string;
    trackingReference?: string;
    notes?: string;
    materials: { orderItemId: string; assignedQuantity: number }[];
    evidence?: TrackingEvidenceItem[];
  }[];
}

// ── Company interfaces ───────────────────────────────────────────────────────

export interface CompanyListItem {
  id: string;
  name: string;
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
}

export interface CreateCompanyRequest {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}
