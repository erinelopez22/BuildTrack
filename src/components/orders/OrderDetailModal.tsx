import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Building2, User, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { formatManilaTime } from '@/lib/notificationService';
import type { Order, Profile } from '@/types/database';

interface OrderDetailModalProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

export function OrderDetailModal({ orderId, open, onOpenChange, onStatusChange }: OrderDetailModalProps) {
  const { user, isApprover, isSuperAdmin } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [approver, setApprover] = useState<Profile | null>(null);
  const [rejector, setRejector] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orderId && open) {
      fetchOrderDetails();
    }
  }, [orderId, open]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;
    setLoading(true);

    const { data: orderData, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderData) {
      setOrder(orderData as Order);

      // Fetch creator profile
      if (orderData.created_by) {
        const { data: creatorData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', orderData.created_by)
          .maybeSingle();
        setCreator(creatorData as Profile);
      }

      // Fetch approver profile if approved
      if (orderData.approved_by) {
        const { data: approverData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', orderData.approved_by)
          .maybeSingle();
        setApprover(approverData as Profile);
      }

      // Fetch rejector profile if rejected
      if (orderData.rejected_by) {
        const { data: rejectorData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', orderData.rejected_by)
          .maybeSingle();
        setRejector(rejectorData as Profile);
      }
    }

    setLoading(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono">{order?.order_number || 'Loading...'}</span>
            {order && <StatusBadge status={order.status} />}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* Rejected Alert */}
            {order.status === 'rejected' && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-destructive font-medium">
                  <XCircle className="h-5 w-5" />
                  Order Rejected
                </div>
                {order.rejection_reason && (
                  <p className="text-sm text-destructive/80 pl-7">
                    <span className="font-medium">Reason:</span> {order.rejection_reason}
                  </p>
                )}
                {rejector && order.rejected_at && (
                  <p className="text-xs text-muted-foreground pl-7">
                    Rejected by {rejector.full_name || rejector.email} on{' '}
                    {formatManilaTime(order.rejected_at)}
                  </p>
                )}
              </div>
            )}

            {/* Supplier Info */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">{order.supplier_name || 'Not specified'}</p>
                  {order.supplier_contact && (
                    <p className="text-sm text-muted-foreground">{order.supplier_contact}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Expected Delivery</p>
                  <p className="font-medium">
                    {order.expected_delivery_date
                      ? formatManilaTime(order.expected_delivery_date).split(' –')[0]
                      : 'Not set'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Created By</p>
                  <p className="font-medium">{creator?.full_name || creator?.email || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatManilaTime(order.created_at)}
                  </p>
                </div>
              </div>

              {order.status !== 'for_approval' && order.status !== 'rejected' && approver && order.approved_at && (
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Approved By</p>
                    <p className="font-medium">{approver.full_name || approver.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatManilaTime(order.approved_at)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}

            {/* Total Amount */}
            {order.total_amount && (
              <div className="border-t pt-4 flex justify-between items-center">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="text-lg font-semibold">
                  ₱{order.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Read-only notice for rejected orders */}
            {order.status === 'rejected' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                This order is read-only. Only Super Admin can modify rejected orders.
              </div>
            )}
          </div>
        ) : (
          <p className="text-center py-8 text-muted-foreground">Order not found</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
