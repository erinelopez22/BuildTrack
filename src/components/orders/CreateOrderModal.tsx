import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { request } from '@/integrations/api';
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
import { useToast } from '@/hooks/use-toast';

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

interface AlreadyOrderedQty {
  [quotationItemId: string]: number;
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
  const { toast } = useToast();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [quotationMaterials, setQuotationMaterials] = useState<QuotationMaterial[]>([]);
  const [alreadyOrderedQty, setAlreadyOrderedQty] = useState<AlreadyOrderedQty>({});
  const [loadingQuotation, setLoadingQuotation] = useState(true);
  const [hasQuotation, setHasQuotation] = useState(false);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ materials?: string; notes?: string }>({});

  // Calculate remaining allowed quantity for a material
  const getRemainingAllowedQty = (quotationItemId: string): number => {
    const quotationItem = quotationMaterials.find(m => m.id === quotationItemId);
    if (!quotationItem) return 0;
    
    const quotedQty = quotationItem.quantity;
    const orderedQty = alreadyOrderedQty[quotationItemId] || 0;
    return Math.max(quotedQty - orderedQty, 0);
  };

  // Get quotation quantity for a material
  const getQuotedQty = (quotationItemId: string): number => {
    const quotationItem = quotationMaterials.find(m => m.id === quotationItemId);
    return quotationItem?.quantity || 0;
  };

  // Get already ordered quantity for a material
  const getAlreadyOrderedQty = (quotationItemId: string): number => {
    return alreadyOrderedQty[quotationItemId] || 0;
  };

  // Fetch quotation materials and already ordered quantities when modal opens
  useEffect(() => {
    if (open && projectId) {
      fetchQuotationMaterials();
    }
  }, [open, projectId]);

  const fetchQuotationMaterials = async () => {
    setLoadingQuotation(true);
    try {
      const quotation = await request<{ id: string; items: Array<{ id: string; materialName: string; unit: string; quantity: number }> }>(`/api/projects/${projectId}/quotation`).catch(() => null);
      if (!quotation?.items?.length) {
        setHasQuotation(!!quotation);
        setQuotationMaterials([]);
        setAlreadyOrderedQty({});
        setLoadingQuotation(false);
        return;
      }
      setHasQuotation(true);
      setQuotationMaterials(quotation.items.map((i) => ({ id: i.id, material_name: i.materialName, unit: i.unit, quantity: i.quantity })));

      const orders = await request<Array<{ id: string }>>(`/api/orders?projectId=${projectId}&limit=200`).catch(() => []);
      const orderedQtyMap: AlreadyOrderedQty = {};
      for (const o of orders) {
        const orderWithItems = await request<{ items?: Array<{ quotationItemId?: string | null; quantityOrdered: number; }>; 
      }>(`/api/orders/${o.id}?includeItems=true`)
      .catch(() => ({ items: [] }));
        orderWithItems.items?.forEach((item: { quotationItemId?: string | null; quantityOrdered: number }) => {
          if (item.quotationItemId) {
            orderedQtyMap[item.quotationItemId] = (orderedQtyMap[item.quotationItemId] || 0) + item.quantityOrdered;
          }
        });
      }
      setAlreadyOrderedQty(orderedQtyMap);
      setMaterials([{ id: crypto.randomUUID(), materialId: '', materialName: '', unit: '', quantity: 1 }]);
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

    const remainingAllowed = getRemainingAllowedQty(quotationItemId);
    
    // If no remaining quantity, show warning and set quantity to 0
    if (remainingAllowed <= 0) {
      toast({
        title: "No remaining quantity",
        description: `No remaining quantity available for "${quotationItem.material_name}" based on quotation.`,
        variant: "destructive",
      });
    }

    setMaterials(
      materials.map((m) =>
        m.id === rowId
          ? {
              ...m,
              materialId: quotationItemId,
              materialName: quotationItem.material_name,
              unit: quotationItem.unit,
              quantity: Math.min(m.quantity, Math.max(remainingAllowed, 1)),
            }
          : m
      )
    );
  };

  const updateQuantity = (id: string, value: number) => {
    const material = materials.find(m => m.id === id);
    if (!material || !material.materialId) {
      setMaterials(
        materials.map((m) =>
          m.id === id ? { ...m, quantity: Math.max(1, value) } : m
        )
      );
      return;
    }

    const quotedQty = getQuotedQty(material.materialId);
    const orderedQty = getAlreadyOrderedQty(material.materialId);
    const remainingAllowed = getRemainingAllowedQty(material.materialId);
    
    let newQuantity = Math.max(0, value);
    
    // Check if quantity exceeds remaining allowed
    if (newQuantity > remainingAllowed) {
      toast({
        title: "Quantity adjusted",
        description: `Requested qty exceeds quotation limit.\nQuotation Qty: ${quotedQty}\nAlready ordered: ${orderedQty}\nRemaining allowed: ${remainingAllowed}\nWe adjusted your input to match the quotation limit.`,
        variant: "destructive",
      });
      newQuantity = remainingAllowed;
    }

    // Ensure minimum of 1 if there's remaining allowed, otherwise 0
    if (remainingAllowed > 0) {
      newQuantity = Math.max(1, newQuantity);
    }

    setMaterials(
      materials.map((m) =>
        m.id === id ? { ...m, quantity: newQuantity } : m
      )
    );
  };

  // Get available materials (exclude already selected AND materials with 0 remaining qty)
  const getAvailableMaterials = (currentRowId: string) => {
    const selectedIds = materials
      .filter(m => m.id !== currentRowId && m.materialId)
      .map(m => m.materialId);
    
    return quotationMaterials.filter(qm => {
      // Exclude already selected materials
      if (selectedIds.includes(qm.id)) return false;
      
      // Check remaining quantity - only include if > 0 OR it's the current selection
      const currentMaterial = materials.find(m => m.id === currentRowId);
      if (currentMaterial?.materialId === qm.id) return true;
      
      const remaining = getRemainingAllowedQty(qm.id);
      return remaining > 0;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: { materials?: string; notes?: string } = {};

    // Validate materials
    const hasInvalidMaterial = materials.some((m) => !m.materialId || m.quantity < 1);
    if (materials.length === 0 || hasInvalidMaterial) {
      newErrors.materials = 'Select at least one material with quantity of at least 1';
    }

    // Validate that no material exceeds remaining allowed
    for (const material of materials) {
      if (material.materialId) {
        const remainingAllowed = getRemainingAllowedQty(material.materialId);
        if (material.quantity > remainingAllowed) {
          newErrors.materials = `Quantity for "${material.materialName}" exceeds remaining allowed (${remainingAllowed})`;
          break;
        }
        if (remainingAllowed <= 0 && material.quantity > 0) {
          newErrors.materials = `No remaining quantity available for "${material.materialName}"`;
          break;
        }
      }
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

    // Final server-side style validation - clamp quantities if needed
    const validatedMaterials = materials.map((m) => {
      const remainingAllowed = getRemainingAllowedQty(m.materialId);
      const clampedQty = Math.min(m.quantity, remainingAllowed);
      
      if (clampedQty !== m.quantity) {
        toast({
          title: "Quantity adjusted on submission",
          description: `"${m.materialName}" quantity was adjusted from ${m.quantity} to ${clampedQty} to match quotation limit.`,
        });
      }
      
      return {
        materialId: m.materialId,
        name: m.materialName,
        unit: m.unit,
        quantity: Math.max(0, clampedQty),
      };
    }).filter(m => m.quantity > 0);

    if (validatedMaterials.length === 0) {
      toast({
        title: "Cannot create order",
        description: "All materials have 0 remaining quantity available.",
        variant: "destructive",
      });
      return;
    }

    await onSubmit({
      materials: validatedMaterials,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  const quotedQty = material.materialId ? getQuotedQty(material.materialId) : 0;
                  const orderedQty = material.materialId ? getAlreadyOrderedQty(material.materialId) : 0;
                  const remainingQty = material.materialId ? getRemainingAllowedQty(material.materialId) : 0;
                  const hasExceeded = material.materialId && material.quantity > remainingQty;
                  const noRemaining = material.materialId && remainingQty <= 0;

                  return (
                    <div key={material.id} className="space-y-1">
                      <div className="flex gap-2 items-start">
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
                              {availableMaterials.map((qm) => {
                                const remaining = getRemainingAllowedQty(qm.id);
                                return (
                                  <SelectItem 
                                    key={qm.id} 
                                    value={qm.id}
                                    disabled={remaining <= 0}
                                  >
                                    {qm.material_name} {remaining <= 0 && "(fully ordered)"}
                                  </SelectItem>
                                );
                              })}
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
                        <div className="w-24">
                          <Input
                            type="number"
                            min={0}
                            max={remainingQty > 0 ? remainingQty : undefined}
                            placeholder="Qty"
                            value={material.quantity}
                            onChange={(e) => updateQuantity(material.id, parseInt(e.target.value) || 0)}
                            onBlur={(e) => updateQuantity(material.id, parseInt(e.target.value) || 0)}
                            disabled={noRemaining}
                            className={cn(
                              (errors.materials && material.quantity < 1) || hasExceeded || noRemaining
                                ? 'border-destructive'
                                : ''
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

                      {/* Helper text showing quotation limits */}
                      {material.materialId && (
                        <div className={cn(
                          "text-xs ml-1",
                          noRemaining ? "text-destructive" : "text-muted-foreground"
                        )}>
                          Quoted: {quotedQty} | Already Ordered: {orderedQty} | Remaining: {remainingQty}
                          {noRemaining && " — No remaining quantity available"}
                        </div>
                      )}
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
                disabled={materials.length >= quotationMaterials.length || 
                  quotationMaterials.every(qm => getRemainingAllowedQty(qm.id) <= 0)}
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
