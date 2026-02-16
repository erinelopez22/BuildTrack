import { query, execute } from '../config/database';
import { CreateSKUDTO, UpdateSKUDTO, SKUResponseDTO } from '../dto/sku.dto';
import { v4 as uuidv4 } from 'uuid';

export class SKUService {
  async getSKUById(skuId: string): Promise<SKUResponseDTO | null> {
    const sql = `
      SELECT id, sku_code, name, description, category, unit_of_measure, 
             brand, specifications, default_min_threshold, is_active, created_at, updated_at
      FROM skus
      WHERE id = @skuId
    `;

    const result = await query(sql, { skuId });
    return result.length > 0 ? (result[0] as SKUResponseDTO) : null;
  }

  async getSKUByCode(skuCode: string): Promise<SKUResponseDTO | null> {
    const sql = `
      SELECT id, sku_code, name, description, category, unit_of_measure, 
             brand, specifications, default_min_threshold, is_active, created_at, updated_at
      FROM skus
      WHERE sku_code = @skuCode
    `;

    const result = await query(sql, { skuCode });
    return result.length > 0 ? (result[0] as SKUResponseDTO) : null;
  }

  async getAllSKUs(skip: number = 0, take: number = 10, activeOnly: boolean = true): Promise<{ skus: SKUResponseDTO[], total: number }> {
    const whereClause = activeOnly ? 'WHERE is_active = 1' : '';
    const countSql = `SELECT COUNT(*) as total FROM skus ${whereClause}`;
    const countResult = await query(countSql);
    const total = (countResult[0] as any).total;

    const sql = `
      SELECT id, sku_code, name, description, category, unit_of_measure, 
             brand, specifications, default_min_threshold, is_active, created_at, updated_at
      FROM skus
      ${whereClause}
      ORDER BY name ASC
      OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
    `;

    const skus = await query(sql, { skip, take });
    return { skus: skus as SKUResponseDTO[], total };
  }

  async createSKU(dto: CreateSKUDTO, createdBy: string): Promise<SKUResponseDTO> {
    const skuId = uuidv4();

    const sql = `
      INSERT INTO skus 
        (id, sku_code, name, description, category, unit_of_measure, brand, 
         specifications, default_min_threshold, is_active, created_by, created_at, updated_at)
      VALUES 
        (@id, @skuCode, @name, @description, @category, @unitOfMeasure, @brand,
         @specifications, @defaultMinThreshold, 1, @createdBy, GETUTCDATE(), GETUTCDATE())
    `;

    await execute(sql, {
      id: skuId,
      skuCode: dto.sku_code,
      name: dto.name,
      description: dto.description || null,
      category: dto.category || null,
      unitOfMeasure: dto.unit_of_measure,
      brand: dto.brand || null,
      specifications: JSON.stringify(dto.specifications || {}),
      defaultMinThreshold: dto.default_min_threshold,
      createdBy,
    });

    return this.getSKUById(skuId) as Promise<SKUResponseDTO>;
  }

  async updateSKU(skuId: string, dto: UpdateSKUDTO): Promise<SKUResponseDTO> {
    let sql = 'UPDATE skus SET updated_at = GETUTCDATE()';
    const params: Record<string, any> = { skuId };

    if (dto.name !== undefined) {
      sql += ', name = @name';
      params.name = dto.name;
    }
    if (dto.description !== undefined) {
      sql += ', description = @description';
      params.description = dto.description;
    }
    if (dto.category !== undefined) {
      sql += ', category = @category';
      params.category = dto.category;
    }
    if (dto.unit_of_measure !== undefined) {
      sql += ', unit_of_measure = @unitOfMeasure';
      params.unitOfMeasure = dto.unit_of_measure;
    }
    if (dto.brand !== undefined) {
      sql += ', brand = @brand';
      params.brand = dto.brand;
    }
    if (dto.specifications !== undefined) {
      sql += ', specifications = @specifications';
      params.specifications = JSON.stringify(dto.specifications);
    }
    if (dto.default_min_threshold !== undefined) {
      sql += ', default_min_threshold = @defaultMinThreshold';
      params.defaultMinThreshold = dto.default_min_threshold;
    }
    if (dto.is_active !== undefined) {
      sql += ', is_active = @isActive';
      params.isActive = dto.is_active;
    }

    sql += ' WHERE id = @skuId';
    await execute(sql, params);

    return this.getSKUById(skuId) as Promise<SKUResponseDTO>;
  }

  async searchSKUs(searchTerm: string): Promise<SKUResponseDTO[]> {
    const sql = `
      SELECT id, sku_code, name, description, category, unit_of_measure, 
             brand, specifications, default_min_threshold, is_active, created_at, updated_at
      FROM skus
      WHERE is_active = 1 AND (name LIKE @search OR sku_code LIKE @search OR brand LIKE @search)
      ORDER BY name ASC
    `;

    const results = await query(sql, { search: `%${searchTerm}%` });
    return results as SKUResponseDTO[];
  }
}

export const skuService = new SKUService();
