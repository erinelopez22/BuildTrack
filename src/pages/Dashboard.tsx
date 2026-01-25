import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertTriangle,
  Package,
  ClipboardList,
  TruckIcon,
  FolderKanban,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Project, Order, ProjectInventory } from '@/types/database';

interface DashboardStats {
  totalProjects: number;
  lowStockItems: number;
  openOrders: number;
  deliveriesThisWeek: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    lowStockItems: 0,
    openOrders: 0,
    deliveriesThisWeek: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockByProject, setLowStockByProject] = useState<{ name: string; count: number }[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return;

      // Fetch projects count
      const { count: projectCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });

      // Fetch low stock items
      const { data: inventoryData } = await supabase
        .from('project_inventory')
        .select('*, project:projects(name), sku:skus(name)')
        .not('min_threshold', 'is', null);

      const lowStock = (inventoryData || []).filter(
        (item) => item.on_hand <= (item.min_threshold || 0)
      );

      // Fetch orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, project:projects(name)')
        .order('created_at', { ascending: false })
        .limit(10);

      const openOrderStatuses = ['draft', 'for_approval', 'approved', 'ordered', 'in_transit', 'delivered', 'partially_received'];
      const openOrders = (ordersData || []).filter((o) => openOrderStatuses.includes(o.status));

      // Count orders by status
      const statusCounts: Record<string, number> = {};
      (ordersData || []).forEach((order) => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      });

      // Count low stock by project
      const projectLowStock: Record<string, number> = {};
      lowStock.forEach((item) => {
        const projectName = item.project?.name || 'Unknown';
        projectLowStock[projectName] = (projectLowStock[projectName] || 0) + 1;
      });

      setStats({
        totalProjects: projectCount || 0,
        lowStockItems: lowStock.length,
        openOrders: openOrders.length,
        deliveriesThisWeek: 0, // Would require more complex query
      });

      setRecentOrders((ordersData || []) as Order[]);
      setLowStockByProject(
        Object.entries(projectLowStock).map(([name, count]) => ({ name, count }))
      );
      setOrdersByStatus(
        Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace('_', ' '), value }))
      );

      setLoading(false);
    }

    fetchDashboardData();
  }, [user]);

  const COLORS = ['hsl(38, 92%, 50%)', 'hsl(215, 25%, 45%)', 'hsl(142, 71%, 45%)', 'hsl(0, 72%, 51%)', 'hsl(270, 50%, 60%)'];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your construction inventory and orders"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Projects"
          value={stats.totalProjects}
          icon={FolderKanban}
          variant="default"
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStockItems}
          icon={AlertTriangle}
          variant={stats.lowStockItems > 0 ? 'warning' : 'success'}
        />
        <StatCard
          title="Open Orders"
          value={stats.openOrders}
          icon={ClipboardList}
          variant="default"
        />
        <StatCard
          title="Total SKUs"
          value={loading ? '...' : '-'}
          icon={Package}
          variant="default"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Low Stock by Project</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockByProject.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={lowStockByProject}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No low stock items
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {ordersByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No orders yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                    <th className="pb-3 pr-4">Order #</th>
                    <th className="pb-3 pr-4">Project</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Supplier</th>
                    <th className="pb-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentOrders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="text-sm">
                      <td className="py-3 pr-4 font-medium">{order.order_number}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {(order as Order & { project?: { name: string } }).project?.name || '-'}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {order.supplier_name || '-'}
                      </td>
                      <td className="py-3 text-right">
                        {order.total_amount
                          ? `$${order.total_amount.toLocaleString()}`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No orders yet. Create your first order to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}