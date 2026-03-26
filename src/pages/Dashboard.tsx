import { useEffect, useState } from "react";
import { dashboardApi } from "@/lib/apiClient";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList, FolderKanban, Package, Users } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { DashboardStats } from "@/lib/apiClient";

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

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ordersByStatus, setOrdersByStatus] = useState<{ name: string; value: number; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return;
      try {
        const result = await dashboardApi.getStats();
        const data = result.data;
        if (data) {
          setStats(data);
          setOrdersByStatus(
            (data.ordersByStatus || []).map((entry) => ({
              name: entry.status.replace(/_/g, " "),
              value: entry.count,
              status: entry.status,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to load dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [user]);

  // Status-based color mapping for the pie chart
  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      rejected: "hsl(0, 72%, 51%)",
      cancelled: "hsl(0, 72%, 51%)",
      for_approval: "hsl(38, 92%, 50%)",
      approved: "hsl(210, 90%, 50%)",
      submitted: "hsl(210, 80%, 45%)",
      preparing: "hsl(220, 75%, 45%)",
      ordered: "hsl(220, 65%, 40%)",
      in_transit: "hsl(45, 93%, 47%)",
      on_hold: "hsl(38, 80%, 50%)",
      delivered: "hsl(142, 71%, 45%)",
      fully_received: "hsl(142, 71%, 45%)",
      partially_received: "hsl(38, 92%, 50%)",
      closed: "hsl(215, 16%, 47%)",
      draft: "hsl(215, 16%, 60%)",
    };
    return colorMap[status] || "hsl(270, 50%, 60%)";
  };

  const recentOrders = stats?.recentOrders ?? [];

  return (
    <div className="animate-fade-in space-y-6 overflow-x-hidden">
      <PageHeader title="Dashboard" description="Overview of your construction inventory and orders" />

      {/* Stats Grid — single column on mobile */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Projects"
          value={loading ? "..." : stats?.activeProjects ?? 0}
          icon={FolderKanban}
          variant="default"
          href="/projects?status=active"
        />
        <StatCard
          title="Pending Orders"
          value={loading ? "..." : stats?.pendingOrders ?? 0}
          icon={ClipboardList}
          variant="default"
          href="/orders"
        />
        <StatCard
          title="Stock Items"
          value={loading ? "..." : stats?.stockItems ?? 0}
          icon={Package}
          variant="default"
          href="/skus"
        />
        {isAdmin() && (
          <StatCard
            title="Total Members"
            value={loading ? "..." : stats?.totalUsers ?? 0}
            icon={Users}
            variant="default"
            href="/members"
          />
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
                        fill={getStatusColor(entry.status)}
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
                      style={{ backgroundColor: getStatusColor(entry.status) }}
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
                      <span className="font-medium">{order.orderNumber}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-muted-foreground">{order.projectName || "-"}</div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{order.supplierName || "—"}</span>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentOrders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="text-sm">
                        <td className="py-3 pr-4 font-medium">{order.orderNumber}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{order.projectName || "-"}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{order.supplierName || "-"}</td>
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
