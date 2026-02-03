import { useEffect, useState } from "react";
import { request } from "@/integrations/api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import type { OrderStatus } from "@/types/database";
import { ClipboardList, FolderKanban, Package, Users } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

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

/** API response (camelCase). */
interface RecentOrderRow {
  id: string;
  orderNumber: string;
  projectName?: string | null;
  status: string;
  supplierName?: string | null;
  totalAmount?: number | null;
  createdAt: string;
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    totalSkus: 0,
    activeOrders: 0,
    activeMembers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrderRow[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<{ name: string; value: number; status?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return;

      try {
        const [statsRes, ordersRes] = await Promise.all([
          request<{ activeProjects: number; totalSkus: number; activeOrders: number; activeMembers: number }>("/api/dashboard/stats"),
          request<RecentOrderRow[]>("/api/dashboard/recent-orders?limit=10"),
        ]);

        setStats({
          activeProjects: statsRes.activeProjects ?? 0,
          totalSkus: statsRes.totalSkus ?? 0,
          activeOrders: statsRes.activeOrders ?? 0,
          activeMembers: statsRes.activeMembers ?? 0,
        });

        setRecentOrders(ordersRes ?? []);

        const statusCounts: Record<string, number> = {};
        (ordersRes || []).forEach((order) => {
          statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
        });
        setOrdersByStatus(
          Object.entries(statusCounts).map(([status, value]) => ({
            name: status.replace(/_/g, " "),
            value,
            status,
          }))
        );
      } catch (e) {
        console.error("Dashboard fetch failed", e);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [user]);

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

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Dashboard" description="Overview of your construction inventory and orders" />

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
        <StatCard title="Total SKUs" value={loading ? "..." : stats.totalSkus} icon={Package} variant="default" />
        {isAdmin() && (
          <StatCard title="Active Members" value={stats.activeMembers} icon={Users} variant="default" href="/members" />
        )}
      </div>

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
                      fill={getStatusColor(entry.status ?? entry.name.replace(/ /g, "_"))}
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
                      <td className="py-3 pr-4 font-medium">{order.orderNumber}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{order.projectName ?? "-"}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={order.status as OrderStatus} />
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{order.supplierName ?? "-"}</td>
                      <td className="py-3 text-right">{order.totalAmount != null ? formatPHP(order.totalAmount) : "-"}</td>
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
