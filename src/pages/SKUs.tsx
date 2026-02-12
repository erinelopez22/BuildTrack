import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Boxes, Search, MoreVertical, Eye, Pencil, Trash2, ArrowUpDown, Loader2 } from 'lucide-react';
import type { SKU } from '@/types/database';

const UNIT_OPTIONS = ['pcs', 'bag', 'kg', 'm', 'box', 'set', 'liter', 'roll', 'bundle', 'sheet', 'EA'];

type SortField = 'name' | 'created_at';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'inactive';
type ModalMode = 'add' | 'edit' | 'view' | null;

export default function SKUs() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [skuToDelete, setSkuToDelete] = useState<SKU | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formCustomUnit, setFormCustomUnit] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState('');

  const fetchSKUs = async () => {
    const { data, error } = await supabase
      .from('skus')
      .select('*')
      .order(sortField === 'name' ? 'name' : 'created_at', { ascending: sortDir === 'asc' });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSKUs(data as SKU[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSKUs();
  }, [sortField, sortDir]);

  const filteredSKUs = skus.filter((sku) => {
    const matchesSearch =
      sku.name.toLowerCase().includes(search.toLowerCase()) ||
      sku.sku_code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && sku.is_active) ||
      (statusFilter === 'inactive' && !sku.is_active);
    return matchesSearch && matchesStatus;
  });

  // Normalize: uppercase, trim, collapse multiple spaces
  const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toUpperCase();

  const resetForm = () => {
    setFormName('');
    setFormUnit('pcs');
    setFormCustomUnit('');
    setFormDescription('');
    setFormStatus('active');
    setFormError('');
  };

  const openAddModal = () => {
    resetForm();
    setSelectedSku(null);
    setModalMode('add');
  };

  const openEditModal = (sku: SKU) => {
    setSelectedSku(sku);
    setFormName(sku.name);
    const unitLower = sku.unit_of_measure.toLowerCase();
    if (UNIT_OPTIONS.map(u => u.toLowerCase()).includes(unitLower)) {
      setFormUnit(sku.unit_of_measure);
      setFormCustomUnit('');
    } else {
      setFormUnit('custom');
      setFormCustomUnit(sku.unit_of_measure);
    }
    setFormDescription(sku.description || '');
    setFormStatus(sku.is_active ? 'active' : 'inactive');
    setModalMode('edit');
  };

  const openViewModal = (sku: SKU) => {
    setSelectedSku(sku);
    setModalMode('view');
  };

  const checkDuplicate = (name: string, unit: string, excludeId?: string): boolean => {
    const normalizedName = normalizeName(name);
    const normalizedUnit = unit.trim().toUpperCase();
    return skus.some(
      (sku) =>
        sku.id !== excludeId &&
        sku.is_active &&
        normalizeName(sku.name) === normalizedName &&
        sku.unit_of_measure.trim().toUpperCase() === normalizedUnit
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) return;

    const unit = formUnit === 'custom' ? formCustomUnit.trim() : formUnit;
    if (!unit) {
      toast({ title: 'Error', description: 'Unit is required', variant: 'destructive' });
      return;
    }

    const normalizedName = normalizeName(formName);

    // Check duplicate (name + unit)
    const excludeId = modalMode === 'edit' ? selectedSku?.id : undefined;
    if (checkDuplicate(normalizedName, unit, excludeId)) {
      setFormError('Material already exists with the same unit. Use a different unit or choose the existing SKU.');
      return;
    }

    setSaving(true);

    if (modalMode === 'add') {
      const { error } = await supabase.from('skus').insert({
        name: normalizedName,
        sku_code: '',
        unit_of_measure: unit,
        description: formDescription.trim() || null,
        is_active: true,
        created_by: user?.id,
      });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Material added successfully' });
        setModalMode(null);
        fetchSKUs();
      }
    } else if (modalMode === 'edit' && selectedSku) {
      const { error } = await supabase
        .from('skus')
        .update({
          name: normalizedName,
          unit_of_measure: unit,
          description: formDescription.trim() || null,
          is_active: formStatus === 'active',
        })
        .eq('id', selectedSku.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Material updated successfully' });
        setModalMode(null);
        fetchSKUs();
      }
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!skuToDelete) return;
    setDeleting(true);

    // Check if SKU is referenced in order_items
    const { data: refs } = await supabase
      .from('order_items')
      .select('id')
      .eq('sku_id', skuToDelete.id)
      .limit(1);

    if (refs && refs.length > 0) {
      toast({
        title: 'Cannot delete',
        description: 'This material is referenced in existing orders. Set it to Inactive instead.',
        variant: 'destructive',
      });
      setDeleting(false);
      setShowDeleteConfirm(false);
      return;
    }

    // Check quotation_items too (via sku name match in case)
    const { error } = await supabase.from('skus').delete().eq('id', skuToDelete.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Material removed from catalogue' });
      fetchSKUs();
    }

    setDeleting(false);
    setShowDeleteConfirm(false);
    setSkuToDelete(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  if (!loading && skus.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="SKU Catalogue" description="Manage construction materials master list" />
        <EmptyState
          icon={Boxes}
          title="No materials yet"
          description="Add your first material to start building your SKU catalogue."
          action={
            isAdmin()
              ? { label: 'Add Material', onClick: openAddModal }
              : undefined
          }
        />
        {/* Render add modal even on empty state */}
        {renderFormModal()}
      </div>
    );
  }

  function renderFormModal() {
    const isView = modalMode === 'view';
    const title =
      modalMode === 'add' ? 'Add Material' : modalMode === 'edit' ? 'Edit Material' : 'Material Details';

    return (
      <Dialog open={modalMode !== null} onOpenChange={(open) => !open && setModalMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {isView && selectedSku ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">SKU ID</p>
                  <p className="font-mono text-sm">{selectedSku.sku_code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      selectedSku.is_active
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {selectedSku.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Material Name</p>
                <p className="font-medium">{selectedSku.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unit</p>
                <p>{selectedSku.unit_of_measure}</p>
              </div>
              {selectedSku.description && (
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm">{selectedSku.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Date Added</p>
                <p className="text-sm">{format(new Date(selectedSku.created_at), 'MMM dd, yyyy')}</p>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setModalMode(null)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Material Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value.toUpperCase());
                    setFormError('');
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text').toUpperCase();
                    setFormName(pasted);
                    setFormError('');
                  }}
                  placeholder="e.g., PORTLAND CEMENT"
                  required
                  style={{ textTransform: 'uppercase' }}
                />
                {formError && (
                  <p className="text-xs text-destructive mt-1">{formError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Unit <span className="text-destructive">*</span>
                </Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {formUnit === 'custom' && (
                  <Input
                    value={formCustomUnit}
                    onChange={(e) => setFormCustomUnit(e.target.value)}
                    placeholder="Enter custom unit"
                    required
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              {modalMode === 'edit' && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formStatus} onValueChange={(v) => setFormStatus(v as 'active' | 'inactive')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setModalMode(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {modalMode === 'add' ? 'Add Material' : 'Update Material'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="SKU Catalogue"
        description="Manage construction materials master list"
        action={
          isAdmin() && (
            <Button onClick={openAddModal}>
              <Plus className="mr-2 h-4 w-4" />
              Add Material
            </Button>
          )
        }
      />

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by SKU ID or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">SKU ID</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort('name')}
                >
                  Material Name
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="w-[80px]">Unit</TableHead>
              <TableHead className="w-[130px]">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort('created_at')}
                >
                  Date Added
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredSKUs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No materials found
                </TableCell>
              </TableRow>
            ) : (
              filteredSKUs.map((sku) => (
                <TableRow key={sku.id}>
                  <TableCell className="font-mono text-xs">{sku.sku_code}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sku.name}</p>
                      {sku.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{sku.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{sku.unit_of_measure}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(sku.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        sku.is_active
                          ? 'bg-success/10 text-success'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {sku.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {isAdmin() && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openViewModal(sku)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditModal(sku)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSkuToDelete(sku);
                              setShowDeleteConfirm(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {renderFormModal()}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this material?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{skuToDelete?.name}" from the catalogue. If it's referenced in orders, deletion will be blocked — use Inactive instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
