import { query, execute } from '../config/database';
import { AdjustInventoryDTO, TransferInventoryDTO, InventoryResponseDTO, InventoryTransactionResponseDTO } from '../dto/inventory.dto';
import { v4 as uuidv4 } from 'uuid';

export class InventoryService {
  async getProjectInventory(projectId: string): Promise<InventoryResponseDTO[]> {
    const sql = `
      SELECT id, project_id, sku_id, on_hand, reserved, min_threshold, location_in_site, created_at, updated_at
      FROM project_inventory
      WHERE project_id = @projectId
    `;

    return query(sql, { projectId });
  }

  async getSKUInventory(projectId: string, skuId: string): Promise<InventoryResponseDTO | null> {
    const sql = `
      SELECT id, project_id, sku_id, on_hand, reserved, min_threshold, location_in_site, created_at, updated_at
      FROM project_inventory
      WHERE project_id = @projectId AND sku_id = @skuId
    `;

    const result = await query(sql, { projectId, skuId });
    return result.length > 0 ? (result[0] as InventoryResponseDTO) : null;
  }

  async adjustInventory(projectId: string, dto: AdjustInventoryDTO, adjustedBy: string): Promise<InventoryTransactionResponseDTO> {
    const transactionId = uuidv4();

    // Get current inventory
    let inventory = await this.getSKUInventory(projectId, dto.sku_id);

    if (!inventory) {
      // Create new inventory record
      const createSql = `
        INSERT INTO project_inventory (id, project_id, sku_id, on_hand, reserved, created_at, updated_at)
        VALUES (@id, @projectId, @skuId, @onHand, 0, GETUTCDATE(), GETUTCDATE())
      `;

      await execute(createSql, {
        id: uuidv4(),
        projectId,
        skuId: dto.sku_id,
        onHand: Math.max(0, dto.quantity),
      });

      inventory = await this.getSKUInventory(projectId, dto.sku_id);
    }

    const quantityBefore = inventory?.on_hand || 0;
    const quantityAfter = Math.max(0, quantityBefore + dto.quantity);

    // Update inventory
    const updateSql = `
      UPDATE project_inventory 
      SET on_hand = @onHand, updated_at = GETUTCDATE()
      WHERE project_id = @projectId AND sku_id = @skuId
    `;

    await execute(updateSql, {
      projectId,
      skuId: dto.sku_id,
      onHand: quantityAfter,
    });

    // Log transaction
    const logSql = `
      INSERT INTO inventory_transactions 
        (id, project_id, sku_id, transaction_type, quantity, quantity_before, quantity_after, notes, created_by, created_at)
      VALUES 
        (@id, @projectId, @skuId, @transactionType, @quantity, @quantityBefore, @quantityAfter, @notes, @createdBy, GETUTCDATE())
    `;

    await execute(logSql, {
      id: transactionId,
      projectId,
      skuId: dto.sku_id,
      transactionType: dto.quantity > 0 ? 'stock_in' : 'stock_out',
      quantity: Math.abs(dto.quantity),
      quantityBefore,
      quantityAfter,
      notes: dto.notes || null,
      createdBy: adjustedBy,
    });

    return {
      id: transactionId,
      project_id: projectId,
      sku_id: dto.sku_id,
      transaction_type: dto.quantity > 0 ? 'stock_in' : 'stock_out',
      quantity: Math.abs(dto.quantity),
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      notes: dto.notes,
      created_by: adjustedBy,
      created_at: new Date().toISOString(),
    };
  }

  async transferInventory(projectId: string, dto: TransferInventoryDTO, transferredBy: string): Promise<InventoryTransactionResponseDTO[]> {
    const transactions: InventoryTransactionResponseDTO[] = [];

    // Stock out from source
    const outTransaction = await this.adjustInventory(projectId, {
      sku_id: dto.sku_id,
      quantity: -dto.quantity,
      notes: `Transfer to project ${dto.target_project_id}. ${dto.notes || ''}`.trim(),
    }, transferredBy);

    transactions.push(outTransaction);

    // Stock in to target
    const inTransaction = await this.adjustInventory(dto.target_project_id, {
      sku_id: dto.sku_id,
      quantity: dto.quantity,
      notes: `Transfer from project ${projectId}. ${dto.notes || ''}`.trim(),
    }, transferredBy);

    transactions.push(inTransaction);

    return transactions;
  }

  async getInventoryTransactions(projectId: string, skip: number = 0, take: number = 20): Promise<{ transactions: InventoryTransactionResponseDTO[], total: number }> {
    const countSql = 'SELECT COUNT(*) as total FROM inventory_transactions WHERE project_id = @projectId';
    const countResult = await query(countSql, { projectId });
    const total = (countResult[0] as any).total;

    const sql = `
      SELECT id, project_id, sku_id, transaction_type, quantity, quantity_before, 
             quantity_after, reference_type, reference_id, notes, created_by, created_at
      FROM inventory_transactions
      WHERE project_id = @projectId
      ORDER BY created_at DESC
      OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
    `;

    const transactions = await query(sql, { projectId, skip, take });
    return { transactions: transactions as InventoryTransactionResponseDTO[], total };
  }

  async getLowStockItems(projectId: string): Promise<InventoryResponseDTO[]> {
    const sql = `
      SELECT pi.id, pi.project_id, pi.sku_id, pi.on_hand, pi.reserved, pi.min_threshold, pi.location_in_site, pi.created_at, pi.updated_at
      FROM project_inventory pi
      WHERE pi.project_id = @projectId AND pi.on_hand <= COALESCE(pi.min_threshold, 0)
      ORDER BY pi.on_hand ASC
    `;

    return query(sql, { projectId });
  }
}

export const inventoryService = new InventoryService();
