import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Loader2 } from 'lucide-react';
import { projectsApi } from '@/lib/apiClient';
import { format } from 'date-fns';

interface ActivityLogEntry {
  id: string;
  tableName: string;
  action: string;
  createdAt: string;
  userName?: string;
  newValues?: string;
}

interface ProjectActivityTabProps {
  projectId: string;
}

function formatAction(log: ActivityLogEntry): string {
  const table = log.tableName?.replace(/s$/, '') || 'record';
  const action = log.action?.toLowerCase() || 'updated';

  if (action === 'insert' || action === 'create') return `Created a ${table}`;
  if (action === 'update') return `Updated a ${table}`;
  if (action === 'delete') return `Deleted a ${table}`;
  return `${action} ${table}`;
}

export function ProjectActivityTab({ projectId }: ProjectActivityTabProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        const result = await projectsApi.getActivity(projectId);
        setLogs(result.data || []);
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [projectId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Activity className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">No activity recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 border-b pb-3 last:border-0"
              >
                <Activity className="h-4 w-4 mt-1 text-muted-foreground/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{formatAction(log)}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.userName || 'System'} &middot;{' '}
                    {format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
