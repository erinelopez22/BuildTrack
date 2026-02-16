import { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { ApiResponse } from '../dto/common.dto';

const ALLOWED_TABLES = new Set([
  'projects',
  'project_quotations',
  'quotation_items',
  'project_members',
  'profiles',
  'user_roles',
  'skus',
  'orders',
  'order_items',
  'audit_logs',
  'notifications',
  'deliveries',
  'delivery_items',
]);

function buildWhereClause(params: Record<string, any>, inputs: Record<string, any>) {
  const clauses: string[] = [];
  Object.entries(params).forEach(([key, value]) => {
    if (key.startsWith('eq__')) {
      const field = key.replace('eq__', '');
      clauses.push(`${field} = @${field}`);
      inputs[field] = value;
    } else if (key.startsWith('neq__')) {
      const field = key.replace('neq__', '');
      clauses.push(`${field} <> @${field}`);
      inputs[field] = value;
    }
    // add more operators as needed
  });
  return clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '';
}

export class SupabaseShimController {
  async get(req: Request, res: Response) {
    try {
      const table = req.params.table;
      if (!ALLOWED_TABLES.has(table)) {
        return res.status(400).json(new ApiResponse(false, null, 'Table not supported'));
      }

      const params = req.query as Record<string, any>;
      const inputs: Record<string, any> = {};
      const where = buildWhereClause(params, inputs);

      const order = params.order ? ` ORDER BY ${params.order}` : '';
      const sql = `SELECT * FROM ${table} ${where} ${order}`;

      const rows = await query(sql, inputs);
      const maybeSingle = params.maybeSingle === 'true' || params.maybeSingle === true;
      if (maybeSingle) {
        return res.json(new ApiResponse(true, rows.length > 0 ? rows[0] : null, 'ok'));
      }
      return res.json(new ApiResponse(true, rows, 'ok'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Query error', error));
    }
  }

  async post(req: Request, res: Response) {
    try {
      const table = req.params.table;
      if (!ALLOWED_TABLES.has(table)) {
        return res.status(400).json(new ApiResponse(false, null, 'Table not supported'));
      }

      const payload = req.body || {};
      const keys = Object.keys(payload);
      if (keys.length === 0) {
        return res.status(400).json(new ApiResponse(false, null, 'No data provided'));
      }

      const cols = keys.join(', ');
      const vals = keys.map((k) => `@${k}`).join(', ');
      const sql = `INSERT INTO ${table} (${cols}) OUTPUT INSERTED.* VALUES (${vals})`;

      const inserted = await execute(sql, payload);
      return res.status(201).json(new ApiResponse(true, inserted, 'inserted'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Insert error', error));
    }
  }

  async put(req: Request, res: Response) {
    try {
      const table = req.params.table;
      if (!ALLOWED_TABLES.has(table)) {
        return res.status(400).json(new ApiResponse(false, null, 'Table not supported'));
      }

      const payload = req.body || {};
      const id = payload.id || req.query.id;
      if (!id) return res.status(400).json(new ApiResponse(false, null, 'Missing id'));

      const keys = Object.keys(payload).filter((k) => k !== 'id');
      if (keys.length === 0) return res.json(new ApiResponse(true, null, 'nothing to update'));

      const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
      const sql = `UPDATE ${table} SET ${setClause} OUTPUT INSERTED.* WHERE id = @id`;

      const params: Record<string, any> = { id, ...payload };
      const updated = await execute(sql, params);
      return res.json(new ApiResponse(true, updated, 'updated'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Update error', error));
    }
  }

  async del(req: Request, res: Response) {
    try {
      const table = req.params.table;
      if (!ALLOWED_TABLES.has(table)) {
        return res.status(400).json(new ApiResponse(false, null, 'Table not supported'));
      }

      const id = req.query.id || req.body.id;
      if (!id) return res.status(400).json(new ApiResponse(false, null, 'Missing id'));

      const sql = `DELETE FROM ${table} WHERE id = @id`;
      await execute(sql, { id });
      return res.json(new ApiResponse(true, null, 'deleted'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Delete error', error));
    }
  }
}

export const supabaseShimController = new SupabaseShimController();
