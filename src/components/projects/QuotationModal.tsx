import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Loader2, Clock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface QuotationItem {
  id: string;
  material_name: string;
  unit: string;
  quantity: number;
  received_quantity?: number;
}

interface Quotation {
  id: string;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

interface QuotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  canEdit: boolean;
}

export function QuotationModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  canEdit,
}: QuotationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [notes, setNotes] = useState('');
  const [receivedByMaterial, setReceivedByMaterial] = useState<Record<string, number>>({});

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      // Fetch quotation
      const { data: quotationData, error: quotationError } = await supabase
        .from('project_quotations')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (quotationError) throw quotationError;

      if (quotationData) {
        setQuotation(quotationData);
        setNotes(quotationData.notes || '');

        // Fetch quotation items
        const { data: itemsData, error: itemsError } = await supabase
          .from('quotation_items')
          .select('*')
          .eq('quotation_id', quotationData.id)
          .order('created_at', { ascending: true });

        if (itemsError) throw itemsError;
        setItems(itemsData || []);

        // Fetch received quantities from orders
        await fetchReceivedQuantities();
      } else {
        setQuotation(null);
        setItems([{ id: crypto.randomUUID(), material_name: '', unit: 'pcs', quantity: 0 }]);
        setNotes('');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load quotation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReceivedQuantities = async () => {
    try {
      // Get all orders for this project that are delivered/received
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('project_id', projectId)
        .in('status', ['delivered', 'partially_received', 'fully_received', 'closed']);

      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) {
        setReceivedByMaterial({});
        return;
      }

      // Get order items with SKU names
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('quantity_received, sku:skus(name)')
        .in('order_id', orders.map(o => o.id));

      if (itemsError) throw itemsError;

      // Aggregate received quantities by material name
      const received: Record<string, number> = {};
      orderItems?.forEach((item: any) => {
        const name = item.sku?.name?.toLowerCase() || '';
        if (name) {
          received[name] = (received[name] || 0) + (item.quantity_received || 0);
        }
      });
      setReceivedByMaterial(received);
    } catch (error) {
      console.error('Error fetching received quantities:', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchQuotation();
    }
  }, [open, projectId]);

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), material_name: '', unit: 'pcs', quantity: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof QuotationItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSave = async () => {
    if (!user) return;
    
    // Validate
    const hasInvalidItem = items.some((item) => !item.material_name.trim() || item.quantity < 1);
    if (hasInvalidItem) {
      toast({
        title: 'Validation Error',
        description: 'All materials must have a name and quantity of at least 1',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (quotation) {
        // Update existing quotation
        const { error: updateError } = await supabase
          .from('project_quotations')
          .update({ notes, updated_at: new Date().toISOString() })
          .eq('id', quotation.id);

        if (updateError) throw updateError;

        // Delete existing items and insert new ones
        await supabase.from('quotation_items').delete().eq('quotation_id', quotation.id);

        const { error: itemsError } = await supabase.from('quotation_items').insert(
          items.map((item) => ({
            quotation_id: quotation.id,
            material_name: item.material_name.trim(),
            unit: item.unit,
            quantity: item.quantity,
          }))
        );

        if (itemsError) throw itemsError;
      } else {
        // Create new quotation
        const { data: newQuotation, error: createError } = await supabase
          .from('project_quotations')
          .insert({
            project_id: projectId,
            created_by: user.id,
            notes,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Insert items
        const { error: itemsError } = await supabase.from('quotation_items').insert(
          items.map((item) => ({
            quotation_id: newQuotation.id,
            material_name: item.material_name.trim(),
            unit: item.unit,
            quantity: item.quantity,
          }))
        );

        if (itemsError) throw itemsError;
      }

      toast({ title: 'Success', description: 'Quotation saved successfully' });
      fetchQuotation();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save quotation',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getItemProgress = (item: QuotationItem) => {
    const materialKey = item.material_name.toLowerCase();
    const received = receivedByMaterial[materialKey] || 0;
    const percentage = item.quantity > 0 ? Math.min(100, (received / item.quantity) * 100) : 0;
    return { received, percentage, remaining: Math.max(0, item.quantity - received) };
  };

  const getTotalProgress = () => {
    const totalQuoted = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalReceived = items.reduce((sum, item) => {
      const materialKey = item.material_name.toLowerCase();
      return sum + (receivedByMaterial[materialKey] || 0);
    }, 0);
    return totalQuoted > 0 ? Math.min(100, (totalReceived / totalQuoted) * 100) : 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Quotation - {projectName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metadata */}
            {quotation && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Created: {format(new Date(quotation.created_at), 'MMM dd, yyyy h:mm a')}</span>
                </div>
              </div>
            )}

            {/* Overall Progress */}
            {items.length > 0 && items.some(i => i.material_name) && (
              <div className="space-y-2 p-4 bg-primary/5 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm font-bold text-primary">{getTotalProgress().toFixed(0)}%</span>
                </div>
                <Progress value={getTotalProgress()} className="h-3" />
              </div>
            )}

            {/* Materials List */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Materials List {canEdit && <span className="text-destructive">*</span>}
              </Label>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const progress = getItemProgress(item);
                  return (
                    <div key={item.id} className="space-y-2 p-3 border rounded-lg bg-card">
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            placeholder="Material name"
                            value={item.material_name}
                            onChange={(e) => updateItem(item.id, 'material_name', e.target.value)}
                            disabled={!canEdit}
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            placeholder="Unit"
                            value={item.unit}
                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                            disabled={!canEdit}
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min={0}
                            placeholder="Qty"
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                            disabled={!canEdit}
                          />
                        </div>
                        {canEdit && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                            className="shrink-0"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Item Progress */}
                      {item.material_name && item.quantity > 0 && (
                        <div className="space-y-1 pt-2 border-t">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Received: {progress.received} / {item.quantity} {item.unit}
                            </span>
                            <span className="font-medium">{progress.percentage.toFixed(0)}%</span>
                          </div>
                          <Progress value={progress.percentage} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            Remaining: {progress.remaining} {item.unit}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {canEdit && (
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Material
                </Button>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea
                placeholder="Add notes about this quotation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={!canEdit}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {canEdit ? 'Cancel' : 'Close'}
              </Button>
              {canEdit && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : quotation ? (
                    'Update Quotation'
                  ) : (
                    'Create Quotation'
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
