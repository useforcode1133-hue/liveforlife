import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { api } from "../../lib/api";
import { Badge, Card, EmptyState, ErrorNote, PageHeader, Skeleton, StatTile, StatusBadge } from "../../components/ui";
import { PaymentsIcon, RentIcon } from "../../components/icons";
import { formatDate, inr } from "../../lib/format";

interface RentRecord {
  id: string;
  periodMonth: string;
  periodLabel: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  paidAt: string | null;
  status: string;
  pgName: string;
  roomNumber: string;
  isCurrent: boolean;
  payments: { id: string; amount: number; method: string; paidAt: string; reference: string | null; note: string | null }[];
}

export default function ResidentRent() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["resident-rent"],
    queryFn: () => api.get<{ records: RentRecord[]; canSubmitProof: boolean }>("/resident/rent"),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <ErrorNote message="Could not load your rent details." onRetry={() => void refetch()} />;

  const totalPaid = data.records.reduce((sum, record) => sum + record.amountPaid, 0);
  const totalDue = data.records.reduce((sum, record) => sum + record.balance, 0);

  return (
    <div>
      <PageHeader title="Rent & payments" subtitle="Your month-by-month rent history and receipts." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Total paid" value={inr(totalPaid)} hint="Across all months" icon={<PaymentsIcon size={20} />} tone="green" />
        <StatTile label="Outstanding" value={inr(totalDue)} hint="Pending balance" icon={<RentIcon size={20} />} tone="coral" />
        <StatTile label="Months tracked" value={data.records.length} icon={<RentIcon size={20} />} tone="purple" />
        <StatTile label="Receipts" value={data.records.reduce((sum, record) => sum + record.payments.length, 0)} icon={<PaymentsIcon size={20} />} tone="blue" />
      </div>

      <div className="mt-4 space-y-2">
        {data.records.length === 0 ? (
          <EmptyState icon={<RentIcon size={32} />} title="No rent records yet" description="Your owner will generate rent for the month once you check in." />
        ) : (
          data.records.map((record) => (
            <Card key={record.id} className={record.isCurrent ? "border-primary/20" : undefined}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{record.periodLabel}</p>
                    <StatusBadge status={record.status} />
                    {record.isCurrent ? <Badge tone="purple">Current</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    {record.pgName} · Room {record.roomNumber} · due {formatDate(record.dueDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold">{inr(record.amountPaid)} <span className="text-[11px] font-medium text-ink-muted">of {inr(record.amountDue)}</span></p>
                  {record.balance > 0 ? <p className="text-[11px] font-semibold text-[#5B5CE6]">{inr(record.balance)} pending</p> : <p className="text-[11px] text-success">Fully paid</p>}
                </div>
              </div>

              {record.payments.length ? (
                <div className="mt-3 rounded-xl bg-canvas p-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Receipts</p>
                  <ul className="space-y-1 text-[12px] text-ink-soft">
                    {record.payments.map((payment) => (
                      <li key={payment.id} className="flex items-center justify-between">
                        <span>{formatDate(payment.paidAt)} · {payment.method.replace("_", " ").toLowerCase()}{payment.reference ? ` · ${payment.reference}` : ""}</span>
                        <span className="font-semibold">{inr(payment.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-canvas px-4 py-3 text-[12px] leading-relaxed text-ink-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Only your PG owner can confirm rent payments. Pay by UPI or cash and your owner records it here — you will
          receive a notification as soon as it is confirmed.
        </p>
      </div>
    </div>
  );
}
