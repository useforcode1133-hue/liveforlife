import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, RefreshCw, Wallet } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchField,
  Select,
  Skeleton,
  StatTile,
  StatusBadge,
  Textarea,
  useToast,
} from "../../components/ui";
import { RentIcon } from "../../components/icons";
import { formatDate, inr, monthKey, monthLabel } from "../../lib/format";

interface RentRow {
  id: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  status: string;
  resident: { id: string; name: string; email: string; phone: string | null };
  roomNumber: string;
  floorName: string;
  pgName: string;
  pgId: string;
  payments: { id: string; amount: number; method: string; paidAt: string; reference: string | null }[];
}

interface RentData {
  rows: RentRow[];
  summary: { month: string; monthLabel: string; totalDue: number; totalCollected: number; totalOutstanding: number; paidCount: number; unpaidCount: number };
  pgs: { id: string; name: string }[];
}

export default function OwnerRent() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [month, setMonth] = useState(monthKey());
  const [status, setStatus] = useState("ALL");
  const [pgId, setPgId] = useState("");
  const [search, setSearch] = useState("");
  const [paying, setPaying] = useState<RentRow | null>(null);
  const [payment, setPayment] = useState({ amount: "", method: "UPI", reference: "", note: "" });
  const [detail, setDetail] = useState<RentRow | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["owner-rent", month, status, pgId, search],
    queryFn: () =>
      api.get<RentData>(`/owner/rent?month=${month}&status=${status}${pgId ? `&pgId=${pgId}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["owner-rent"] });
    await queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
  };

  const generate = useMutation({
    mutationFn: () => api.post<{ created: number }>("/owner/rent/generate", { month, pgId: pgId || undefined }),
    onSuccess: async (result) => {
      await refresh();
      toast.push(result.created ? `${result.created} rent records created for ${monthLabel(month)}.` : "All active residents already have a record for this month.");
    },
    onError: () => toast.push("Could not generate rent records.", "error"),
  });

  const recordPayment = useMutation({
    mutationFn: () =>
      api.post(`/owner/rent/${paying?.id}/pay`, {
        amount: Number(payment.amount),
        method: payment.method,
        reference: payment.reference || undefined,
        note: payment.note || undefined,
      }),
    onSuccess: async () => {
      await refresh();
      toast.push("Payment recorded and the resident notified.");
      setPaying(null);
      setPayment({ amount: "", method: "UPI", reference: "", note: "" });
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not record the payment.", "error"),
  });

  const remind = useMutation({
    mutationFn: (id: string) => api.post(`/owner/rent/${id}/remind`),
    onSuccess: () => toast.push("Reminder sent."),
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not send reminder.", "error"),
  });

  const remindAll = useMutation({
    mutationFn: () => api.post<{ message: string }>("/owner/rent/remind-all", { month }),
    onSuccess: (result) => toast.push(result.message),
    onError: () => toast.push("Could not send reminders.", "error"),
  });

  return (
    <div>
      <PageHeader
        title="Rent management"
        subtitle="Track every month, record part payments and nudge residents who are behind."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => remindAll.mutate()} loading={remindAll.isPending} icon={<BellRing className="h-4 w-4" />}>
              Remind unpaid
            </Button>
            <Button size="sm" onClick={() => generate.mutate()} loading={generate.isPending} icon={<RefreshCw className="h-4 w-4" />}>
              Generate {monthLabel(month)}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Billed" value={inr(data?.summary.totalDue ?? 0)} hint={monthLabel(month)} icon={<RentIcon size={20} />} tone="purple" />
        <StatTile label="Collected" value={inr(data?.summary.totalCollected ?? 0)} hint={`${data?.summary.paidCount ?? 0} residents settled`} icon={<RentIcon size={20} />} tone="green" />
        <StatTile label="Outstanding" value={inr(data?.summary.totalOutstanding ?? 0)} hint={`${data?.summary.unpaidCount ?? 0} residents pending`} icon={<RentIcon size={20} />} tone="coral" />
        <StatTile label="Records" value={data?.rows.length ?? 0} hint="For this month" icon={<Wallet size={20} />} tone="blue" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[190px_170px_1fr] lg:grid-cols-[190px_170px_210px_1fr]">
        <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Rent month" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Payment status">
          <option value="ALL">All statuses</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partially paid</option>
          <option value="UNPAID">Unpaid</option>
          <option value="OVERDUE">Overdue</option>
        </Select>
        <Select value={pgId} onChange={(event) => setPgId(event.target.value)} aria-label="Filter by PG" className="lg:col-span-1">
          <option value="">All PGs</option>
          {(data?.pgs ?? []).map((pg) => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
        </Select>
        <SearchField value={search} onChange={setSearch} placeholder="Search resident" />
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-20 w-full" />)
        ) : error ? (
          <ErrorNote message="Could not load rent records." onRetry={() => void refetch()} />
        ) : !data?.rows.length ? (
          <EmptyState
            icon={<RentIcon size={32} />}
            title="No rent records for this month"
            description="Generate records to bill every active resident at their agreed rent."
            action={<Button onClick={() => generate.mutate()} loading={generate.isPending}>Generate records</Button>}
          />
        ) : (
          data.rows.map((row) => (
            <Card key={row.id} className="flex flex-col gap-2 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{row.resident.name}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    {row.pgName} · Room {row.roomNumber} · due {formatDate(row.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-extrabold">{inr(row.amountDue)}</p>
                    <p className="text-[11px] text-ink-muted">{inr(row.amountPaid)} received</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setDetail(row)}>History</Button>
                    {row.balance > 0 ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setPaying(row);
                            setPayment({ amount: String(row.balance), method: "UPI", reference: "", note: "" });
                          }}
                        >
                          Record
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remind.mutate(row.id)} aria-label={`Remind ${row.resident.name}`}>
                          <BellRing className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Badge tone="green">Settled</Badge>
                    )}
                  </div>
                </div>
              </div>
              {row.balance > 0 ? (
                <p className="text-[11px] font-medium text-[#5B5CE6]">{inr(row.balance)} still due</p>
              ) : null}
            </Card>
          ))
        )}
      </div>

      <Modal
        open={!!paying}
        onClose={() => setPaying(null)}
        title={paying ? `Record payment · ${paying.resident.name}` : ""}
        description={paying ? `${monthLabel(paying.month)} · balance ${inr(paying.balance)}` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaying(null)}>Cancel</Button>
            <Button loading={recordPayment.isPending} onClick={() => recordPayment.mutate()} disabled={!payment.amount || Number(payment.amount) <= 0}>
              Record payment
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount received">
            <Input type="number" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} max={paying?.balance} />
          </Field>
          <Field label="Method">
            <Select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Reference" hint="Optional transaction ID">
            <Input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} />
          </Field>
          <Field label="Note" hint="Optional">
            <Input value={payment.note} onChange={(event) => setPayment({ ...payment, note: event.target.value })} />
          </Field>
          <p className="text-xs text-ink-muted sm:col-span-2">
            Partial amounts are supported. The resident is notified automatically and only owners can confirm payments.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.resident.name} · ${monthLabel(detail.month)}` : ""}
        description={detail ? `${detail.pgName} · Room ${detail.roomNumber}` : ""}
        footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}
      >
        {detail ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Due", value: inr(detail.amountDue) },
                { label: "Paid", value: inr(detail.amountPaid) },
                { label: "Balance", value: inr(detail.balance) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-canvas p-3">
                  <p className="text-[10px] uppercase tracking-wide text-ink-muted">{item.label}</p>
                  <p className="text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Payments</p>
              {detail.payments.length ? (
                <ul className="divide-y divide-ink/5 rounded-xl border border-ink/5">
                  {detail.payments.map((paymentRow) => (
                    <li key={paymentRow.id} className="flex items-center justify-between px-3 py-2 text-[13px]">
                      <span>{formatDate(paymentRow.paidAt)}</span>
                      <span className="text-ink-muted">{paymentRow.method.replace("_", " ").toLowerCase()}{paymentRow.reference ? ` · ${paymentRow.reference}` : ""}</span>
                      <span className="font-semibold">{inr(paymentRow.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-muted">No payments recorded for this month yet.</p>
              )}
            </div>
            <Field label="Note for this month" hint="Saved on the rent record">
              <Textarea defaultValue={""} placeholder="Optional note" onBlur={(event) => {
                if (event.target.value.trim()) {
                  void api.patch(`/owner/rent/${detail.id}`, { notes: event.target.value.trim() }).then(() => {
                    toast.push("Note saved.");
                    void refetch();
                  });
                }
              }} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
