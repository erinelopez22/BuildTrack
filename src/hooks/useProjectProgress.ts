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

        // Get DELIVERED orders for this project
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('project_id', projectId)
          .eq('status', 'delivered');

        // Build delivered quantities map by quotation_item_id for accurate tracking
        const deliveredByQuotationItemId: Record<string, number> = {};

        if (orders && orders.length > 0) {
          // Get order items with quotation_item_id reference
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('quotation_item_id, quantity_ordered, quantity_received')
            .in('order_id', orders.map(o => o.id))
            .not('quotation_item_id', 'is', null);

          orderItems?.forEach((item) => {
            if (item.quotation_item_id) {
              // Use quantity_received if available, otherwise use quantity_ordered
              const qty = item.quantity_received ?? item.quantity_ordered ?? 0;
              deliveredByQuotationItemId[item.quotation_item_id] = 
                (deliveredByQuotationItemId[item.quotation_item_id] || 0) + qty;
            }
          });
        }

        // Calculate per-material progress using quotation_item_id
        const materialProgress: MaterialProgress[] = quotationItems.map((qItem) => {
          const deliveredQty = deliveredByQuotationItemId[qItem.id] || 0;
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
          const delivered = deliveredByQuotationItemId[qItem.id] || 0;
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
