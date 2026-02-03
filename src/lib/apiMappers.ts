/**
 * Maps .NET API responses (camelCase) to frontend types (snake_case) so existing components keep working.
 */

import type { Project, Order, SKU, Profile } from "@/types/database";

export interface ApiProject {
  id: string;
  name: string;
  code?: string | null;
  location?: string | null;
  description?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  projectManagerId?: string | null;
  estimatedCost?: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

export function mapApiProject(p: ApiProject): Project {
  return {
    id: p.id,
    name: p.name,
    code: p.code ?? null,
    location: p.location ?? null,
    description: p.description ?? null,
    status: p.status,
    start_date: p.startDate ?? null,
    end_date: p.endDate ?? null,
    project_manager_id: p.projectManagerId ?? null,
    estimated_cost: p.estimatedCost ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    created_by: p.createdBy ?? null,
  };
}

export interface ApiOrderWithProject {
  id: string;
  projectId: string;
  orderNumber: string;
  orderType: string;
  status: string;
  supplierName?: string | null;
  supplierContact?: string | null;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  totalAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  project?: { id: string; name: string; status: string } | null;
}

export function mapApiOrderWithProject(o: ApiOrderWithProject): Order & { project: Project } {
  return {
    id: o.id,
    project_id: o.projectId,
    order_number: o.orderNumber,
    order_type: o.orderType,
    status: o.status as Order["status"],
    supplier_name: o.supplierName ?? null,
    supplier_contact: o.supplierContact ?? null,
    expected_delivery_date: o.expectedDeliveryDate ?? null,
    notes: o.notes ?? null,
    total_amount: o.totalAmount ?? null,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    created_by: o.createdBy,
    project: o.project
      ? {
          id: o.project.id,
          name: o.project.name,
          code: null,
          location: null,
          description: null,
          status: o.project.status as Project["status"],
          start_date: null,
          end_date: null,
          project_manager_id: null,
          estimated_cost: null,
          created_at: "",
          updated_at: "",
          created_by: null,
        }
      : ({} as Project),
  };
}

export interface ApiSku {
  id: string;
  skuCode: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unitOfMeasure: string;
  brand?: string | null;
  specifications?: string | null;
  defaultMinThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

export function mapApiSku(s: ApiSku): SKU {
  return {
    id: s.id,
    sku_code: s.skuCode,
    name: s.name,
    description: s.description ?? null,
    category: s.category ?? null,
    unit_of_measure: s.unitOfMeasure,
    brand: s.brand ?? null,
    specifications: (s.specifications ?? null) as SKU["specifications"],
    default_min_threshold: s.defaultMinThreshold,
    is_active: s.isActive,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    created_by: s.createdBy ?? null,
  };
}

export interface ApiProfile {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export function mapApiProfile(p: ApiProfile): Profile {
  return {
    id: p.id,
    email: p.email,
    full_name: p.fullName ?? null,
    phone: p.phone ?? null,
    avatar_url: p.avatarUrl ?? null,
    sms_opt_in: false,
    notification_preferences: { email: true, sms: false, push: true },
    is_active: p.isActive,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}
