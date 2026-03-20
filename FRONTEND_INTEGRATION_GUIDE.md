# Frontend Integration Guide: Migrating from Supabase to .NET API

This guide provides step-by-step instructions for updating the frontend to use the new .NET backend API instead of Supabase.

## Table of Contents
1. [Setup](#setup)
2. [AuthContext Migration](#authcontext-migration)
3. [Component Pattern Updates](#component-pattern-updates)
4. [Page-by-Page Migration](#page-by-page-migration)
5. [Testing Strategy](#testing-strategy)

---

## Setup

### 1. Environment Configuration

**File**: `.env` (in root directory)

```env
VITE_API_BASE_URL=http://localhost:7069
VITE_APP_NAME=BuildTrack
```

For production:
```env
VITE_API_BASE_URL=https://api.buildtrack.com
```

### 2. Update package.json

Remove Supabase dependency:
```bash
npm uninstall @supabase/supabase-js
npm install
```

### 3. Verify API Client Import

The following file already exists and is ready to use: `src/services/api.ts`

Test the import in any component:
```typescript
import { apiClient } from '@/services/api';
```

---

## AuthContext Migration

### Previous (Supabase)
```typescript
// src/contexts/AuthContext.tsx (OLD)
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return data.session;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Updated (.NET API)
```typescript
// src/contexts/AuthContext.tsx (NEW)
import { createContext, useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/services/api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  username: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  isAuthenticated: boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user on mount if token exists
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          apiClient.setToken(token);
          const currentUser = await apiClient.getCurrentUser();
          setUser(currentUser);
        } catch (err) {
          // Token invalid or expired
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          apiClient.clearToken();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      const response = await apiClient.login(email, password);
      
      // Store tokens
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      apiClient.setToken(response.accessToken);

      // Set user
      setUser({
        id: response.userId,
        email: response.email,
        fullName: response.fullName,
        username: '',
        roles: response.roles,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      apiClient.clearToken();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) return false;

      const response = await apiClient.refreshToken(refreshToken);
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      apiClient.setToken(response.accessToken);

      return true;
    } catch (err) {
      // Refresh failed, clear auth
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      apiClient.clearToken();
      setUser(null);
      return false;
    }
  }, []);

  const hasRole = useCallback((role: string) => {
    return user?.roles.includes(role) ?? false;
  }, [user]);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    refresh,
    isAuthenticated: !!user,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

Import at the top of file:
```typescript
import { createContext, useContext } from 'react';
```

---

## Component Pattern Updates

### Pattern 1: Loading User Data (OLD → NEW)

**OLD (Supabase)**:
```typescript
// Fetch user by ID
const { data, error } = await supabase
  .from('users')
  .select()
  .eq('id', userId)
  .single();
```

**NEW (.NET API)**:
```typescript
// Fetch user by ID
const user = await apiClient.getUser(userId);
```

---

### Pattern 2: Creating Records (OLD → NEW)

**OLD (Supabase)**:
```typescript
const { data, error } = await supabase
  .from('projects')
  .insert([
    {
      name: 'Project Name',
      code: 'PRJ-001',
      status: 'active',
    }
  ])
  .select();
```

**NEW (.NET API)**:
```typescript
const project = await apiClient.createProject({
  name: 'Project Name',
  code: 'PRJ-001',
  location: 'Location',
  description: 'Description',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
  estimatedCost: 0,
  initialMemberIds: [],
});
```

---

### Pattern 3: Pagination (OLD → NEW)

**OLD (Supabase)**:
```typescript
const { data, count } = await supabase
  .from('projects')
  .select('*', { count: 'exact' })
  .range(0, 9);
```

**NEW (.NET API)**:
```typescript
const response = await apiClient.getAllProjects({
  page: 1,
  pageSize: 10,
});
// response.data, response.total, response.totalPages
```

---

### Pattern 4: Real-time Subscriptions (OLD → NEW)

**OLD (Supabase)**:
```typescript
const subscription = supabase
  .from('orders')
  .on('*', (payload) => {
    console.log('Order updated:', payload.new);
  })
  .subscribe();
```

**NEW (.NET API)** - Use polling with React Query:
```typescript
import { useQuery } from '@tanstack/react-query';

export function useOrders(projectId: string) {
  return useQuery({
    queryKey: ['orders', projectId],
    queryFn: () => apiClient.getOrdersByProject(projectId),
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

// In component:
const { data: orders, isLoading } = useOrders(projectId);
```

---

## Page-by-Page Migration

### 1. Login Page

**File**: `src/pages/Login.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Login() {
  const navigate = useNavigate();
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setLocalError(error || 'Login failed');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleLogin} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">BuildTrack Login</h1>
        
        {localError && (
          <div className="bg-red-50 text-red-700 p-3 rounded">
            {localError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@buildtrack.local"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Logging in...' : 'Login'}
        </Button>

        <p className="text-center text-sm text-gray-600">
          Demo: admin@buildtrack.local / Admin123!@#
        </p>
      </form>
    </div>
  );
}
```

---

### 2. Dashboard Page

**File**: `src/pages/Dashboard.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/api';
import { Spinner } from '@/components/ui/spinner';
import { Card } from '@/components/ui/card';

export function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getAllProjects({ page: 1, pageSize: 10 });
        setProjects(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  if (loading) return <Spinner />;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p>Welcome, {user?.fullName}!</p>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600">Total Projects</h3>
          <p className="text-2xl font-bold">{projects.length}</p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600">Active Projects</h3>
          <p className="text-2xl font-bold">
            {projects.filter((p: any) => p.status === 'active').length}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600">Your Role</h3>
          <p className="text-2xl font-bold">{user?.roles[0]}</p>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Projects</h2>
        <div className="space-y-2">
          {projects.slice(0, 5).map((project: any) => (
            <Card key={project.id} className="p-4">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-sm text-gray-600">{project.location}</p>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                  {project.status}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

### 3. Projects Page

**File**: `src/pages/Projects.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getAllProjects({ page, pageSize });
        setProjects(response.data);
        setTotal(response.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [page, pageSize]);

  if (loading) return <Spinner />;
  if (error) return <div className="text-red-600">{error}</div>;

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Project Name' },
    { key: 'location', label: 'Location' },
    { key: 'status', label: 'Status' },
    { key: 'startDate', label: 'Start Date', render: (date: string) => new Date(date).toLocaleDateString() },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, project: any) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/projects/${project.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Projects</h1>
        {user?.roles.includes('admin') && (
          <Button onClick={() => navigate('/projects/new')}>
            New Project
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={projects}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
```

---

### 4. Orders Page

**File**: `src/pages/Orders.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '@/services/api';
import { DataTable } from '@/components/common/DataTable';
import { Spinner } from '@/components/ui/spinner';

export function Orders() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!projectId) return;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getOrdersByProject(projectId, {
          page,
          pageSize: 10,
        });
        setOrders(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [projectId, page]);

  if (!projectId) {
    return <div className="text-yellow-600">Select a project to view orders</div>;
  }

  if (loading) return <Spinner />;
  if (error) return <div className="text-red-600">{error}</div>;

  const columns = [
    { key: 'orderNumber', label: 'Order #' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'totalAmount', label: 'Amount', render: (amount: number) => `$${amount.toFixed(2)}` },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Date', render: (date: string) => new Date(date).toLocaleDateString() },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Orders</h1>
      <DataTable columns={columns} data={orders} />
    </div>
  );
}
```

---

### 5. Settings Page (User Profile)

**File**: `src/pages/Settings.tsx`

```typescript
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export function Settings() {
  const { user, logout } = useAuth();
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    address: user?.address || '',
    smsOptIn: false,
    emailOptIn: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await apiClient.updateUser(user!.id, {
        fullName: formData.fullName,
        phone: formData.phone,
        address: formData.address,
        smsOptIn: formData.smsOptIn,
        emailOptIn: formData.emailOptIn,
      });
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Profile Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
        
        {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-4">{success}</div>}
        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input type="email" value={user?.email} disabled />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <Input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone</label>
            <Input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Address</label>
            <Input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="emailOptIn"
              name="emailOptIn"
              checked={formData.emailOptIn}
              onChange={handleChange}
            />
            <label htmlFor="emailOptIn">Opt-in to email notifications</label>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Card>

      {/* Account Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Account</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => window.location.href = '/change-password'}>
            Change Password
          </Button>
          <Button variant="destructive" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

---

## Testing Strategy

### 1. Unit Test Example

**File**: `src/services/__tests__/api.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from '@/services/api';

describe('apiClient', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
  });

  it('should set and clear token', () => {
    const token = 'test-jwt-token';
    apiClient.setToken(token);
    expect(localStorage.getItem('accessToken')).toBe(token);

    apiClient.clearToken();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('should handle login with valid credentials', async () => {
    const response = await apiClient.login(
      'admin@buildtrack.local',
      'Admin123!@#'
    );
    
    expect(response).toHaveProperty('accessToken');
    expect(response).toHaveProperty('refreshToken');
    expect(response).toHaveProperty('userId');
  });

  it('should throw error on invalid credentials', async () => {
    expect(async () => {
      await apiClient.login('invalid@example.com', 'wrongpassword');
    }).rejects.toThrow();
  });
});
```

### 2. Integration Test Example

**File**: `src/__tests__/login.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Login } from '@/pages/Login';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';

describe('Login Flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should login successfully with valid credentials', async () => {
    const { getByRole, getByPlaceholderText } = render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>
    );

    const emailInput = getByPlaceholderText('admin@buildtrack.local');
    const passwordInput = getByPlaceholderText('••••••••');
    const submitButton = getByRole('button', { name: /Login/i });

    fireEvent.change(emailInput, { target: { value: 'admin@buildtrack.local' } });
    fireEvent.change(passwordInput, { target: { value: 'Admin123!@#' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(localStorage.getItem('accessToken')).toBeTruthy();
    });
  });
});
```

### 3. E2E Test Example (Playwright)

**File**: `e2e/login.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('should login and navigate to dashboard', async ({ page }) => {
  await page.goto('http://localhost:5173/login');

  // Fill login form
  await page.fill('input[type="email"]', 'admin@buildtrack.local');
  await page.fill('input[type="password"]', 'Admin123!@#');

  // Submit form
  await page.click('button:has-text("Login")');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard');
  expect(page.url()).toContain('/dashboard');

  // Check welcome message
  const heading = page.locator('h1');
  await expect(heading).toContainText('Dashboard');
});
```

---

## Common Issues & Solutions

### Issue 1: "401 Unauthorized" on API Calls

**Cause**: Token expired or invalid

**Solution**:
```typescript
// In apiClient, implement auto-refresh:
private async handleUnauthorized() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (refreshToken) {
    try {
      const response = await this.refreshToken(refreshToken);
      this.setToken(response.accessToken);
      return true;
    } catch {
      this.clearToken();
      window.location.href = '/login';
      return false;
    }
  }
  return false;
}
```

### Issue 2: CORS Error

**Cause**: API URL misconfigured

**Solution**: 
- Check `.env` has correct `VITE_API_BASE_URL`
- Verify backend CORS policy includes your frontend origin
- In production, update `appsettings.json` CORS AllowedOrigins

### Issue 3: TypeScript Errors with API Response

**Cause**: Type mismatch between API response and expected interface

**Solution**: 
- Import types from `@/services/api`
- Use proper type assertions:
```typescript
const projects = await apiClient.getAllProjects({ page: 1, pageSize: 10 });
const typedProjects: PaginatedResponse<ProjectDto> = projects;
```

---

## Migration Checklist

- [ ] Update `.env` with `VITE_API_BASE_URL`
- [ ] Move `src/services/api.ts` to project (already created)
- [ ] Update `src/contexts/AuthContext.tsx` with new JWT-based implementation
- [ ] Update `src/pages/Login.tsx` to use new auth context
- [ ] Update `src/pages/Dashboard.tsx` to use apiClient
- [ ] Update `src/pages/Projects.tsx` to use apiClient
- [ ] Update `src/pages/Orders.tsx` to use apiClient
- [ ] Update all other pages (Users, Inventory, Reports, etc.)
- [ ] Remove Supabase imports from all components
- [ ] Remove `src/integrations/supabase/` folder
- [ ] Remove `@supabase/supabase-js` from `package.json`
- [ ] Run `npm install` to update dependencies
- [ ] Test login flow
- [ ] Test create/read/update operations
- [ ] Test pagination
- [ ] Test error handling
- [ ] Update tests with new apiClient
- [ ] Test in development environment
- [ ] Test in production build (`npm run build`)
- [ ] Deploy backend to production
- [ ] Update production environment variables
- [ ] Deploy frontend to production

---

## Next Steps

1. **Review API Documentation**: Read `API_DOCUMENTATION.md` for complete endpoint reference
2. **Backend Setup**: Follow backend README to run API locally
3. **Incremental Migration**: Migrate one page at a time
4. **Testing**: Run unit and integration tests after each component update
5. **Performance**: Monitor API response times and network requests
6. **Deployment**: Use CI/CD pipeline for both backend and frontend

---

## Support Resources

- Backend API Docs: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- Backend Setup: [backend/README.md](./backend/README.md)
- Migration Overview: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- Database Schema: [database-scripts/CreateDatabase.sql](./database-scripts/CreateDatabase.sql)
