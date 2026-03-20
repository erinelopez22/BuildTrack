import { useState, useEffect } from 'react';
import { projectsApi } from '@/lib/apiClient';

interface MaterialProgress {
  materialName: string;
  unit: string;
  quotedQty: number;
  deliveredQty: number;
  remainingQty: number;
  percentage: number;
}

interface ProjectProgress {
  totalQuoted: number;
  totalDelivered: number;
  percentage: number;
  hasQuotation: boolean;
  materialProgress: MaterialProgress[];
}

export function useProjectProgress(projectId: string, refreshKey: number = 0): ProjectProgress {
  const [progress, setProgress] = useState<ProjectProgress>({
    totalQuoted: 0,
    totalDelivered: 0,
    percentage: 0,
    hasQuotation: false,
    materialProgress: [],
  });

  useEffect(() => {
    const fetchProgress = async () => {
      if (!projectId) return;
      try {
        const result = await projectsApi.getProgress(projectId);
        const data = result.data;

        if (!data || !data.hasQuotation) {
          setProgress({
            totalQuoted: 0,
            totalDelivered: 0,
            percentage: 0,
            hasQuotation: false,
            materialProgress: [],
          });
          return;
        }

        const materialProgress: MaterialProgress[] = data.materials.map((m) => ({
          materialName: m.materialName,
          unit: m.unit ?? '',
          quotedQty: Number(m.totalQuantity),
          deliveredQty: Number(m.receivedQuantity),
          remainingQty: Math.max(0, Number(m.totalQuantity) - Number(m.receivedQuantity)),
          percentage: m.progressPercent,
        }));

        const totalQuoted = materialProgress.reduce((sum, m) => sum + m.quotedQty, 0);
        const totalDelivered = materialProgress.reduce((sum, m) => sum + Math.min(m.deliveredQty, m.quotedQty), 0);

        setProgress({
          totalQuoted,
          totalDelivered,
          percentage: data.overallProgress,
          hasQuotation: true,
          materialProgress,
        });
      } catch (error) {
        console.error('Error fetching project progress:', error);
      }
    };

    fetchProgress();
  }, [projectId, refreshKey]);

  return progress;
}
