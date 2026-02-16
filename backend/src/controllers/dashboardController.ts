import { Request, Response } from 'express';
import { query } from '../config/database';
import { ApiResponse } from '../dto/common.dto';

export class DashboardController {
  async getStats(req: Request, res: Response) {
    try {
      // active projects
      const projRes = await query('SELECT COUNT(*) as total FROM projects WHERE status = @status', { status: 'active' });
      const activeProjects = (projRes[0] as any)?.total || 0;

      // total skus
      const skuRes = await query('SELECT COUNT(*) as total FROM skus WHERE is_active = 1');
      const totalSkus = (skuRes[0] as any)?.total || 0;

      // active orders (joined with active projects)
      const orderStatuses = [
        'for_approval', 'approved', 'submitted', 'delivered', 'preparing', 'in_transit', 'on_hold'
      ];
      const statusParams = orderStatuses.map((s, i) => `@s${i}`).join(', ');
      const params: Record<string, any> = {};
      orderStatuses.forEach((s, i) => (params[`s${i}`] = s));

      const activeOrdersSql = `
        SELECT COUNT(*) as total FROM orders o
        JOIN projects p ON p.id = o.project_id
        WHERE o.status IN (${statusParams}) AND p.status = @projStatus
      `;
      params.projStatus = 'active';
      const activeOrdersRes = await query(activeOrdersSql, params);
      const activeOrders = (activeOrdersRes[0] as any)?.total || 0;

      // recent orders
      const recentOrdersRes = await query(`
        SELECT TOP 10 o.id, o.order_number, o.status, o.supplier_name, o.total_amount, o.created_at,
               p.id as project_id, p.name as project_name
        FROM orders o
        LEFT JOIN projects p ON p.id = o.project_id
        ORDER BY o.created_at DESC
      `);
      const recentOrders = (recentOrdersRes || []).map((r: any) => ({
        id: r.id,
        order_number: r.order_number,
        status: r.status,
        supplier_name: r.supplier_name,
        total_amount: r.total_amount,
        created_at: r.created_at,
        project: { id: r.project_id, name: r.project_name },
      }));

      // orders by status
      const byStatusRes = await query('SELECT status, COUNT(*) as count FROM orders GROUP BY status');
      const ordersByStatus = (byStatusRes || []).map((r: any) => ({ status: r.status, count: r.count }));

      // active members
      const membersRes = await query('SELECT COUNT(*) as total FROM users WHERE is_active = 1');
      const activeMembers = (membersRes[0] as any)?.total || 0;

      return res.json(new ApiResponse(true, {
        activeProjects,
        totalSkus,
        activeOrders,
        activeMembers,
        recentOrders,
        ordersByStatus,
      }, 'Dashboard stats retrieved'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving dashboard stats', error));
    }
  }
}

export const dashboardController = new DashboardController();
