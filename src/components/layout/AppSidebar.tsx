import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Package,
  ClipboardList,
  Boxes,
  Users,
  Settings,
  Bell,
  LogOut,
  HardHat,
  Wrench,
  FileCheck,
  BarChart3,
  Building2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// Full nav items - filtered by role
const allNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: "all" },
  { title: "Projects", url: "/projects", icon: FolderKanban, roles: "all" },
  {
    title: "Order & Tracking",
    url: "/inventory",
    icon: Package,
    roles: ["super_admin", "admin", "project_engineer", "checker", "warehouse_admin", "office_admin"],
  },
  {
    title: "View Orders",
    url: "/orders",
    icon: ClipboardList,
    roles: ["super_admin", "admin", "project_engineer", "checker", "warehouse_admin", "office_admin"],
  },
  {
    title: "Quotation Request",
    url: "/quotation-requests",
    icon: FileCheck,
    roles: ["super_admin", "admin", "project_engineer", "office_admin", "checker"],
  },
  {
    title: "SKU Catalog",
    url: "/skus",
    icon: Boxes,
    roles: ["super_admin", "admin", "project_engineer", "office_admin", "warehouse_admin"],
  },
  {
    title: "Equipments & Tools",
    url: "/company-assets",
    icon: Wrench,
    roles: ["super_admin", "admin", "project_engineer", "checker", "office_admin"],
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    roles: ["super_admin", "admin", "office_admin", "project_engineer"],
  },
];

const adminNavItems = [
  { title: "Users & Roles", url: "/users", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

const superAdminNavItems = [
  { title: "Companies", url: "/companies", icon: Building2 },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, isAdmin, isSuperAdmin, profile, roles, user } = useAuth();
  const { unreadCount } = useNotifications();
  const isMobile = useIsMobile();

  const isActive = (path: string) => location.pathname.startsWith(path);

  // Close mobile nav on navigation
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Filter nav items based on user roles
  const visibleNavItems = allNavItems.filter((item) => {
    if (item.roles === "all") return true;
    if (Array.isArray(item.roles)) {
      return roles.some((role) => (item.roles as string[]).includes(role));
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <HardHat className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">BuildTrack</span>
              <span className="text-xs text-sidebar-foreground/60">{user?.companyName || 'Inventory System'}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">{!collapsed && "Main Menu"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      onClick={handleNavClick}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                        isActive(item.url)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin() && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">
              {!collapsed && "Administration"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        onClick={handleNavClick}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                          isActive(item.url)
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {isSuperAdmin() && superAdminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        onClick={handleNavClick}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                          isActive(item.url)
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Notifications">
                  <NavLink
                    to="/notifications"
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                      isActive("/notifications")
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                    )}
                  >
                    <div className="relative">
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </div>
                    {!collapsed && <span>Notifications</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
            <span className="text-sm font-medium text-sidebar-accent-foreground">
              {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || "U"}
            </span>
          </div>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {profile?.full_name || "User"}
              </span>
              <span className="truncate text-xs text-sidebar-foreground/60">{profile?.email}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>

    </Sidebar>
  );
}
