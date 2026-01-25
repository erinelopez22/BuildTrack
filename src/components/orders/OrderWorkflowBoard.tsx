import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OrderCard } from './OrderCard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowLeft, Loader2 } from 'lucide-react';
import type { Order, Project, OrderStatus } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface OrderWorkflowBoardProps {
  project: Project;
  onBack: () => void;
}

// Status lanes configuration for the workflow board
const STATUS_LANES: { key: OrderStatus; label: string; color: string }[] = [
  { key: 'for_approval', label: 'Order Request', color: 'bg-warning/10 border-warning/30' },
  { key: 'approved', label: 'Approved', color: 'bg-success/10 border-success/30' },
  { key: 'ordered', label: 'Ordered', color: 'bg-primary/10 border-primary/30' },
  { key: 'delivered', label: 'Delivered', color: 'bg-success/10 border-success/30' },
];

export function OrderWorkflowBoard({ project, onBack }: OrderWorkflowBoardProps) {
  const navigate = useNavigate();
  const { user, isApprover, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    supplier_name: '',
    supplier_contact: '',
    expected_delivery_date: '',
    notes: '',
  });

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [project.id]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsCreating(true);

    const { error } = await supabase.from('orders').insert({
      project_id: project.id,
      supplier_name: formData.supplier_name || null,
      supplier_contact: formData.supplier_contact || null,
      expected_delivery_date: formData.expected_delivery_date || null,
      notes: formData.notes || null,
      created_by: user.id,
      order_number: '', // Auto-generated
      status: 'for_approval' as OrderStatus, // Always start as Order Request
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Order created successfully' });
      setIsCreateDialogOpen(false);
      setFormData({ supplier_name: '', supplier_contact: '', expected_delivery_date: '', notes: '' });
      fetchOrders();
    }

    setIsCreating(false);
  };

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    // Check permissions
    if (!isSuperAdmin() && !isApprover()) {
      toast({ 
        title: 'Permission Denied', 
        description: 'Only Approvers and Super Admins can change order status', 
        variant: 'destructive' 
      });
      return;
    }

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Order moved to ${newStatus.replace('_', ' ')}` });
      fetchOrders();
    }
  };

  // Get orders for a specific lane
  const getOrdersForLane = (status: OrderStatus) => {
    return orders.filter(o => o.status === status);
  };

  // Get the next status in the workflow
  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    const statusOrder: OrderStatus[] = ['for_approval', 'approved', 'ordered', 'delivered'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex < statusOrder.length - 1) {
      return statusOrder[currentIndex + 1];
    }
    return null;
  };

  const canMoveOrder = isApprover() || isSuperAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{project.name}</h2>
            <p className="text-sm text-muted-foreground">Order Workflow</p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Order
        </Button>
      </div>

      {/* Workflow Board - Status Lanes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_LANES.map((lane) => {
          const laneOrders = getOrdersForLane(lane.key);
          return (
            <div
              key={lane.key}
              className={`rounded-xl border-2 ${lane.color} p-4 min-h-[300px]`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">{lane.label}</h3>
                <span className="text-sm text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">
                  {laneOrders.length}
                </span>
              </div>

              <div className="space-y-3">
                {laneOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No orders
                  </p>
                ) : (
                  laneOrders.map((order) => (
                    <div key={order.id} className="group relative">
                      <OrderCard
                        order={order}
                        onClick={() => navigate(`/orders/${order.id}`)}
                      />
                      {/* Move button - show on hover if user can move */}
                      {canMoveOrder && getNextStatus(order.status) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextStatus = getNextStatus(order.status);
                            if (nextStatus) handleStatusChange(order, nextStatus);
                          }}
                        >
                          Move to Next →
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Order Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Order for {project.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier Name</Label>
              <Input
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                placeholder="Acme Supplies Inc."
              />
            </div>

            <div className="space-y-2">
              <Label>Supplier Contact</Label>
              <Input
                value={formData.supplier_contact}
                onChange={(e) => setFormData({ ...formData, supplier_contact: e.target.value })}
                placeholder="Email or phone"
              />
            </div>

            <div className="space-y-2">
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Order'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}