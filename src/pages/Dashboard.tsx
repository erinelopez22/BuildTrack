import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList, FolderKanban, Package, Users } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Order } from "@/types/database";

// Format currency in Philippine Peso
const formatPHP = (amount: number | null | undefined) => {
  if (amount == null) return "₱0.00";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

interface DashboardStats {
  activeProjects: number;
  totalSkus: number;
  activeOrders: number;
  activeMembers: number;
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    totalSkus: 0,
    activeOrders: 0,
    activeMembers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return;

      // Fetch active projects count
      const { count: projectCount } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .eq("is_hidden", false);

      // Fetch SKUs count
      const { count: skuCount } = await supabase
        .from("skus")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Fetch active orders count (proper count query)

      const { count: activeOrdersCount } = await supabase
        .from("orders")
        .select("*, project:projects!inner(*)", { count: "exact", head: true })
        .in("status", ["for_approval", "approved", "submitted", "delivered", "preparing", "in_transit", "on_hold"])
        .in("project.status", ["active"]);

      console.log(activeOrdersCount);

      // Fetch recent orders for the table and chart
      const { data: ordersData } = await supabase
        .from("orders")
        .select("*, project:projects(name)")
        .order("created_at", { ascending: false })
        .limit(10);

      // Count orders by status for the pie chart
      const statusCounts: Record<string, number> = {};
      (ordersData || []).forEach((order) => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      });

      // Fetch active members count (only if admin)
      let membersCount = 0;
      if (isAdmin()) {
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true);
        membersCount = count || 0;
      }

      setStats({
        activeProjects: projectCount || 0,
        totalSkus: skuCount || 0,
        activeOrders: activeOrdersCount || 0,
        activeMembers: membersCount,
      });

      setRecentOrders((ordersData || []) as unknown as Order[]);
      setOrdersByStatus(
        Object.entries(statusCounts).map(([status, value]) => ({
          name: status.replace(/_/g, " "),
          value,
          status, // Keep original status for color mapping
        })),
      );

      setLoading(false);
    }

    fetchDashboardData();
  }, [user, isAdmin]);

  // Status-based color mapping for the pie chart
  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      rejected: "hsl(0, 72%, 51%)", // Red
      cancelled: "hsl(0, 72%, 51%)", // Red
      for_approval: "hsl(38, 92%, 50%)", // Amber/Orange
      approved: "hsl(210, 90%, 50%)", // Blue
      submitted: "hsl(210, 80%, 45%)", // Blue (slightly darker)
      preparing: "hsl(220, 75%, 45%)", // Blue (darker shade)
      ordered: "hsl(220, 65%, 40%)", // Blue (darkest shade)
      in_transit: "hsl(45, 93%, 47%)", // Yellow
      on_hold: "hsl(38, 80%, 50%)", // Amber
      delivered: "hsl(142, 71%, 45%)", // Green
      fully_received: "hsl(142, 71%, 45%)", // Green
      partially_received: "hsl(38, 92%, 50%)", // Amber
      closed: "hsl(215, 16%, 47%)", // Muted gray
      draft: "hsl(215, 16%, 60%)", // Light gray
    };
    return colorMap[status] || "hsl(270, 50%, 60%)"; // Fallback purple
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Dashboard" description="Overview of your construction inventory and orders" />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Projects"
          value={stats.activeProjects}
          icon={FolderKanban}
          variant="default"
          href="/projects?status=active"
        />
        <StatCard
          title="Active Orders"
          value={stats.activeOrders}
          icon={ClipboardList}
          variant="default"
          href="/orders?status=active"
        />
        <StatCard title="Total SKUs" value={loading ? "..." : stats.totalSkus} icon={Package} variant="default" href="/skus" />
        {isAdmin() && (
          <StatCard title="Active Members" value={stats.activeMembers} icon={Users} variant="default" href="/members" />
        )}
      </div>

      {/* Orders by Status Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Orders by Status</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
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
                  {ordersByStatus.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getStatusColor((entry as any).status || entry.name.replace(/ /g, "_"))}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground">No orders yet</div>
          )}
        </CardContent>
      </Card>

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
                    <th className="pb-3 pr-4 hidden sm:table-cell">Supplier</th>
                    <th className="pb-3 text-right hidden sm:table-cell">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentOrders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="text-sm">
                      <td className="py-3 pr-4 font-medium">{order.order_number}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {(order as Order & { project?: { name: string } }).project?.name || "-"}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground hidden sm:table-cell">{order.supplier_name || "-"}</td>
                      <td className="py-3 text-right hidden sm:table-cell">{order.total_amount ? formatPHP(order.total_amount) : "-"}</td>
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
