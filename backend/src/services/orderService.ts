import { query, execute } from '../config/database';
import { CreateOrderDTO, UpdateOrderDTO, OrderResponseDTO, ApproveOrderDTO, RejectOrderDTO } from '../dto/order.dto';
import { v4 as uuidv4 } from 'uuid';

export class OrderService {
  async getOrderById(orderId: string): Promise<OrderResponseDTO | null> {
    const sql = `
      SELECT 
        o.id, o.project_id, o.order_number, o.order_type, o.status, 
        o.supplier_name, o.supplier_contact, o.expected_delivery_date, 
        o.notes, o.total_amount, o.created_at, o.updated_at, o.created_by
      FROM orders o
      WHERE o.id = @orderId
    `;

    const result = await query(sql, { orderId });
    if (result.length === 0) return null;

    const order = result[0] as any;
    const items = await this.getOrderItems(orderId);

    return {
      ...order,
      items,
    };
  }

  async getOrdersByProject(projectId: string, skip: number = 0, take: number = 10): Promise<{ orders: OrderResponseDTO[], total: number }> {
    const countSql = 'SELECT COUNT(*) as total FROM orders WHERE project_id = @projectId';
    const countResult = await query(countSql, { projectId });
    const total = (countResult[0] as any).total;

    const sql = `
      SELECT 
        o.id, o.project_id, o.order_number, o.order_type, o.status, 
        o.supplier_name, o.supplier_contact, o.expected_delivery_date, 
        o.notes, o.total_amount, o.created_at, o.updated_at, o.created_by
      FROM orders o
      WHERE o.project_id = @projectId
      ORDER BY o.created_at DESC
      OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
    `;

    const orders = await query(sql, { projectId, skip, take });
    const ordersWithItems = await Promise.all(
      orders.map(async (o: any) => {
        const items = await this.getOrderItems(o.id);
        return { ...o, items };
      })
    );

    return { orders: ordersWithItems, total };
  }

  async createOrder(dto: CreateOrderDTO, createdBy: string): Promise<OrderResponseDTO> {
    const orderId = uuidv4();
    const orderNumber = `ORD-${Date.now()}`;

    const sql = `
      INSERT INTO orders 
        (id, project_id, order_number, order_type, status, supplier_name, supplier_contact, 
         expected_delivery_date, notes, created_by, created_at, updated_at)
      VALUES 
        (@id, @projectId, @orderNumber, @orderType, 'draft', @supplierName, @supplierContact,
         @expectedDeliveryDate, @notes, @createdBy, GETUTCDATE(), GETUTCDATE())
    `;

    await execute(sql, {
      id: orderId,
      projectId: dto.project_id,
      orderNumber,
      orderType: dto.order_type,
      supplierName: dto.supplier_name || null,
      supplierContact: dto.supplier_contact || null,
      expectedDeliveryDate: dto.expected_delivery_date || null,
      notes: dto.notes || null,
      createdBy,
    });

    // Add order items
    for (const item of dto.items) {
      await this.addOrderItem(orderId, item);
    }

    return this.getOrderById(orderId) as Promise<OrderResponseDTO>;
  }

  async updateOrder(orderId: string, dto: UpdateOrderDTO): Promise<OrderResponseDTO> {
    let sql = 'UPDATE orders SET updated_at = GETUTCDATE()';
    const params: Record<string, any> = { orderId };

    if (dto.status !== undefined) {
      sql += ', status = @status';
      params.status = dto.status;
    }
    if (dto.supplier_name !== undefined) {
      sql += ', supplier_name = @supplierName';
      params.supplierName = dto.supplier_name;
    }
    if (dto.supplier_contact !== undefined) {
      sql += ', supplier_contact = @supplierContact';
      params.supplierContact = dto.supplier_contact;
    }
    if (dto.expected_delivery_date !== undefined) {
      sql += ', expected_delivery_date = @expectedDeliveryDate';
      params.expectedDeliveryDate = dto.expected_delivery_date;
    }
    if (dto.notes !== undefined) {
      sql += ', notes = @notes';
      params.notes = dto.notes;
    }

    sql += ' WHERE id = @orderId';
    await execute(sql, params);

    return this.getOrderById(orderId) as Promise<OrderResponseDTO>;
  }

  async approveOrder(orderId: string, dto: ApproveOrderDTO): Promise<OrderResponseDTO> {
    const sql = `
      UPDATE orders 
      SET status = 'approved', approved_by = @approvedBy, approved_at = GETUTCDATE(), updated_at = GETUTCDATE()
      WHERE id = @orderId
    `;

    await execute(sql, { orderId, approvedBy: dto.approved_by });
    return this.getOrderById(orderId) as Promise<OrderResponseDTO>;
  }

  async rejectOrder(orderId: string, dto: RejectOrderDTO): Promise<OrderResponseDTO> {
    const sql = `
      UPDATE orders 
      SET status = 'rejected', rejected_at = GETUTCDATE(), rejection_reason = @rejectionReason, updated_at = GETUTCDATE()
      WHERE id = @orderId
    `;

    await execute(sql, { orderId, rejectionReason: dto.rejection_reason });
    return this.getOrderById(orderId) as Promise<OrderResponseDTO>;
  }

  private async getOrderItems(orderId: string): Promise<any[]> {
    const sql = `
      SELECT id, order_id, sku_id, quantity_ordered, quantity_received, unit_price, notes
      FROM order_items
      WHERE order_id = @orderId
    `;

    return query(sql, { orderId });
  }

  private async addOrderItem(orderId: string, item: any): Promise<void> {
    const sql = `
      INSERT INTO order_items (id, order_id, sku_id, quantity_ordered, unit_price, notes, created_at)
      VALUES (@id, @orderId, @skuId, @quantityOrdered, @unitPrice, @notes, GETUTCDATE())
    `;

    await execute(sql, {
      id: uuidv4(),
      orderId,
      skuId: item.sku_id,
      quantityOrdered: item.quantity_ordered,
      unitPrice: item.unit_price || null,
      notes: item.notes || null,
    });
  }
}

export const orderService = new OrderService();
