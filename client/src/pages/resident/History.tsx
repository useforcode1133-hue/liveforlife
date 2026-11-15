import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Card, EmptyState, ErrorNote, PageHeader, Skeleton, StatusBadge } from "../../components/ui";
import { BuildingIcon } from "../../components/icons";
import { formatDate, inr } from "../../lib/format";

interface Stay {
  id: string;
  status: string;
  pgName: string;
  city: string;
  roomNumber: string;
  floorName: string;
  bedLabel: string | null;
  monthlyRent: number;
  joinedAt: string | null;
  vacatedAt: string | null;
  exitReason: string | null;
  totalBilled: number;
  totalPaid: number;
}

export default function ResidentHistory() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["resident-history"],
    queryFn: () => api.get<{ stays: Stay[] }>("/resident/history"),
  });

  return (
    <div>
      <PageHeader title="Residency history" subtitle="Every PG you have stayed in, with rent totals." />

      <div className="space-y-2">
        {isLoading ? (
          [0, 1].map((index) => <Skeleton key={index} className="h-28 w-full" />)
        ) : error ? (
          <ErrorNote message="Could not load your history." onRetry={() => void refetch()} />
        ) : !data?.stays.length ? (
          <EmptyState icon={<BuildingIcon size={32} />} title="No stays yet" description="Once you join a PG your history appears here." />
        ) : (
          data.stays.map((stay) => (
            <Card key={stay.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{stay.pgName}</p>
                    <StatusBadge status={stay.status} />
                    {stay.status === "VACATED" ? <Badge tone="gray">Archived</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    {stay.city} · Room {stay.roomNumber} · {stay.floorName}{stay.bedLabel ? ` · Bed ${stay.bedLabel}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold">{inr(stay.monthlyRent)}<span className="text-[11px] font-normal text-ink-muted">/month</span></p>
                  <p className="text-[11px] text-ink-muted">{formatDate(stay.joinedAt)} → {stay.vacatedAt ? formatDate(stay.vacatedAt) : "present"}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-xl bg-canvas px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-ink-muted">Total billed</p>
                  <p className="font-semibold">{inr(stay.totalBilled)}</p>
                </div>
                <div className="rounded-xl bg-canvas px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-ink-muted">Total paid</p>
                  <p className="font-semibold">{inr(stay.totalPaid)}</p>
                </div>
              </div>
              {stay.exitReason ? <p className="mt-2 text-[11px] text-ink-muted">Reason: {stay.exitReason}</p> : null}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
