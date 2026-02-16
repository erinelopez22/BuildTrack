import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI, usersAPI, projectsAPI, ordersAPI, skusAPI, inventoryAPI } from './api';

// Auth Hooks
export const useLogin = () => {
  return useMutation({
    mutationFn: authAPI.login,
  });
};

export const useGetProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: authAPI.getProfile,
  });
};

// Users Hooks
export const useGetAllUsers = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['users', page, limit],
    queryFn: () => usersAPI.getAllUsers(page, limit),
  });
};

export const useGetUser = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersAPI.getUserById(userId),
    enabled: !!userId,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersAPI.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersAPI.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

// Projects Hooks
export const useGetAllProjects = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['projects', page, limit],
    queryFn: () => projectsAPI.getAllProjects(page, limit),
  });
};

export const useGetProject = (projectId: string) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsAPI.getProjectById(projectId),
    enabled: !!projectId,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsAPI.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, dto }: { projectId: string; dto: any }) =>
      projectsAPI.updateProject(projectId, dto),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useGetProjectMembers = (projectId: string) => {
  return useQuery({
    queryKey: ['projectMembers', projectId],
    queryFn: () => projectsAPI.getProjectMembers(projectId),
    enabled: !!projectId,
  });
};

export const useAddProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId, role }: { projectId: string; userId: string; role: string }) =>
      projectsAPI.addProjectMember(projectId, userId, role),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
    },
  });
};

// Orders Hooks
export const useGetOrder = (orderId: string) => {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersAPI.getOrderById(orderId),
    enabled: !!orderId,
  });
};

export const useGetProjectOrders = (projectId: string, page = 1, limit = 10) => {
  return useQuery({
    queryKey: ['orders', projectId, page, limit],
    queryFn: () => ordersAPI.getOrdersByProject(projectId, page, limit),
    enabled: !!projectId,
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ordersAPI.createOrder,
    onSuccess: (_, { project_id }) => {
      queryClient.invalidateQueries({ queryKey: ['orders', project_id] });
    },
  });
};

export const useApproveOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, approvedBy }: { orderId: string; approvedBy: string }) =>
      ordersAPI.approveOrder(orderId, approvedBy),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
};

// SKUs Hooks
export const useGetAllSKUs = (page = 1, limit = 10, activeOnly = true) => {
  return useQuery({
    queryKey: ['skus', page, limit, activeOnly],
    queryFn: () => skusAPI.getAllSKUs(page, limit, activeOnly),
  });
};

export const useGetSKU = (skuId: string) => {
  return useQuery({
    queryKey: ['sku', skuId],
    queryFn: () => skusAPI.getSKUById(skuId),
    enabled: !!skuId,
  });
};

export const useCreateSKU = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: skusAPI.createSKU,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skus'] });
    },
  });
};

export const useSearchSKUs = (searchTerm: string) => {
  return useQuery({
    queryKey: ['skuSearch', searchTerm],
    queryFn: () => skusAPI.searchSKUs(searchTerm),
    enabled: searchTerm.length > 0,
  });
};

// Inventory Hooks
export const useGetProjectInventory = (projectId: string) => {
  return useQuery({
    queryKey: ['inventory', projectId],
    queryFn: () => inventoryAPI.getProjectInventory(projectId),
    enabled: !!projectId,
  });
};

export const useGetSKUInventory = (projectId: string, skuId: string) => {
  return useQuery({
    queryKey: ['inventory', projectId, skuId],
    queryFn: () => inventoryAPI.getSKUInventory(projectId, skuId),
    enabled: !!projectId && !!skuId,
  });
};

export const useAdjustInventory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      skuId,
      quantity,
      notes,
    }: {
      projectId: string;
      skuId: string;
      quantity: number;
      notes?: string;
    }) => inventoryAPI.adjustInventory(projectId, skuId, quantity, notes),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', projectId] });
    },
  });
};

export const useTransferInventory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      skuId,
      quantity,
      targetProjectId,
      notes,
    }: {
      projectId: string;
      skuId: string;
      quantity: number;
      targetProjectId: string;
      notes?: string;
    }) =>
      inventoryAPI.transferInventory(projectId, skuId, quantity, targetProjectId, notes),
    onSuccess: (_, { projectId, targetProjectId }) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', projectId] });
      queryClient.invalidateQueries({ queryKey: ['inventory', targetProjectId] });
    },
  });
};

export const useGetInventoryTransactions = (projectId: string, page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['inventoryTransactions', projectId, page, limit],
    queryFn: () => inventoryAPI.getInventoryTransactions(projectId, page, limit),
    enabled: !!projectId,
  });
};

export const useGetLowStockItems = (projectId: string) => {
  return useQuery({
    queryKey: ['lowStockItems', projectId],
    queryFn: () => inventoryAPI.getLowStockItems(projectId),
    enabled: !!projectId,
  });
};
