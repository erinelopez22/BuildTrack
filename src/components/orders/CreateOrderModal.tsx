import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
}

interface CreateOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onSubmit: (data: {
    materials: { name: string; quantity: number }[];
    expectedDeliveryDate: Date | null;
    notes: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function CreateOrderModal({
  open,
  onOpenChange,
  projectName,
  onSubmit,
  isSubmitting,
}: CreateOrderModalProps) {
  const [materials, setMaterials] = useState<MaterialItem[]>([
    { id: crypto.randomUUID(), name: '', quantity: 1 },
  ]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ materials?: string; notes?: string }>({});

  const addMaterial = () => {
    setMaterials([...materials, { id: crypto.randomUUID(), name: '', quantity: 1 }]);
  };

  const removeMaterial = (id: string) => {
    if (materials.length > 1) {
      setMaterials(materials.filter((m) => m.id !== id));
    }
  };

  const updateMaterial = (id: string, field: 'name' | 'quantity', value: string | number) => {
    setMaterials(
      materials.map((m) =>
        m.id === id ? { ...m, [field]: field === 'quantity' ? Math.max(1, Number(value)) : value } : m
      )
    );
  };

  const validateForm = (): boolean => {
    const newErrors: { materials?: string; notes?: string } = {};

    // Validate materials
    const hasInvalidMaterial = materials.some((m) => !m.name.trim() || m.quantity < 1);
    if (hasInvalidMaterial) {
      newErrors.materials = 'All materials must have a name and quantity of at least 1';
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
      materials: materials.map((m) => ({ name: m.name.trim(), quantity: m.quantity })),
      expectedDeliveryDate: expectedDeliveryDate || null,
      notes: notes.trim(),
    });

    // Reset form on successful submission
    setMaterials([{ id: crypto.randomUUID(), name: '', quantity: 1 }]);
    setExpectedDeliveryDate(undefined);
    setNotes('');
    setErrors({});
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setMaterials([{ id: crypto.randomUUID(), name: '', quantity: 1 }]);
      setExpectedDeliveryDate(undefined);
      setNotes('');
      setErrors({});
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Order for {projectName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Materials List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Materials List <span className="text-destructive">*</span>
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
                <Plus className="h-4 w-4 mr-1" />
                Add Material
              </Button>
            </div>

            <div className="space-y-3">
              {materials.map((material, index) => (
                <div key={material.id} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder="Material name"
                      value={material.name}
                      onChange={(e) => updateMaterial(material.id, 'name', e.target.value)}
                      className={cn(
                        errors.materials && !material.name.trim() && 'border-destructive'
                      )}
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={material.quantity}
                      onChange={(e) => updateMaterial(material.id, 'quantity', e.target.value)}
                      className={cn(
                        errors.materials && material.quantity < 1 && 'border-destructive'
                      )}
                    />
                  </div>
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
              ))}
            </div>

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
              <PopoverContent className="w-auto p-0" align="start">
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
      </DialogContent>
    </Dialog>
  );
}
