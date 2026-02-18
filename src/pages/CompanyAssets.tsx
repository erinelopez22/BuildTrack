import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/activityLogger';
import { formatManilaTime } from '@/lib/notificationService';
import {
  Wrench,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Package,
  ArrowLeftRight,
} from 'lucide-react';
import type { CompanyAsset, AssetType, AssetCondition, BorrowTransaction, Project, Profile } from '@/types/database';

interface BorrowWithDetails extends BorrowTransaction {
  project?: Project;
  borrower_profile?: Profile;
}

export default function CompanyAssets() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState<CompanyAsset[]>([]);
  const [borrowTransactions, setBorrowTransactions] = useState<BorrowWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CompanyAsset | null>(null);
  const [deleteAsset, setDeleteAsset] = useState<CompanyAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CompanyAsset | null>(null);

  // Return modal
  const [returnTransaction, setReturnTransaction] = useState<BorrowWithDetails | null>(null);
  const [returnQty, setReturnQty] = useState(0);
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returning, setReturning] = useState(false);

  // Form state
  const [form, setForm] = useState({
    asset_name: '',
    asset_type: 'Material' as AssetType,
    asset_code: '',
    unit: '',
    total_quantity: 0,
    condition: 'Available' as AssetCondition,
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    const [assetsRes, borrowRes] = await Promise.all([
      supabase.from('company_assets').select('*').order('asset_name'),
      supabase.from('borrow_transactions').select('*').neq('status', 'Returned').order('borrowed_at', { ascending: false }),
    ]);

    setAssets((assetsRes.data || []) as CompanyAsset[]);

    // Fetch project names and borrower profiles for transactions
    const transactions = (borrowRes.data || []) as BorrowTransaction[];
    if (transactions.length > 0) {
      const projectIds = [...new Set(transactions.map(t => t.project_id))];
      const userIds = [...new Set(transactions.map(t => t.borrowed_by))];
      
      const [projectsRes, profilesRes] = await Promise.all([
        supabase.from('projects').select('id, name').in('id', projectIds),
        supabase.from('profiles').select('id, full_name, email').in('id', userIds),
      ]);

      const projectMap = new Map((projectsRes.data || []).map(p => [p.id, p]));
      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));

      setBorrowTransactions(transactions.map(t => ({
        ...t,
        project: projectMap.get(t.project_id) as Project | undefined,
        borrower_profile: profileMap.get(t.borrowed_by) as Profile | undefined,
      })));
    } else {
      setBorrowTransactions([]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getAvailableQty = (asset: CompanyAsset): number => {
    const borrowed = borrowTransactions
      .filter(t => t.asset_id === asset.id && t.status !== 'Returned')
      .reduce((sum, t) => sum + (t.borrowed_qty - t.returned_qty), 0);
    return Math.max(0, asset.total_quantity - borrowed);
  };

  const getBorrowedQty = (asset: CompanyAsset): number => {
    return borrowTransactions
      .filter(t => t.asset_id === asset.id && t.status !== 'Returned')
      .reduce((sum, t) => sum + (t.borrowed_qty - t.returned_qty), 0);
  };

  const filteredAssets = useMemo(() => {
    if (!search) return assets;
    const q = search.toLowerCase();
    return assets.filter(a =>
      a.asset_name.toLowerCase().includes(q) ||
      a.asset_type.toLowerCase().includes(q) ||
      (a.asset_code || '').toLowerCase().includes(q)
    );
  }, [assets, search]);

  const openCreate = () => {
    setEditingAsset(null);
    setForm({ asset_name: '', asset_type: 'Material', asset_code: '', unit: '', total_quantity: 0, condition: 'Available', notes: '' });
    setIsFormOpen(true);
  };

  const openEdit = (asset: CompanyAsset) => {
    setEditingAsset(asset);
    setForm({
      asset_name: asset.asset_name,
      asset_type: asset.asset_type,
      asset_code: asset.asset_code || '',
      unit: asset.unit || '',
      total_quantity: asset.total_quantity,
      condition: asset.condition,
      notes: asset.notes || '',
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.asset_name.trim()) {
      toast({ title: 'Error', description: 'Asset name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);

    if (editingAsset) {
      // Client-side guard for borrowed qty
      const borrowed = getBorrowedQty(editingAsset);
      if (form.total_quantity < borrowed) {
        toast({ title: 'Error', description: `Total quantity cannot be lower than currently borrowed quantity (${borrowed}).`, variant: 'destructive' });
        setSaving(false);
        return;
      }
      const { error } = await supabase.from('company_assets').update({
        asset_name: form.asset_name.trim(),
        asset_type: form.asset_type,
        unit: form.unit.trim() || null,
        total_quantity: form.total_quantity,
        condition: form.condition,
        notes: form.notes.trim() || null,
      }).eq('id', editingAsset.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Asset updated' });
        setIsFormOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from('company_assets').insert({
        asset_name: form.asset_name.trim(),
        asset_type: form.asset_type,
        unit: form.unit.trim() || null,
        total_quantity: form.total_quantity,
        condition: form.condition,
        notes: form.notes.trim() || null,
        created_by: user?.id,
      });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Asset created' });
        setIsFormOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteAsset) return;
    // Client-side guard
    const borrowed = getBorrowedQty(deleteAsset);
    if (borrowed > 0) {
      toast({ title: 'Error', description: `Cannot delete this asset because there are still borrowed items (${borrowed}). Please return all borrowed items before deleting.`, variant: 'destructive' });
      setDeleteAsset(null);
      return;
    }
    const { error } = await supabase.from('company_assets').delete().eq('id', deleteAsset.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Asset deleted' });
      fetchData();
    }
    setDeleteAsset(null);
  };

  const handleReturn = async () => {
    if (!returnTransaction || returnQty <= 0) return;
    setReturning(true);

    const maxReturnable = returnTransaction.borrowed_qty - returnTransaction.returned_qty;
    const actualReturn = Math.min(returnQty, maxReturnable);
    const newReturnedQty = returnTransaction.returned_qty + actualReturn;
    const newStatus = newReturnedQty >= returnTransaction.borrowed_qty ? 'Returned' : 'Partially Returned';

    const { error } = await supabase.from('borrow_transactions').update({
      returned_qty: newReturnedQty,
      returned_at: new Date().toISOString(),
      return_remarks: returnRemarks.trim() || null,
      status: newStatus,
    }).eq('id', returnTransaction.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await logActivity({
        action: 'return',
        tableName: 'borrow_transactions',
        recordId: returnTransaction.id,
        newValues: { returned_qty: actualReturn, status: newStatus },
        userId: user?.id || null,
      });

      toast({ title: 'Success', description: `Returned ${actualReturn} item(s)` });
      setReturnTransaction(null);
      setReturnQty(0);
      setReturnRemarks('');
      fetchData();
    }
    setReturning(false);
  };

  const canManage = isAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Company Materials/Tool"
        description="Manage company-owned assets that can be borrowed by projects"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        )}
      </div>

      {filteredAssets.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No assets yet"
          description="Add company materials, tools, or equipment to manage."
          action={canManage ? { label: 'Add Asset', onClick: openCreate } : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => {
            const available = getAvailableQty(asset);
            const borrowed = getBorrowedQty(asset);
            const assetBorrows = borrowTransactions.filter(t => t.asset_id === asset.id && t.status !== 'Returned');

            return (
              <Card key={asset.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground truncate">{asset.asset_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{asset.asset_type}</Badge>
                        {asset.asset_code && (
                          <span className="text-xs text-muted-foreground font-mono">{asset.asset_code}</span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(asset)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteAsset(asset)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-lg font-bold text-foreground">{asset.total_quantity}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                    <div className="rounded-md bg-success/10 p-2">
                      <p className="text-lg font-bold text-success">{available}</p>
                      <p className="text-[10px] text-muted-foreground">Available</p>
                    </div>
                    <div className="rounded-md bg-warning/10 p-2">
                      <p className="text-lg font-bold text-warning">{borrowed}</p>
                      <p className="text-[10px] text-muted-foreground">Borrowed</p>
                    </div>
                  </div>

                  {asset.unit && (
                    <p className="text-xs text-muted-foreground">Unit: {asset.unit}</p>
                  )}

                  {/* Current borrows */}
                  {assetBorrows.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <ArrowLeftRight className="h-3 w-3" />
                        Currently Borrowed
                      </p>
                      {assetBorrows.map((bt) => (
                        <div key={bt.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{bt.project?.name || 'Unknown Project'}</p>
                            <p className="text-muted-foreground">
                              Qty: {bt.borrowed_qty - bt.returned_qty} • {bt.borrower_profile?.full_name || 'Unknown'}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2 ml-2"
                            onClick={() => {
                              setReturnTransaction(bt);
                              setReturnQty(bt.borrowed_qty - bt.returned_qty);
                              setReturnRemarks('');
                            }}
                          >
                            Return
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Asset Name <span className="text-destructive">*</span></Label>
              <Input value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} placeholder="e.g. Concrete Mixer" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v as AssetType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Material">Material</SelectItem>
                    <SelectItem value="Tool">Tool</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Condition</Label>
                <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v as AssetCondition })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Asset Code</Label>
                {editingAsset ? (
                  <Input value={form.asset_code} readOnly disabled className="bg-muted font-mono" />
                ) : (
                  <Input value="Auto-generated" readOnly disabled className="bg-muted text-muted-foreground italic" />
                )}
              </div>
              <div>
                <Label>Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. pcs" />
              </div>
            </div>
            <div>
              <Label>Total Quantity</Label>
              <Input type="number" min={0} value={form.total_quantity} onChange={(e) => setForm({ ...form, total_quantity: parseInt(e.target.value) || 0 })} />
              {editingAsset && (() => {
                const borrowed = getBorrowedQty(editingAsset);
                const available = getAvailableQty(editingAsset);
                const newTotal = form.total_quantity;
                const isBelowBorrowed = newTotal < borrowed;
                return (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Currently Borrowed: <span className="font-medium text-foreground">{borrowed}</span> · Available: <span className="font-medium text-foreground">{available}</span></p>
                    {isBelowBorrowed && (
                      <p className="text-xs text-destructive">Not allowed: Total quantity cannot be lower than currently borrowed quantity ({borrowed}). Return borrowed items first or set the quantity to at least {borrowed}.</p>
                    )}
                  </div>
                );
              })()}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || (editingAsset ? form.total_quantity < getBorrowedQty(editingAsset) : false)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingAsset ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAsset} onOpenChange={() => setDeleteAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAsset && getBorrowedQty(deleteAsset) > 0
                ? `Cannot delete this asset because there are still borrowed items (${getBorrowedQty(deleteAsset!)}). Please return all borrowed items before deleting.`
                : `Are you sure you want to delete "${deleteAsset?.asset_name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteAsset ? getBorrowedQty(deleteAsset) > 0 : false}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Modal */}
      <Dialog open={!!returnTransaction} onOpenChange={() => setReturnTransaction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Return Asset</DialogTitle>
          </DialogHeader>
          {returnTransaction && (
            <div className="space-y-4">
              <div className="text-sm">
                <p className="text-muted-foreground">Borrowed: {returnTransaction.borrowed_qty}</p>
                <p className="text-muted-foreground">Already returned: {returnTransaction.returned_qty}</p>
                <p className="font-medium">Remaining: {returnTransaction.borrowed_qty - returnTransaction.returned_qty}</p>
              </div>
              <div>
                <Label>Return Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={returnTransaction.borrowed_qty - returnTransaction.returned_qty}
                  value={returnQty}
                  onChange={(e) => setReturnQty(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Remarks</Label>
                <Textarea value={returnRemarks} onChange={(e) => setReturnRemarks(e.target.value)} placeholder="Optional" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnTransaction(null)}>Cancel</Button>
            <Button onClick={handleReturn} disabled={returning || returnQty <= 0}>
              {returning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
