import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QuotationMaterial {
  id: string;
  material_name: string;
  unit: string;
  quantity: number;
}

interface MaterialItem {
  id: string;
  materialId: string; // quotation_item id
  materialName: string;
  unit: string;
  quantity: number;
}

interface CreateOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onSubmit: (data: {
    materials: { materialId: string; name: string; unit: string; quantity: number }[];
    expectedDeliveryDate: Date | null;
    notes: string;
  }) => Promise<void>;
  isSubmitting: boolean;
  onAddQuotation?: () => void;
  canAddQuotation?: boolean;
}

export function CreateOrderModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  onSubmit,
  isSubmitting,
  onAddQuotation,
  canAddQuotation = false,
}: CreateOrderModalProps) {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [quotationMaterials, setQuotationMaterials] = useState<QuotationMaterial[]>([]);
  const [loadingQuotation, setLoadingQuotation] = useState(true);
  const [hasQuotation, setHasQuotation] = useState(false);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ materials?: string; notes?: string }>({});

  // Fetch quotation materials when modal opens
  useEffect(() => {
    if (open && projectId) {
      fetchQuotationMaterials();
    }
  }, [open, projectId]);

  const fetchQuotationMaterials = async () => {
    setLoadingQuotation(true);
    try {
      // Get quotation for this project
      const { data: quotation } = await supabase
        .from('project_quotations')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();

      if (!quotation) {
        setHasQuotation(false);
        setQuotationMaterials([]);
        setLoadingQuotation(false);
        return;
      }

      // Fetch quotation items
      const { data: items } = await supabase
        .from('quotation_items')
        .select('id, material_name, unit, quantity')
        .eq('quotation_id', quotation.id)
        .order('material_name');

      setHasQuotation(true);
      setQuotationMaterials(items || []);
      
      // Initialize with one empty row if we have materials
      if (items && items.length > 0) {
        setMaterials([{ id: crypto.randomUUID(), materialId: '', materialName: '', unit: '', quantity: 1 }]);
      }
    } catch (error) {
      console.error('Error fetching quotation:', error);
    }
    setLoadingQuotation(false);
  };

  const addMaterial = () => {
    setMaterials([...materials, { id: crypto.randomUUID(), materialId: '', materialName: '', unit: '', quantity: 1 }]);
  };

  const removeMaterial = (id: string) => {
    if (materials.length > 1) {
      setMaterials(materials.filter((m) => m.id !== id));
    }
  };

  const selectMaterial = (rowId: string, quotationItemId: string) => {
    const quotationItem = quotationMaterials.find(m => m.id === quotationItemId);
    if (!quotationItem) return;

    setMaterials(
      materials.map((m) =>
        m.id === rowId
          ? {
              ...m,
              materialId: quotationItemId,
              materialName: quotationItem.material_name,
              unit: quotationItem.unit,
            }
          : m
      )
    );
  };

  const updateQuantity = (id: string, value: number) => {
    setMaterials(
      materials.map((m) =>
        m.id === id ? { ...m, quantity: Math.max(1, value) } : m
      )
    );
  };

  // Get available materials (exclude already selected)
  const getAvailableMaterials = (currentRowId: string) => {
    const selectedIds = materials
      .filter(m => m.id !== currentRowId && m.materialId)
      .map(m => m.materialId);
    return quotationMaterials.filter(qm => !selectedIds.includes(qm.id));
  };

  const validateForm = (): boolean => {
    const newErrors: { materials?: string; notes?: string } = {};

    // Validate materials
    const hasInvalidMaterial = materials.some((m) => !m.materialId || m.quantity < 1);
    if (materials.length === 0 || hasInvalidMaterial) {
      newErrors.materials = 'Select at least one material with quantity of at least 1';
    }

    // Validate notes (required)
    if (!notes.trim()) {
      newErrors.notes = 'Notes are required for approval decisions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    await onSubmit({
      materials: materials.map((m) => ({
        materialId: m.materialId,
        name: m.materialName,
        unit: m.unit,
        quantity: m.quantity,
      })),
      expectedDeliveryDate: expectedDeliveryDate || null,
      notes: notes.trim(),
    });

    // Reset form on successful submission
    resetForm();
  };

  const resetForm = () => {
    setMaterials([{ id: crypto.randomUUID(), materialId: '', materialName: '', unit: '', quantity: 1 }]);
    setExpectedDeliveryDate(undefined);
    setNotes('');
    setErrors({});
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Order for {projectName}</DialogTitle>
        </DialogHeader>

        {loadingQuotation ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasQuotation ? (
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No quotation found for this project. Add a quotation first before creating orders.
              </AlertDescription>
            </Alert>
            {canAddQuotation && onAddQuotation && (
              <Button onClick={onAddQuotation} className="w-full">
                Add Quotation
              </Button>
            )}
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full">
              Close
            </Button>
          </div>
        ) : quotationMaterials.length === 0 ? (
          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The quotation has no materials. Update the quotation to add materials first.
              </AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Materials List */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Materials List <span className="text-destructive">*</span>
              </Label>

              <div className="space-y-3">
                {materials.map((material) => {
                  const availableMaterials = getAvailableMaterials(material.id);
                  return (
                    <div key={material.id} className="flex gap-2 items-start">
                      {/* Material Dropdown */}
                      <div className="flex-1">
                        <Select
                          value={material.materialId}
                          onValueChange={(value) => selectMaterial(material.id, value)}
                        >
                          <SelectTrigger className={cn(
                            errors.materials && !material.materialId && 'border-destructive'
                          )}>
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {availableMaterials.map((qm) => (
                              <SelectItem key={qm.id} value={qm.id}>
                                {qm.material_name}
                              </SelectItem>
                            ))}
                            {material.materialId && !availableMaterials.find(m => m.id === material.materialId) && (
                              <SelectItem value={material.materialId}>
                                {material.materialName}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Unit (read-only) */}
                      <div className="w-20">
                        <Input
                          value={material.unit || '-'}
                          readOnly
                          className="bg-muted text-muted-foreground"
                          tabIndex={-1}
                        />
                      </div>

                      {/* Quantity */}
                      <div className="w-20">
                        <Input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={material.quantity}
                          onChange={(e) => updateQuantity(material.id, parseInt(e.target.value) || 1)}
                          className={cn(
                            errors.materials && material.quantity < 1 && 'border-destructive'
                          )}
                        />
                      </div>

                      {/* Remove Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMaterial(material.id)}
                        disabled={materials.length === 1}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Add Material Button - moved to bottom */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMaterial}
                disabled={materials.length >= quotationMaterials.length}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Material
              </Button>

              {errors.materials && (
                <p className="text-sm text-destructive">{errors.materials}</p>
              )}
            </div>

            {/* Expected Delivery Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Expected Delivery Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !expectedDeliveryDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expectedDeliveryDate ? (
                      format(expectedDeliveryDate, 'MMM dd, yyyy')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={expectedDeliveryDate}
                    onSelect={setExpectedDeliveryDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes (Required) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Notes <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Provide details about this order request (required for approval/reject decisions)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className={cn(errors.notes && 'border-destructive')}
              />
              {errors.notes && (
                <p className="text-sm text-destructive">{errors.notes}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Order'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
