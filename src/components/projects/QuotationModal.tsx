import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Loader2, Clock, Package, Pencil } from 'lucide-react';
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
import { logActivity } from '@/lib/activityLogger';
import { notifyProjectMembers, formatManilaTime } from '@/lib/notificationService';

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
  hasExistingQuotation: boolean;
  onQuotationChange?: () => void;
}

export function QuotationModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  canEdit,
  hasExistingQuotation,
  onQuotationChange,
}: QuotationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [notes, setNotes] = useState('');
  const [receivedByMaterial, setReceivedByMaterial] = useState<Record<string, number>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [creatorName, setCreatorName] = useState<string>('');

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
        setIsEditMode(false);

        // Fetch creator name
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', quotationData.created_by)
          .maybeSingle();
        
        setCreatorName(profileData?.full_name || 'Unknown');

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
        setIsEditMode(true);
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
      // Get only DELIVERED orders for this project (strict: only 'delivered' status)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('project_id', projectId)
        .eq('status', 'delivered');

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
    const hasInvalidItem = items.some((item) => !item.material_name.trim() || item.quantity < 1 || !item.unit.trim());
    if (hasInvalidItem) {
      toast({
        title: 'Validation Error',
        description: 'All materials must have a name, unit, and quantity of at least 1',
        variant: 'destructive',
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one material item is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Get user profile for activity log
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const userName = userProfile?.full_name || 'User';

      // Get user role
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const roleName = userRole?.role || 'member';

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

        // Log activity
        await logActivity({
          action: 'update',
          tableName: 'project_quotations',
          recordId: quotation.id,
          oldValues: null,
          newValues: { 
            items_count: items.length,
            updated_by: userName,
            role: roleName,
          },
          userId: user.id,
        });

        // Notify project members
        await notifyProjectMembers({
          projectId,
          title: 'Quotation Updated',
          message: `${userName} (${roleName}) updated the quotation for ${projectName} on ${formatManilaTime(new Date())}`,
          type: 'project',
          referenceType: 'project_quotations',
          referenceId: quotation.id,
          excludeUserId: user.id,
        });

        toast({ title: 'Success', description: 'Quotation updated successfully' });
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

        // Log activity
        await logActivity({
          action: 'create',
          tableName: 'project_quotations',
          recordId: newQuotation.id,
          oldValues: null,
          newValues: { 
            items_count: items.length,
            created_by: userName,
            role: roleName,
          },
          userId: user.id,
        });

        // Notify project members
        await notifyProjectMembers({
          projectId,
          title: 'Quotation Created',
          message: `${userName} (${roleName}) created a quotation for ${projectName} on ${formatManilaTime(new Date())}`,
          type: 'project',
          referenceType: 'project_quotations',
          referenceId: newQuotation.id,
          excludeUserId: user.id,
        });

        toast({ title: 'Success', description: 'Quotation created successfully' });
      }

      setIsEditMode(false);
      fetchQuotation();
      onQuotationChange?.();
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

  const handleEnterEditMode = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    if (quotation) {
      setIsEditMode(false);
      fetchQuotation();
    } else {
      onOpenChange(false);
    }
  };

  const getItemProgress = (item: QuotationItem) => {
    const materialKey = item.material_name.toLowerCase();
    const received = receivedByMaterial[materialKey] || 0;
    const cappedReceived = Math.min(received, item.quantity);
    const percentage = item.quantity > 0 ? Math.min(100, (cappedReceived / item.quantity) * 100) : 0;
    return { received, cappedReceived, percentage, remaining: Math.max(0, item.quantity - received) };
  };

  const getTotalProgress = () => {
    const totalQuoted = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalReceived = items.reduce((sum, item) => {
      const materialKey = item.material_name.toLowerCase();
      const received = receivedByMaterial[materialKey] || 0;
      return sum + Math.min(received, item.quantity); // Cap at quoted quantity
    }, 0);
    return totalQuoted > 0 ? Math.min(100, (totalReceived / totalQuoted) * 100) : 0;
  };

  const isViewMode = !isEditMode && quotation !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {!quotation ? 'Add Quotation' : isEditMode ? 'Update Quotation' : 'View Quotation'} - {projectName}
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Created: {format(new Date(quotation.created_at), 'MMM dd, yyyy h:mm a')}</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <span>By: {creatorName}</span>
                {quotation.updated_at !== quotation.created_at && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span>Updated: {format(new Date(quotation.updated_at), 'MMM dd, yyyy h:mm a')}</span>
                  </>
                )}
              </div>
            )}

            {/* Overall Progress Summary */}
            {isViewMode && items.length > 0 && items.some(i => i.material_name) && (
              <div className="space-y-2 p-4 bg-primary/5 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Project Progress</span>
                  <span className="text-lg font-bold text-primary">{getTotalProgress().toFixed(0)}%</span>
                </div>
                <Progress value={getTotalProgress()} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  Based on materials received vs. quoted quantities
                </p>
              </div>
            )}

            {/* Materials List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Materials List {isEditMode && <span className="text-destructive">*</span>}
                </Label>
                {isViewMode && canEdit && (
                  <Button type="button" variant="outline" size="sm" onClick={handleEnterEditMode}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Update Quotation
                  </Button>
                )}
              </div>

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
                            disabled={!isEditMode}
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            placeholder="Unit"
                            value={item.unit}
                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                            disabled={!isEditMode}
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min={1}
                            placeholder="Qty"
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                            disabled={!isEditMode}
                          />
                        </div>
                        {isEditMode && (
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
                      
                      {/* Item Progress (only in view mode) */}
                      {isViewMode && item.material_name && item.quantity > 0 && (
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

              {isEditMode && (
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
                disabled={!isEditMode}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              {isEditMode ? (
                <>
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : quotation ? (
                      'Save Changes'
                    ) : (
                      'Create Quotation'
                    )}
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
