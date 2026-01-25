import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Package,
  ClipboardList,
  Users,
  Activity,
  MapPin,
  Calendar,
  Pencil,
  ShoppingCart,
  Clock,
  ChevronsUpDown,
} from 'lucide-react';
import type { Project, ProjectInventory, Order, ProjectMember, InventoryTransaction, SKU, Profile, ProjectStatus } from '@/types/database';
import { format, differenceInDays } from 'date-fns';

// Format currency in Philippine Peso
const formatPHP = (amount: number | null | undefined) => {
  if (amount == null) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [inventory, setInventory] = useState<(ProjectInventory & { sku: SKU })[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [members, setMembers] = useState<(ProjectMember & { profile: Profile })[]>([]);
  const [transactions, setTransactions] = useState<(InventoryTransaction & { sku: SKU; creator: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAllProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name, status')
      .order('name', { ascending: true });
    setAllProjects((data || []) as Project[]);
  };

  const fetchProjectData = async () => {
    if (!id) return;

    // Fetch project
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (projectError || !projectData) {
      toast({ title: 'Error', description: 'Project not found', variant: 'destructive' });
      navigate('/projects');
      return;
    }

    setProject(projectData as Project);

    // Fetch inventory
    const { data: inventoryData } = await supabase
      .from('project_inventory')
      .select('*, sku:skus(*)')
      .eq('project_id', id);

    setInventory((inventoryData || []) as (ProjectInventory & { sku: SKU })[]);

    // Fetch orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    setOrders((ordersData || []) as Order[]);

    // Fetch members with profiles
    const { data: membersData } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', id);

    // Fetch profiles for members
    if (membersData && membersData.length > 0) {
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const membersWithProfiles = membersData.map(member => ({
        ...member,
        profile: (profilesData || []).find(p => p.id === member.user_id) || {} as Profile,
      }));
      setMembers(membersWithProfiles as (ProjectMember & { profile: Profile })[]);
    } else {
      setMembers([]);
    }

    // Fetch recent transactions
    const { data: transactionsData } = await supabase
      .from('inventory_transactions')
      .select('*, sku:skus(*)')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Fetch creators for transactions
    if (transactionsData && transactionsData.length > 0) {
      const creatorIds = [...new Set(transactionsData.map(t => t.created_by))];
      const { data: creatorsData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', creatorIds);

      const transactionsWithCreators = transactionsData.map(tx => ({
        ...tx,
        creator: (creatorsData || []).find(p => p.id === tx.created_by) || {} as Profile,
      }));
      setTransactions(transactionsWithCreators as (InventoryTransaction & { sku: SKU; creator: Profile })[]);
    } else {
      setTransactions([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAllProjects();
    fetchProjectData();
  }, [id, navigate, toast]);

  const handleEditSubmit = async (data: {
    name: string;
    description?: string;
    location: string;
    estimated_cost: number;
    start_date: string;
    end_date: string;
    status: ProjectStatus;
  }) => {
    if (!project) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: data.name,
          description: data.description || null,
          location: data.location,
          estimated_cost: data.estimated_cost,
          start_date: data.start_date,
          end_date: data.end_date,
          status: data.status,
        })
        .eq('id', project.id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Project updated successfully' });
      setIsEditDialogOpen(false);
      fetchProjectData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOrders = () => {
    toast({
      title: 'Coming Soon',
      description: 'Order management functionality is coming soon!',
    });
  };

  const handleProjectSwitch = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const getDurationDisplay = () => {
    if (!project) return '—';
    if (project.start_date && project.end_date) {
      const days = differenceInDays(new Date(project.end_date), new Date(project.start_date));
      return `${days} days`;
    }
    return '—';
  };

  const getDateRangeDisplay = () => {
    if (!project) return '—';
    if (project.start_date && project.end_date) {
      const start = format(new Date(project.start_date), 'MMM dd, yyyy');
      const end = format(new Date(project.end_date), 'MMM dd, yyyy');
      return `${start} – ${end}`;
    }
    return 'No dates set';
  };

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const getInventoryStatus = (item: ProjectInventory) => {
    if (item.on_hand <= 0) return 'critical';
    if (item.min_threshold && item.on_hand <= item.min_threshold) return 'low';
    return 'ok';
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header with Project Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Project Switcher Dropdown */}
        <div className="flex-1 min-w-0">
          <Select value={project.id} onValueChange={handleProjectSwitch}>
            <SelectTrigger className="w-full max-w-xs bg-background">
              <div className="flex items-center gap-2">
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Select project" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover z-50 max-h-64">
              {allProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          {isAdmin() && (
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Project Title and Description */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
        {project.description && (
          <p className="mt-1 text-muted-foreground">{project.description}</p>
        )}
      </div>

      {/* Project Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium truncate">{project.location || 'Not set'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-success/10 p-2">
              <span className="text-success font-bold text-lg">₱</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Estimated Cost</p>
              <p className="font-medium">{formatPHP(project.estimated_cost)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-accent/10 p-2">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-medium">{getDurationDisplay()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Date Range</p>
              <p className="font-medium text-sm">{getDateRangeDisplay()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-warning/10 p-2">
              <ClipboardList className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Open Orders</p>
              <p className="font-medium">
                {orders.filter((o) => !['closed', 'cancelled'].includes(o.status)).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Check Orders Button */}
      <div className="flex justify-end">
        <Button onClick={handleCheckOrders}>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Check Orders
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Project Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              {inventory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                        <th className="pb-3 pr-4">SKU</th>
                        <th className="pb-3 pr-4">Item Name</th>
                        <th className="pb-3 pr-4">On Hand</th>
                        <th className="pb-3 pr-4">Reserved</th>
                        <th className="pb-3 pr-4">Available</th>
                        <th className="pb-3 pr-4">Min Threshold</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {inventory.map((item) => (
                        <tr key={item.id} className="text-sm">
                          <td className="py-3 pr-4 font-mono text-xs">
                            {item.sku?.sku_code}
                          </td>
                          <td className="py-3 pr-4 font-medium">{item.sku?.name}</td>
                          <td className="py-3 pr-4">{item.on_hand}</td>
                          <td className="py-3 pr-4">{item.reserved}</td>
                          <td className="py-3 pr-4">{item.on_hand - item.reserved}</td>
                          <td className="py-3 pr-4">{item.min_threshold || '-'}</td>
                          <td className="py-3">
                            <StatusBadge status={getInventoryStatus(item)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  No inventory items assigned to this project yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Project Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                        <th className="pb-3 pr-4">Order #</th>
                        <th className="pb-3 pr-4">Supplier</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 pr-4">Expected Delivery</th>
                        <th className="pb-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orders.map((order) => (
                        <tr
                          key={order.id}
                          className="cursor-pointer text-sm hover:bg-muted/50"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          <td className="py-3 pr-4 font-medium">{order.order_number}</td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {order.supplier_name || '-'}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {order.expected_delivery_date
                              ? format(new Date(order.expected_delivery_date), 'MMM dd, yyyy')
                              : '-'}
                          </td>
                          <td className="py-3 text-right">
                            {order.total_amount ? formatPHP(order.total_amount) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  No orders for this project yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              {members.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-lg border p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {member.profile?.full_name?.charAt(0) ||
                          member.profile?.email?.charAt(0) ||
                          'U'}
                      </div>
                      <div>
                        <p className="font-medium">
                          {member.profile?.full_name || 'Unknown User'}
                        </p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {member.role.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  No team members assigned yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length > 0 ? (
                <div className="space-y-4">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-start gap-4 rounded-lg border p-4"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                        <Activity className="h-4 w-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {tx.transaction_type.replace('_', ' ').toUpperCase()}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {tx.sku?.name} • Qty: {tx.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          By {tx.creator?.full_name || 'Unknown'} •{' '}
                          {format(new Date(tx.created_at), 'MMM dd, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  No recent activity.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProjectFormModal
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        project={project}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
