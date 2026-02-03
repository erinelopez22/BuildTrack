import { useState, useEffect } from 'react';
import { request } from '@/integrations/api';

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

interface QuotationItemApi {
  id: string;
  quotationId: string;
  materialName: string;
  unit: string;
  quantity: number;
}

interface OrderItemApi {
  id: string;
  orderId: string;
  quotationItemId?: string | null;
  quantityReceived: number;
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
        const quotation = await request<{ id: string; items: QuotationItemApi[] }>(`/api/projects/${projectId}/quotation`).catch(() => null);
        if (!quotation || !quotation.items?.length) {
          setProgress({
            totalQuoted: 0,
            totalDelivered: 0,
            percentage: 0,
            hasQuotation: !!quotation,
            materialProgress: [],
          });
          return;
        }

        const quotationItems = quotation.items;
        const orders = await request<Array<{ id: string }>>(`/api/orders?projectId=${projectId}&status=delivered`).catch(() => []);
        const ordersClosed = await request<Array<{ id: string }>>(`/api/orders?projectId=${projectId}&status=closed`).catch(() => []);
        const allOrderIds = [...orders, ...ordersClosed].map((o) => o.id);

        const receivedByQuotationItemId: Record<string, number> = {};
        for (const orderId of allOrderIds) {
          const orderWithItems = await request<{ items?: OrderItemApi[] }>(`/api/orders/${orderId}?includeItems=true`).catch(() => ({}));
          orderWithItems.items?.forEach((item: OrderItemApi) => {
            if (item.quotationItemId) {
              const qty = item.quantityReceived ?? 0;
              receivedByQuotationItemId[item.quotationItemId] = (receivedByQuotationItemId[item.quotationItemId] || 0) + qty;
            }
          });
        }

        const materialProgress: MaterialProgress[] = quotationItems.map((qItem) => {
          const receivedQty = receivedByQuotationItemId[qItem.id] || 0;
          const remainingQty = Math.max(0, qItem.quantity - receivedQty);
          const percentage = qItem.quantity > 0 ? Math.min(100, (receivedQty / qItem.quantity) * 100) : 0;
          return {
            materialName: qItem.materialName,
            unit: qItem.unit,
            quotedQty: qItem.quantity,
            deliveredQty: receivedQty,
            remainingQty: remainingQty,
            percentage: Math.round(percentage * 10) / 10,
          };
        });

        const totalQuoted = quotationItems.reduce((sum, item) => sum + item.quantity, 0);
        let totalReceived = 0;
        quotationItems.forEach((qItem) => {
          const received = receivedByQuotationItemId[qItem.id] || 0;
          totalReceived += Math.min(received, qItem.quantity);
        });
        const percentage = totalQuoted > 0 ? Math.min(100, (totalReceived / totalQuoted) * 100) : 0;

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
