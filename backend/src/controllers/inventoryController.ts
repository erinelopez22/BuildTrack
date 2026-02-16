import { Request, Response } from 'express';
import { inventoryService } from '../services/inventoryService';
import { AdjustInventoryDTO, TransferInventoryDTO } from '../dto/inventory.dto';
import { ApiResponse } from '../dto/common.dto';

export class InventoryController {
  async getProjectInventory(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const inventory = await inventoryService.getProjectInventory(projectId);

      return res.json(new ApiResponse(true, inventory, 'Project inventory retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving inventory', error));
    }
  }

  async getSKUInventory(req: Request, res: Response) {
    try {
      const { projectId, skuId } = req.params;
      const inventory = await inventoryService.getSKUInventory(projectId, skuId);

      if (!inventory) {
        return res.status(404).json(new ApiResponse(false, null, 'Inventory not found'));
      }

      return res.json(new ApiResponse(true, inventory, 'SKU inventory retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving inventory', error));
    }
  }

  async adjustInventory(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const dto: AdjustInventoryDTO = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json(new ApiResponse(false, null, 'Unauthorized'));
      }

      const transaction = await inventoryService.adjustInventory(projectId, dto, userId);
      return res.status(201).json(new ApiResponse(true, transaction, 'Inventory adjusted successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error adjusting inventory', error));
    }
  }

  async transferInventory(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const dto: TransferInventoryDTO = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json(new ApiResponse(false, null, 'Unauthorized'));
      }

      const transactions = await inventoryService.transferInventory(projectId, dto, userId);
      return res.status(201).json(new ApiResponse(true, transactions, 'Inventory transferred successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error transferring inventory', error));
    }
  }

  async getInventoryTransactions(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const { transactions, total } = await inventoryService.getInventoryTransactions(projectId, skip, limit);

      return res.json(new ApiResponse(true, {
        transactions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }, 'Inventory transactions retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving transactions', error));
    }
  }

  async getLowStockItems(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const items = await inventoryService.getLowStockItems(projectId);

      return res.json(new ApiResponse(true, items, 'Low stock items retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving low stock items', error));
    }
  }
}

export const inventoryController = new InventoryController();
