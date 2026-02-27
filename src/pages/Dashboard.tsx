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
    <div className="animate-fade-in space-y-6 overflow-x-hidden">
      <PageHeader title="Dashboard" description="Overview of your construction inventory and orders" />

      {/* Stats Grid — single column on mobile */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <CardContent className="px-2 sm:px-6">
          {ordersByStatus.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    dataKey="value"
                    label={false}
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
                      fontSize: "0.8125rem",
                    }}
                    formatter={(value: number, name: string) => [value, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend below chart */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
                {ordersByStatus.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getStatusColor((entry as any).status || entry.name.replace(/ /g, "_")) }}
                    />
                    <span className="text-muted-foreground capitalize">{entry.name}</span>
                    <span className="font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">No orders yet</div>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders — card list on mobile, table on sm+ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <>
              {/* Mobile: card list */}
              <div className="flex flex-col gap-3 sm:hidden">
                {recentOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{order.order_number}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-muted-foreground">
                      {(order as Order & { project?: { name: string } }).project?.name || "-"}
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{order.supplier_name || "—"}</span>
                      <span className="font-medium text-foreground">
                        {order.total_amount ? formatPHP(order.total_amount) : "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block">
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
                          {(order as Order & { project?: { name: string } }).project?.name || "-"}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{order.supplier_name || "-"}</td>
                        <td className="py-3 text-right">{order.total_amount ? formatPHP(order.total_amount) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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
