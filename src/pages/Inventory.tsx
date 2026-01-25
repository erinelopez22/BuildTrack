import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Package, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { ProjectInventory, SKU, Project, TransactionType } from '@/types/database';

interface InventoryWithRelations extends ProjectInventory {
  sku: SKU;
  project: Project;
}

export default function Inventory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryWithRelations[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'stock_in' | 'stock_out'>('stock_in');
  const [transactionData, setTransactionData] = useState({
    project_id: '',
    sku_id: '',
    quantity: 0,
    notes: '',
  });

  const fetchData = async () => {
    // Fetch inventory with relations
    const { data: inventoryData } = await supabase
      .from('project_inventory')
      .select('*, sku:skus(*), project:projects(*)')
      .order('updated_at', { ascending: false });

    setInventory((inventoryData || []) as InventoryWithRelations[]);

    // Fetch projects
    const { data: projectsData } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active');

    setProjects((projectsData || []) as Project[]);

    // Fetch SKUs
    const { data: skusData } = await supabase
      .from('skus')
      .select('*')
      .eq('is_active', true);

    setSkus((skusData || []) as SKU[]);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Get current inventory
    const { data: currentInventory } = await supabase
      .from('project_inventory')
      .select('*')
      .eq('project_id', transactionData.project_id)
      .eq('sku_id', transactionData.sku_id)
      .single();

    const currentOnHand = currentInventory?.on_hand || 0;
    const newOnHand =
      transactionType === 'stock_in'
        ? currentOnHand + transactionData.quantity
        : currentOnHand - transactionData.quantity;

    if (newOnHand < 0) {
      toast({
        title: 'Error',
        description: 'Cannot reduce inventory below zero',
        variant: 'destructive',
      });
      return;
    }

    // Upsert inventory
    if (currentInventory) {
      await supabase
        .from('project_inventory')
        .update({ on_hand: newOnHand })
        .eq('id', currentInventory.id);
    } else {
      await supabase.from('project_inventory').insert({
        project_id: transactionData.project_id,
        sku_id: transactionData.sku_id,
        on_hand: newOnHand,
      });
    }

    // Create transaction record
    await supabase.from('inventory_transactions').insert({
      project_id: transactionData.project_id,
      sku_id: transactionData.sku_id,
      transaction_type: transactionType as TransactionType,
      quantity: transactionData.quantity,
      quantity_before: currentOnHand,
      quantity_after: newOnHand,
      notes: transactionData.notes || null,
      created_by: user.id,
    });

    toast({ title: 'Success', description: 'Transaction recorded successfully' });
    setIsDialogOpen(false);
    setTransactionData({ project_id: '', sku_id: '', quantity: 0, notes: '' });
    fetchData();
  };

  const getInventoryStatus = (item: ProjectInventory) => {
    if (item.on_hand <= 0) return 'critical';
    if (item.min_threshold && item.on_hand <= item.min_threshold) return 'low';
    return 'ok';
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.sku?.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.sku?.sku_code?.toLowerCase().includes(search.toLowerCase()) ||
      item.project?.name?.toLowerCase().includes(search.toLowerCase());

    const matchesProject =
      selectedProject === 'all' || item.project_id === selectedProject;

    return matchesSearch && matchesProject;
  });

  const columns: Column<InventoryWithRelations>[] = [
    {
      key: 'sku',
      header: 'SKU / Item',
      render: (item) => (
        <div>
          <p className="font-medium">{item.sku?.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{item.sku?.sku_code}</p>
        </div>
      ),
    },
    {
      key: 'project',
      header: 'Project',
      render: (item) => (
        <p className="text-sm text-muted-foreground">{item.project?.name}</p>
      ),
    },
    {
      key: 'on_hand',
      header: 'On Hand',
      render: (item) => (
        <span className="font-medium">{item.on_hand}</span>
      ),
      className: 'text-right',
    },
    {
      key: 'reserved',
      header: 'Reserved',
      render: (item) => item.reserved,
      className: 'text-right',
    },
    {
      key: 'available',
      header: 'Available',
      render: (item) => (
        <span className="font-medium">{item.on_hand - item.reserved}</span>
      ),
      className: 'text-right',
    },
    {
      key: 'min_threshold',
      header: 'Min Threshold',
      render: (item) => item.min_threshold || '-',
      className: 'text-right',
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={getInventoryStatus(item)} />,
    },
  ];

  if (!loading && inventory.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Inventory" description="Manage project inventory levels" />
        <EmptyState
          icon={Package}
          title="No inventory items"
          description="Add SKUs to your projects to start tracking inventory."
          action={{
            label: 'Record Stock In',
            onClick: () => setIsDialogOpen(true),
          }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage project inventory levels"
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Record Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Inventory Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleTransaction} className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={transactionType === 'stock_in' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setTransactionType('stock_in')}
                  >
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Stock In
                  </Button>
                  <Button
                    type="button"
                    variant={transactionType === 'stock_out' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setTransactionType('stock_out')}
                  >
                    <ArrowDown className="mr-2 h-4 w-4" />
                    Stock Out
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Project *</Label>
                  <Select
                    value={transactionData.project_id}
                    onValueChange={(value) =>
                      setTransactionData({ ...transactionData, project_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Select
                    value={transactionData.sku_id}
                    onValueChange={(value) =>
                      setTransactionData({ ...transactionData, sku_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {skus.map((sku) => (
                        <SelectItem key={sku.id} value={sku.id}>
                          {sku.sku_code} - {sku.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={transactionData.quantity}
                    onChange={(e) =>
                      setTransactionData({
                        ...transactionData,
                        quantity: parseInt(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={transactionData.notes}
                    onChange={(e) =>
                      setTransactionData({ ...transactionData, notes: e.target.value })
                    }
                    placeholder="Optional notes"
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
                  <Button type="submit">Record Transaction</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredInventory}
        loading={loading}
        emptyMessage="No inventory items found"
      />
    </div>
  );
}