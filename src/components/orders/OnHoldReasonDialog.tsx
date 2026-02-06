import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PauseCircle, Loader2 } from 'lucide-react';

interface OnHoldReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  onConfirm: (reason: string) => Promise<void>;
  isSubmitting: boolean;
}

export function OnHoldReasonDialog({
  open,
  onOpenChange,
  orderNumber,
  onConfirm,
  isSubmitting,
}: OnHoldReasonDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = async () => {
    if (reason.trim()) {
      await onConfirm(reason.trim());
      setReason('');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('');
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <PauseCircle className="h-5 w-5" />
            Place Order On-Hold
          </AlertDialogTitle>
          <AlertDialogDescription>
            You are about to place order <span className="font-semibold">{orderNumber}</span> on hold.
            Please provide a reason for this action.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="on-hold-reason">On-Hold Reason *</Label>
          <Textarea
            id="on-hold-reason"
            placeholder="Enter the reason for placing on hold..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason.trim() || isSubmitting}
            className="bg-amber-500 text-white hover:bg-amber-600"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Place On-Hold'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
