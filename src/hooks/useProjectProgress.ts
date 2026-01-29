import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProjectProgress {
  totalQuoted: number;
  totalReceived: number;
  percentage: number;
  hasQuotation: boolean;
}

// Added refreshKey parameter to force re-fetch when quotation changes
export function useProjectProgress(projectId: string, refreshKey: number = 0): ProjectProgress {
  const [progress, setProgress] = useState<ProjectProgress>({
    totalQuoted: 0,
    totalReceived: 0,
    percentage: 0,
    hasQuotation: false,
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
            totalReceived: 0,
            percentage: 0,
            hasQuotation: false,
          });
          return;
        }

        // Fetch quotation items
        const { data: quotationItems } = await supabase
          .from('quotation_items')
          .select('material_name, quantity')
          .eq('quotation_id', quotation.id);

        if (!quotationItems || quotationItems.length === 0) {
          setProgress({
            totalQuoted: 0,
            totalReceived: 0,
            percentage: 0,
            hasQuotation: true,
          });
          return;
        }

        const totalQuoted = quotationItems.reduce((sum, item) => sum + item.quantity, 0);

        // Get all delivered orders for this project
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('project_id', projectId)
          .in('status', ['delivered', 'partially_received', 'fully_received', 'closed']);

        if (!orders || orders.length === 0) {
          setProgress({
            totalQuoted,
            totalReceived: 0,
            percentage: 0,
            hasQuotation: true,
          });
          return;
        }

        // Get order items with received quantities and SKU names
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('quantity_received, sku:skus(name)')
          .in('order_id', orders.map(o => o.id));

        // Match received quantities to quotation items by material name
        const receivedByMaterial: Record<string, number> = {};
        orderItems?.forEach((item: any) => {
          const name = item.sku?.name?.toLowerCase() || '';
          if (name) {
            receivedByMaterial[name] = (receivedByMaterial[name] || 0) + (item.quantity_received || 0);
          }
        });

        // Calculate total received based on quotation items
        let totalReceived = 0;
        quotationItems.forEach((qItem) => {
          const materialKey = qItem.material_name.toLowerCase();
          const received = receivedByMaterial[materialKey] || 0;
          // Cap received at quoted amount for percentage calculation
          totalReceived += Math.min(received, qItem.quantity);
        });

        const percentage = totalQuoted > 0 ? Math.min(100, (totalReceived / totalQuoted) * 100) : 0;

        setProgress({
          totalQuoted,
          totalReceived,
          percentage,
          hasQuotation: true,
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
