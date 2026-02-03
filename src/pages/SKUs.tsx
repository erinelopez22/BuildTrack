import { useState, useEffect } from 'react';
import { request } from '@/integrations/api';
import { useAuth } from '@/contexts/AuthContext';
import { mapApiSku, type ApiSku } from '@/lib/apiMappers';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Boxes, Search } from 'lucide-react';
import type { SKU } from '@/types/database';

export default function SKUs() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    sku_code: '',
    name: '',
    description: '',
    category: '',
    unit_of_measure: 'EA',
    brand: '',
    default_min_threshold: 10,
  });

  const fetchSKUs = async () => {
    try {
      const data = await request<ApiSku[]>('/api/skus');
      setSKUs((data ?? []).map(mapApiSku));
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to load SKUs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSKUs();
  }, []);

  const handleCreateSKU = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await request('/api/skus', {
        method: 'POST',
        body: {
          skuCode: formData.sku_code || undefined,
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          unitOfMeasure: formData.unit_of_measure,
          brand: formData.brand || null,
          defaultMinThreshold: formData.default_min_threshold,
        },
      });
      toast({ title: 'Success', description: 'SKU created successfully' });
      setIsDialogOpen(false);
      setFormData({
        sku_code: '',
        name: '',
        description: '',
        category: '',
        unit_of_measure: 'EA',
        brand: '',
        default_min_threshold: 10,
      });
      fetchSKUs();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create SKU', variant: 'destructive' });
    }
  };

  const filteredSKUs = skus.filter(
    (sku) =>
      sku.name.toLowerCase().includes(search.toLowerCase()) ||
      sku.sku_code.toLowerCase().includes(search.toLowerCase()) ||
      sku.category?.toLowerCase().includes(search.toLowerCase()) ||
      sku.brand?.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<SKU>[] = [
    {
      key: 'sku_code',
      header: 'SKU Code',
      render: (sku) => (
        <span className="font-mono text-sm">{sku.sku_code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (sku) => (
        <div>
          <p className="font-medium">{sku.name}</p>
          {sku.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {sku.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (sku) => sku.category || '-',
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (sku) => sku.brand || '-',
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (sku) => sku.unit_of_measure,
    },
    {
      key: 'threshold',
      header: 'Min Threshold',
      render: (sku) => sku.default_min_threshold,
      className: 'text-right',
    },
    {
      key: 'status',
      header: 'Status',
      render: (sku) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
            sku.is_active
              ? 'bg-success/10 text-success'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {sku.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  if (!loading && skus.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="SKU Catalog" description="Manage your global SKU catalog" />
        <EmptyState
          icon={Boxes}
          title="No SKUs yet"
          description="Create your first SKU to start building your inventory catalog."
          action={
            isAdmin()
              ? {
                  label: 'Create SKU',
                  onClick: () => setIsDialogOpen(true),
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="SKU Catalog"
        description="Manage your global SKU catalog"
        action={
          isAdmin() && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New SKU
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New SKU</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSKU} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SKU Code</Label>
                      <Input
                        value={formData.sku_code}
                        onChange={(e) =>
                          setFormData({ ...formData, sku_code: e.target.value })
                        }
                        placeholder="Auto-generated if empty"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit of Measure *</Label>
                      <Input
                        value={formData.unit_of_measure}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            unit_of_measure: e.target.value,
                          })
                        }
                        placeholder="EA, BOX, KG, etc."
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Item Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                        placeholder="e.g., Hardware, Electrical"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Brand</Label>
                      <Input
                        value={formData.brand}
                        onChange={(e) =>
                          setFormData({ ...formData, brand: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Min Stock Threshold</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.default_min_threshold}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_min_threshold: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create SKU</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search SKUs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredSKUs}
        loading={loading}
        emptyMessage="No SKUs found"
      />
    </div>
  );
}