import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OrderCard } from './OrderCard';
import { OrderDetailModal } from './OrderDetailModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Archive } from 'lucide-react';
import type { Order } from '@/types/database';

interface CompletedOrdersModalProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompletedOrdersModal({
  projectId,
  projectName,
  open,
  onOpenChange,
}: CompletedOrdersModalProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchCompletedOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'closed')
      .order('updated_at', { ascending: false });

    setOrders((data as Order[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchCompletedOrders();
    }
  }, [open, projectId]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-muted-foreground" />
              Completed Orders — {projectName}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No completed orders yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Orders moved from Delivered will appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="grid gap-3">
                {orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onClick={() => setSelectedOrderId(order.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Detail Modal */}
      <OrderDetailModal
        orderId={selectedOrderId}
        open={!!selectedOrderId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedOrderId(null);
        }}
        onStatusChange={fetchCompletedOrders}
      />
    </>
  );
}
