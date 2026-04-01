import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface TruncateButtonProps {
  label: string;
  description: string;
  onTruncate: () => Promise<any>;
  onSuccess?: () => void;
}

export function TruncateButton({ label, description, onTruncate, onSuccess }: TruncateButtonProps) {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isSuperAdmin()) return null;

  const handleTruncate = async () => {
    if (confirmText !== "DELETE ALL") return;
    setLoading(true);
    try {
      const result = await onTruncate();
      if (result?.success === false) {
        throw new Error(result.message || "Truncate failed");
      }
      toast({ title: "Success", description: `All ${label.toLowerCase()} data has been permanently deleted.` });
      setOpen(false);
      setConfirmText("");
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Truncate failed.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Truncate
      </Button>

      <AlertDialog open={open} onOpenChange={(v) => { if (!v) { setConfirmText(""); } setOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Truncate {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {description}
              <br /><br />
              This action is <strong>permanent and cannot be undone</strong>. Type <strong>DELETE ALL</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder='Type "DELETE ALL" to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={confirmText !== "DELETE ALL" || loading}
              onClick={handleTruncate}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Confirm Truncate"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
