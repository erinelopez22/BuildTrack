# Login Page Example with MSSQL Backend

This is an example of how to integrate the MSSQL backend login with your existing React components.

## Using the Backend Authentication

### Option 1: With New AuthContextBackend

```tsx
import { useAuthBackend } from '@/contexts/AuthContextBackend';

export function LoginPage() {
  const { login, loading } = useAuthBackend();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      // Redirect to dashboard
      window.location.href = '/';
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

### Option 2: Direct API Hook

```tsx
import { useLogin } from '@/hooks/useApi';
import { apiClient } from '@/lib/apiClient';

export function LoginPage() {
  const { mutate: login, isPending } = useLogin();

  const handleLogin = async (email: string, password: string) => {
    login(
      { email, password },
      {
        onSuccess: (response) => {
          apiClient.setAuthToken(response.access_token);
          localStorage.setItem('user', JSON.stringify(response.user));
          // Redirect to dashboard
          window.location.href = '/';
        },
        onError: (error) => {
          console.error('Login failed:', error);
        },
      }
    );
  };

  return (
    // Your login form JSX
  );
}
```

## Integration Steps

### 1. Update Main App

In `src/main.tsx`, wrap your app with the new auth provider:

```tsx
// Keep existing Supabase provider OR replace with:
import { AuthProviderBackend } from '@/contexts/AuthContextBackend';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProviderBackend>
        <App />
      </AuthProviderBackend>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

### 2. Update Login Components

Replace your existing login logic:

```tsx
// Before (Supabase)
const { signIn } = useAuth();
await signIn(email, password);

// After (MSSQL Backend)
const { login } = useAuthBackend();
await login(email, password);
```

### 3. Protect Routes

Use the new auth hook:

```tsx
import { useAuthBackend } from '@/contexts/AuthContextBackend';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuthBackend();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;

  return children;
}
```

### 4. Check Role-Based Access

```tsx
function OrdersPage() {
  const { canCreateOrders, canApproveOrders } = useAuthBackend();

  return (
    <div>
      {canCreateOrders() && <button>Create Order</button>}
      {canApproveOrders() && <button>View Approvals</button>}
    </div>
  );
}
```

## Default Admin Credentials

Access the app after backend migrations:
- **Email:** `admin@stockwell.com`
- **Password:** `admin123`

## Token Management

The auth system automatically:
- ✅ Stores JWT token in localStorage
- ✅ Adds token to all API requests
- ✅ Handles 401 responses by redirecting to login
- ✅ Clears token on logout

## Testing

```bash
# Start backend
cd backend && npm run dev

# Start frontend
npm run dev

# Try login with:
# Email: admin@stockwell.com
# Password: admin123
```

## Next Steps

1. Update your Login page component with one of the examples above
2. Wrap your app with `AuthProviderBackend`
3. Replace Supabase auth calls with new backend hooks
4. Test the login flow
5. Build out the dashboard and other pages using the API hooks
