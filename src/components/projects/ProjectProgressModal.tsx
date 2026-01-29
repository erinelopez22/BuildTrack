import { useState, useEffect } from "react";
import { Search, Package, CheckCircle2, AlertCircle, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useProjectProgress } from "@/hooks/useProjectProgress";

interface ProjectProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  refreshKey?: number;
}

export function ProjectProgressModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  refreshKey = 0,
}: ProjectProgressModalProps) {
  const progress = useProjectProgress(projectId, refreshKey);
  const [searchQuery, setSearchQuery] = useState("");
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);

  // Reset filters when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setShowIncompleteOnly(false);
    }
  }, [open]);

  // Filter materials based on search and incomplete filter
  const filteredMaterials = progress.materialProgress.filter((material) => {
    const matchesSearch = material.materialName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesIncomplete = !showIncompleteOnly || material.remainingQty > 0;
    return matchesSearch && matchesIncomplete;
  });

  const totalQuoted = progress.materialProgress.reduce((sum, m) => sum + m.quotedQty, 0);
  const totalReceived = progress.materialProgress.reduce((sum, m) => sum + m.deliveredQty, 0);
  const totalRemaining = progress.materialProgress.reduce((sum, m) => sum + m.remainingQty, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Project Progress - {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Empty State */}
          {!progress.hasQuotation ? (
            <div className="text-center py-12 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">No Quotation Found</h3>
                <p className="text-muted-foreground mt-1">
                  Add a quotation to this project to track material progress.
                </p>
              </div>
              <div className="text-4xl font-bold text-muted-foreground">0%</div>
            </div>
          ) : (
            <>
              {/* Overall Summary */}
              <div className="space-y-4 p-4 bg-primary/5 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Project Progress</span>
                  <span className="text-2xl font-bold text-primary">
                    {progress.percentage.toFixed(0)}%
                  </span>
                </div>
                <Progress value={progress.percentage} className="h-4" />
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-background rounded-lg">
                    <div className="text-2xl font-bold">{totalQuoted}</div>
                    <div className="text-xs text-muted-foreground">Total Quoted</div>
                  </div>
                  <div className="p-3 bg-background rounded-lg">
                    <div className="text-2xl font-bold text-primary">{totalReceived}</div>
                    <div className="text-xs text-muted-foreground">Total Received</div>
                  </div>
                  <div className="p-3 bg-background rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{totalRemaining}</div>
                    <div className="text-xs text-muted-foreground">Total Remaining</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Based on quantity_received from Delivered + Closed orders
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search materials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="incomplete-filter" className="text-sm cursor-pointer">
                    Incomplete only
                  </Label>
                  <Switch
                    id="incomplete-filter"
                    checked={showIncompleteOnly}
                    onCheckedChange={setShowIncompleteOnly}
                  />
                </div>
              </div>

              {/* Itemized Progress List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Material Progress ({filteredMaterials.length} of {progress.materialProgress.length})
                  </Label>
                </div>

                {filteredMaterials.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery || showIncompleteOnly
                      ? "No materials match your filters"
                      : "No materials in quotation"}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium">Material</th>
                            <th className="text-center p-3 font-medium w-16">Unit</th>
                            <th className="text-center p-3 font-medium w-24">Quoted</th>
                            <th className="text-center p-3 font-medium w-24">Received</th>
                            <th className="text-center p-3 font-medium w-24">Remaining</th>
                            <th className="text-center p-3 font-medium w-32">Progress</th>
                            <th className="text-center p-3 font-medium w-24">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredMaterials.map((material, index) => {
                            const isComplete = material.percentage >= 100;
                            const isPartial = material.deliveredQty > 0 && !isComplete;
                            
                            return (
                              <tr key={index} className="hover:bg-muted/30">
                                <td className="p-3 font-medium">{material.materialName}</td>
                                <td className="p-3 text-center text-muted-foreground">
                                  {material.unit}
                                </td>
                                <td className="p-3 text-center">{material.quotedQty}</td>
                                <td className="p-3 text-center font-medium text-primary">
                                  {material.deliveredQty}
                                </td>
                                <td className="p-3 text-center text-muted-foreground">
                                  {material.remainingQty}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <Progress value={material.percentage} className="h-2 flex-1" />
                                    <span className="text-xs font-medium w-12 text-right">
                                      {material.percentage}%
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  {isComplete ? (
                                    <Badge
                                      variant="default"
                                      className="bg-green-600 hover:bg-green-700 text-xs"
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Complete
                                    </Badge>
                                  ) : isPartial ? (
                                    <Badge variant="secondary" className="text-xs">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Partial
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-xs text-muted-foreground"
                                    >
                                      Pending
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
