import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MaterialProgress {
  materialName: string;
  unit: string;
  quotedQty: number;
  deliveredQty: number;
  remainingQty: number;
  percentage: number;
}

interface ProjectProgress {
  totalQuoted: number;
  totalDelivered: number;
  percentage: number;
  hasQuotation: boolean;
  materialProgress: MaterialProgress[];
}

// Added refreshKey parameter to force re-fetch when quotation changes
export function useProjectProgress(projectId: string, refreshKey: number = 0): ProjectProgress {
  const [progress, setProgress] = useState<ProjectProgress>({
    totalQuoted: 0,
    totalDelivered: 0,
    percentage: 0,
    hasQuotation: false,
    materialProgress: [],
  });

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        // Check if project has a quotation
        const { data: quotation } = await supabase
          .from('project_quotations')
          .select('id')
          .eq('project_id', projectId)
          .maybeSingle();

        if (!quotation) {
          setProgress({
            totalQuoted: 0,
            totalDelivered: 0,
            percentage: 0,
            hasQuotation: false,
            materialProgress: [],
          });
          return;
        }

        // Fetch quotation items
        const { data: quotationItems } = await supabase
          .from('quotation_items')
          .select('id, material_name, unit, quantity')
          .eq('quotation_id', quotation.id);

        if (!quotationItems || quotationItems.length === 0) {
          setProgress({
            totalQuoted: 0,
            totalDelivered: 0,
            percentage: 0,
            hasQuotation: true,
            materialProgress: [],
          });
          return;
        }

        // Get only DELIVERED orders for this project (strict: only 'delivered' status)
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('project_id', projectId)
          .eq('status', 'delivered');

        // Build delivered quantities map by material name
        const deliveredByMaterial: Record<string, number> = {};

        if (orders && orders.length > 0) {
          // Get order items with quantity_ordered (using it as delivered quantity for delivered orders)
          // Note: In a full implementation, you'd track quantity_received separately
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('quantity_ordered, quantity_received, sku:skus(name)')
            .in('order_id', orders.map(o => o.id));

          orderItems?.forEach((item: any) => {
            const name = item.sku?.name?.toLowerCase() || '';
            if (name) {
              // Use quantity_received if available, otherwise use quantity_ordered for delivered orders
              const qty = item.quantity_received ?? item.quantity_ordered ?? 0;
              deliveredByMaterial[name] = (deliveredByMaterial[name] || 0) + qty;
            }
          });
        }

        // Calculate per-material progress
        const materialProgress: MaterialProgress[] = quotationItems.map((qItem) => {
          const materialKey = qItem.material_name.toLowerCase();
          const deliveredQty = deliveredByMaterial[materialKey] || 0;
          const cappedDelivered = Math.min(deliveredQty, qItem.quantity);
          const remainingQty = Math.max(0, qItem.quantity - deliveredQty);
          const percentage = qItem.quantity > 0 
            ? Math.min(100, (deliveredQty / qItem.quantity) * 100) 
            : 0;

          return {
            materialName: qItem.material_name,
            unit: qItem.unit,
            quotedQty: qItem.quantity,
            deliveredQty: deliveredQty,
            remainingQty: remainingQty,
            percentage: Math.round(percentage * 10) / 10,
          };
        });

        // Calculate overall progress
        const totalQuoted = quotationItems.reduce((sum, item) => sum + item.quantity, 0);
        let totalDelivered = 0;
        
        quotationItems.forEach((qItem) => {
          const materialKey = qItem.material_name.toLowerCase();
          const delivered = deliveredByMaterial[materialKey] || 0;
          // Cap delivered at quoted amount for percentage calculation
          totalDelivered += Math.min(delivered, qItem.quantity);
        });

        const percentage = totalQuoted > 0 
          ? Math.min(100, (totalDelivered / totalQuoted) * 100) 
          : 0;

        setProgress({
          totalQuoted,
          totalDelivered,
          percentage: Math.round(percentage * 10) / 10,
          hasQuotation: true,
          materialProgress,
        });
      } catch (error) {
        console.error('Error fetching project progress:', error);
      }
    };

    if (projectId) {
      fetchProgress();
    }
  }, [projectId, refreshKey]);

  return progress;
}
