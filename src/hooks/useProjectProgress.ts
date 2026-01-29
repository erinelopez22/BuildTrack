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

        // Get DELIVERED and CLOSED orders for this project (Received + Completed)
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('project_id', projectId)
          .in('status', ['delivered', 'closed']);

        // Build received quantities map by quotation_item_id for accurate tracking
        const receivedByQuotationItemId: Record<string, number> = {};

        if (orders && orders.length > 0) {
          // Get order items with quotation_item_id reference
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('quotation_item_id, quantity_received')
            .in('order_id', orders.map(o => o.id))
            .not('quotation_item_id', 'is', null);

          orderItems?.forEach((item) => {
            if (item.quotation_item_id) {
              // Use ONLY quantity_received (not quantity_ordered)
              const qty = item.quantity_received ?? 0;
              receivedByQuotationItemId[item.quotation_item_id] = 
                (receivedByQuotationItemId[item.quotation_item_id] || 0) + qty;
            }
          });
        }

        // Calculate per-material progress using quotation_item_id
        const materialProgress: MaterialProgress[] = quotationItems.map((qItem) => {
          const receivedQty = receivedByQuotationItemId[qItem.id] || 0;
          const remainingQty = Math.max(0, qItem.quantity - receivedQty);
          const percentage = qItem.quantity > 0 
            ? Math.min(100, (receivedQty / qItem.quantity) * 100) 
            : 0;

          return {
            materialName: qItem.material_name,
            unit: qItem.unit,
            quotedQty: qItem.quantity,
            deliveredQty: receivedQty,
            remainingQty: remainingQty,
            percentage: Math.round(percentage * 10) / 10,
          };
        });

        // Calculate overall progress
        const totalQuoted = quotationItems.reduce((sum, item) => sum + item.quantity, 0);
        let totalReceived = 0;
        
        quotationItems.forEach((qItem) => {
          const received = receivedByQuotationItemId[qItem.id] || 0;
          // Cap received at quoted amount for percentage calculation
          totalReceived += Math.min(received, qItem.quantity);
        });

        const percentage = totalQuoted > 0 
          ? Math.min(100, (totalReceived / totalQuoted) * 100) 
          : 0;

        setProgress({
          totalQuoted,
          totalDelivered: totalReceived,
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
