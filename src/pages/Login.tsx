import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { HardHat, Loader2 } from 'lucide-react';
import { companiesApi, type CompanyListItem } from '@/lib/apiClient';

export default function Login() {
  const { user, signIn, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load companies on mount
  useEffect(() => {
    companiesApi.getList()
      .then(res => {
        if (res.success && res.data) {
          setCompanies(res.data);
          // Auto-select if only one company
          if (res.data.length === 1) {
            setCompanyId(res.data[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCompanies(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Pass companyId (empty string means no company selected — super_admin can skip)
    const { error } = await signIn(loginId.trim(), password, companyId || undefined);

    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/dashboard');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <HardHat className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">BuildTrack</h1>
          <p className="text-muted-foreground">
            Construction Inventory & Order Tracking System
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <h2 className="text-center text-lg font-semibold">Sign In</h2>
          </CardHeader>
          <form onSubmit={handleSignIn}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                {loadingCompanies ? (
                  <div className="flex items-center gap-2 h-10 px-3 text-sm text-muted-foreground border rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading companies...
                  </div>
                ) : (
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger id="company">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  Super admins can sign in without selecting a company.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-id">Email</Label>
                <Input
                  id="login-id"
                  type="email"
                  placeholder="Enter email"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
