import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  TruckIcon,
  Loader2,
  Package,
  ChevronDown,
  ChevronRight,
  Calendar,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeliveredMaterial {
  materialName: string;
  unit: string;
  deliveredQty: number;
  lastDeliveredAt: string | null;
}

interface DeliveredOrder {
  id: string;
  order_number: string;
  delivered_at: string | null;
  notes: string | null;
  items: {
    material_name: string;
    unit: string;
    quantity: number;
  }[];
}

interface DeliveredMaterialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

const formatManilaTime = (date: Date): string => {
  const manilaTime = toZonedTime(date, "Asia/Manila");
  return format(manilaTime, "MMM dd, yyyy h:mm a");
};

export function DeliveredMaterialsModal({
  open,
  onOpenChange,
  projectId,
  projectName,
}: DeliveredMaterialsModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<DeliveredMaterial[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<DeliveredOrder[]>([]);
  const [isOrdersExpanded, setIsOrdersExpanded] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchDeliveredData = async () => {
    setLoading(true);
    try {
      // Get delivered orders for this project
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, updated_at, notes")
        .eq("project_id", projectId)
        .eq("status", "delivered")
        .order("updated_at", { ascending: false });

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        setMaterials([]);
        setDeliveredOrders([]);
        setLoading(false);
        return;
      }

      // Get order items with SKU info
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id, quantity_received, quantity_ordered, sku:skus(name, unit_of_measure)")
        .in(
          "order_id",
          orders.map((o) => o.id)
        );

      if (itemsError) throw itemsError;

      // Build materials summary - aggregate by material name
      const materialsMap: Record<string, DeliveredMaterial> = {};

      orderItems?.forEach((item: any) => {
        const materialName = item.sku?.name || "Unknown Material";
        const unit = item.sku?.unit_of_measure || "pcs";
        const qty = item.quantity_received ?? item.quantity_ordered ?? 0;
        const order = orders.find((o) => o.id === item.order_id);
        const deliveredAt = order?.updated_at || null;

        if (!materialsMap[materialName]) {
          materialsMap[materialName] = {
            materialName,
            unit,
            deliveredQty: 0,
            lastDeliveredAt: deliveredAt,
          };
        }

        materialsMap[materialName].deliveredQty += qty;

        // Update last delivered date if more recent
        if (deliveredAt && (!materialsMap[materialName].lastDeliveredAt ||
            new Date(deliveredAt) > new Date(materialsMap[materialName].lastDeliveredAt!))) {
          materialsMap[materialName].lastDeliveredAt = deliveredAt;
        }
      });

      setMaterials(Object.values(materialsMap).sort((a, b) => a.materialName.localeCompare(b.materialName)));

      // Build delivered orders list
      const ordersInfo: DeliveredOrder[] = orders.map((order) => {
        const orderItemsList = orderItems?.filter((item: any) => item.order_id === order.id) || [];
        return {
          id: order.id,
          order_number: order.order_number,
          delivered_at: order.updated_at,
          notes: order.notes,
          items: orderItemsList.map((item: any) => ({
            material_name: item.sku?.name || "Unknown Material",
            unit: item.sku?.unit_of_measure || "pcs",
            quantity: item.quantity_received ?? item.quantity_ordered ?? 0,
          })),
        };
      });

      setDeliveredOrders(ordersInfo.filter((o) => o.items.length > 0));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load delivered materials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDeliveredData();
    }
  }, [open, projectId]);

  const handleOrderClick = (orderId: string) => {
    setSelectedOrderId(orderId);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TruckIcon className="h-5 w-5" />
              Delivered Materials – {projectName}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-1">No Delivered Materials</h3>
              <p className="text-muted-foreground text-sm">
                There are no delivered orders for this project yet.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Delivered Materials Summary Table */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Materials Summary</span>
                  <Badge variant="secondary" className="text-xs">
                    {materials.length} materials
                  </Badge>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Material Name</th>
                        <th className="text-center p-3 font-medium w-20">Unit</th>
                        <th className="text-center p-3 font-medium w-28">Delivered Qty</th>
                        <th className="text-left p-3 font-medium w-44">Last Delivered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {materials.map((material, index) => (
                        <tr key={index} className="hover:bg-muted/30">
                          <td className="p-3 font-medium">{material.materialName}</td>
                          <td className="p-3 text-center text-muted-foreground">{material.unit}</td>
                          <td className="p-3 text-center font-semibold text-primary">
                            {material.deliveredQty}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {material.lastDeliveredAt
                              ? formatManilaTime(new Date(material.lastDeliveredAt))
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delivered Orders Collapsible Section */}
              {deliveredOrders.length > 0 && (
                <Collapsible open={isOrdersExpanded} onOpenChange={setIsOrdersExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between hover:bg-muted/50 border"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Delivered Orders
                        <Badge variant="secondary" className="text-xs">
                          {deliveredOrders.length}
                        </Badge>
                      </span>
                      {isOrdersExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    {deliveredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="border rounded-lg p-4 bg-card hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleOrderClick(order.id)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="font-semibold text-sm">{order.order_number}</span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              {order.delivered_at
                                ? formatManilaTime(new Date(order.delivered_at))
                                : "Unknown date"}
                            </div>
                          </div>
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
                            Delivered
                          </Badge>
                        </div>

                        {order.notes && (
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                            {order.notes}
                          </p>
                        )}

                        <div className="space-y-1 border-t pt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Materials:</p>
                          {order.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{item.material_name}</span>
                              <span className="font-medium">
                                {item.quantity} {item.unit}
                              </span>
                            </div>
                          ))}
                          {order.items.length > 3 && (
                            <p className="text-xs text-muted-foreground italic">
                              +{order.items.length - 3} more items
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Detail Modal */}
      <OrderDetailModal
        open={!!selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />
    </>
  );
}
