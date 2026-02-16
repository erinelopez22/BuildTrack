import { Request, Response } from 'express';
import { skuService } from '../services/skuService';
import { CreateSKUDTO, UpdateSKUDTO } from '../dto/sku.dto';
import { ApiResponse } from '../dto/common.dto';

export class SKUController {
  async getSKU(req: Request, res: Response) {
    try {
      const { skuId } = req.params;
      const sku = await skuService.getSKUById(skuId);

      if (!sku) {
        return res.status(404).json(new ApiResponse(false, null, 'SKU not found'));
      }

      return res.json(new ApiResponse(true, sku, 'SKU retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving SKU', error));
    }
  }

  async getAllSKUs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      const activeOnly = req.query.activeOnly !== 'false';

      const { skus, total } = await skuService.getAllSKUs(skip, limit, activeOnly);

      return res.json(new ApiResponse(true, {
        skus,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }, 'SKUs retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving SKUs', error));
    }
  }

  async createSKU(req: Request, res: Response) {
    try {
      const dto: CreateSKUDTO = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json(new ApiResponse(false, null, 'Unauthorized'));
      }

      const sku = await skuService.createSKU(dto, userId);
      return res.status(201).json(new ApiResponse(true, sku, 'SKU created successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error creating SKU', error));
    }
  }

  async updateSKU(req: Request, res: Response) {
    try {
      const { skuId } = req.params;
      const dto: UpdateSKUDTO = req.body;

      const sku = await skuService.updateSKU(skuId, dto);
      return res.json(new ApiResponse(true, sku, 'SKU updated successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error updating SKU', error));
    }
  }

  async searchSKUs(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json(new ApiResponse(false, null, 'Search term required'));
      }

      const skus = await skuService.searchSKUs(q);
      return res.json(new ApiResponse(true, skus, 'SKUs found'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error searching SKUs', error));
    }
  }
}

export const skuController = new SKUController();
