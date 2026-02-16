import { useState, useEffect } from "react";
import { Search, Package, CheckCircle2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

  useEffect(() => {
    if (open) {
      setSearchQuery("");
    }
  }, [open]);

  const filteredMaterials = progress.materialProgress.filter((material) => {
    return material.materialName.toLowerCase().includes(searchQuery.toLowerCase());
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

        <div className="space-y-4">
          {!progress.hasQuotation ? (
            <div className="text-center py-8 space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-base font-medium">No Quotation Found</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Add a quotation to this project to track material progress.
                </p>
              </div>
              <div className="text-3xl font-bold text-muted-foreground">0%</div>
            </div>
          ) : (
            <>
              {/* Compact Summary */}
              <div className="p-3 bg-primary/5 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-xl font-bold text-primary">
                    {progress.percentage.toFixed(0)}%
                  </span>
                </div>
                <Progress value={progress.percentage} className="h-3" />
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="p-2 bg-background rounded">
                    <div className="text-lg font-bold">{totalQuoted}</div>
                    <div className="text-[10px] text-muted-foreground">Quoted</div>
                  </div>
                  <div className="p-2 bg-background rounded">
                    <div className="text-lg font-bold text-primary">{totalReceived}</div>
                    <div className="text-[10px] text-muted-foreground">Received</div>
                  </div>
                  <div className="p-2 bg-background rounded">
                    <div className="text-lg font-bold text-orange-600">{totalRemaining}</div>
                    <div className="text-[10px] text-muted-foreground">Remaining</div>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              {/* Material Table */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Material Progress ({filteredMaterials.length} of {progress.materialProgress.length})
                </Label>

                {filteredMaterials.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    {searchQuery ? "No materials match your search" : "No materials in quotation"}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 font-medium">Material</th>
                            <th className="text-center p-2 font-medium w-14">Unit</th>
                            <th className="text-center p-2 font-medium w-28">Quoted/Received</th>
                            <th className="text-center p-2 font-medium w-20">Remaining</th>
                            <th className="text-center p-2 font-medium w-20">Progress %</th>
                            <th className="text-center p-2 font-medium w-20">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredMaterials.map((material, index) => {
                            const isComplete = material.percentage >= 100;
                            const isPartial = material.deliveredQty > 0 && !isComplete;

                            return (
                              <tr key={index} className="hover:bg-muted/30">
                                <td className="p-2 font-medium text-xs">{material.materialName}</td>
                                <td className="p-2 text-center text-muted-foreground text-xs">
                                  {material.unit}
                                </td>
                                <td className="p-2 text-center font-mono text-xs">
                                  {material.quotedQty}/{material.deliveredQty}
                                </td>
                                <td className="p-2 text-center text-muted-foreground text-xs">
                                  {material.remainingQty}
                                </td>
                                <td className="p-2 text-center font-medium text-xs">
                                  {material.percentage}%
                                </td>
                                <td className="p-2 text-center">
                                  {isComplete ? (
                                    <Badge
                                      variant="default"
                                      className="bg-green-600 hover:bg-green-700 text-[10px] px-1.5 py-0"
                                    >
                                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                      Done
                                    </Badge>
                                  ) : isPartial ? (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                                      Partial
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 text-muted-foreground"
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
