import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Card, EmptyState, ErrorNote, PageHeader, SearchField, Skeleton, statusLabel } from "../../components/ui";
import { PaymentsIcon } from "../../components/icons";
import { formatDateTime } from "../../lib/format";

interface LogRow {
  id: string;
  action: string;
  entityType: string;
  description: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
}

export default function AdminAudit() {
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-audit", search],
    queryFn: () => api.get<{ logs: LogRow[] }>(`/admin/audit-logs${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  return (
    <div>
      <PageHeader
        title="Activity logs"
        subtitle="An audit trail of approvals, payments, residency changes and complaints."
        actions={<SearchField value={search} onChange={setSearch} placeholder="Search the log" className="w-full sm:w-64" />}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-16 w-full" />)}
        </div>
      ) : error ? (
        <ErrorNote message="Could not load activity logs." onRetry={() => void refetch()} />
      ) : !data?.logs.length ? (
        <EmptyState icon={<PaymentsIcon size={32} />} title="No activity yet" description="Actions will appear here as owners and residents use the platform." />
      ) : (
        <Card className="divide-y divide-ink/5 p-0">
          {data.logs.map((log) => (
            <div key={log.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                  {log.actorName.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-snug text-ink">{log.description}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {log.actorName} · {statusLabel(log.actorRole)} · {formatDateTime(log.createdAt)}
                  </p>
                </div>
              </div>
              <Badge tone="gray" className="w-fit shrink-0">{log.action.replace(/_/g, " ").toLowerCase()}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
