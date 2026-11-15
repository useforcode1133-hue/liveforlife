import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
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
import { ComplaintIcon } from "../../components/icons";
import { formatDateTime } from "../../lib/format";

interface ComplaintRow {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  priority: string;
  status: string;
  response: string | null;
  createdAt: string;
  images: string[];
  resident: { name: string; email: string; phone: string | null };
  pg: { name: string };
  roomNumber: string | null;
  updates: { id: string; message: string; statusTo: string | null; createdAt: string; author: { name: string } }[];
}

const STATUSES = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const CATEGORIES = ["ALL", "WIFI", "WATER", "ELECTRICITY", "ROOM", "BATHROOM", "CLEANING", "FOOD", "SECURITY", "OTHER"];

export default function OwnerComplaints() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ComplaintRow | null>(null);
  const [response, setResponse] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [priority, setPriority] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["owner-complaints", status, category, search],
    queryFn: () =>
      api.get<{ complaints: ComplaintRow[]; counts: { total: number; open: number; resolved: number; closed: number } }>(
        `/owner/complaints?status=${status}&category=${category}${search ? `&search=${encodeURIComponent(search)}` : ""}`
      ),
  });

  const update = useMutation({
    mutationFn: () =>
      api.patch(`/owner/complaints/${selected?.id}`, {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(priority ? { priority } : {}),
        ...(response.trim() ? { response: response.trim() } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["owner-complaints"] });
      await queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
      toast.push("Complaint updated and the resident notified.");
      setSelected(null);
      setResponse("");
      setNextStatus("");
      setPriority("");
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not update this complaint.", "error"),
  });

  const rows = data?.complaints ?? [];

  return (
    <div>
      <PageHeader title="Complaints" subtitle="Every issue your residents raised, in one queue." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Total" value={data?.counts.total ?? 0} icon={<ComplaintIcon size={20} />} tone="purple" />
        <StatTile label="Open" value={data?.counts.open ?? 0} hint="Needs attention" icon={<ComplaintIcon size={20} />} tone="coral" />
        <StatTile label="Resolved" value={data?.counts.resolved ?? 0} icon={<ComplaintIcon size={20} />} tone="green" />
        <StatTile label="Closed" value={data?.counts.closed ?? 0} icon={<ComplaintIcon size={20} />} tone="gray" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <SearchField value={search} onChange={setSearch} placeholder="Search complaints" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
          <option value="ALL">All statuses</option>
          {STATUSES.map((option) => <option key={option} value={option}>{option.replace("_", " ").toLowerCase()}</option>)}
        </Select>
        <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
          {CATEGORIES.map((option) => <option key={option} value={option}>{option === "ALL" ? "All categories" : option}</option>)}
        </Select>
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-24 w-full" />)
        ) : error ? (
          <ErrorNote message="Could not load complaints." onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ComplaintIcon size={32} />} title="Nothing in this queue" description="When residents report an issue it appears here instantly." />
        ) : (
          rows.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{row.title}</p>
                    <StatusBadge status={row.status} />
                    <Badge tone={row.urgency === "HIGH" ? "red" : row.urgency === "MEDIUM" ? "amber" : "gray"}>{row.urgency.toLowerCase()}</Badge>
                    {row.priority !== "NORMAL" ? <Badge tone="purple">{row.priority.toLowerCase()} priority</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {row.pg.name} · Room {row.roomNumber ?? "—"} · {row.resident.name} · {formatDateTime(row.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelected(row);
                    setNextStatus(row.status);
                    setPriority(row.priority);
                    setResponse("");
                  }}
                >
                  Respond
                </Button>
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] text-ink-soft">{row.description}</p>
              {row.response ? <p className="mt-2 rounded-lg bg-primary/5 px-3 py-2 text-[12px] text-ink-soft">Your reply: {row.response}</p> : null}
            </Card>
          ))
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ""}
        description={selected ? `${selected.resident.name} · ${selected.pg.name} · Room ${selected.roomNumber ?? "—"}` : ""}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
            <Button loading={update.isPending} onClick={() => update.mutate()}>Save updates</Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-canvas p-3.5">
              <p className="text-[13px] leading-relaxed text-ink-soft">{selected.description}</p>
              <p className="mt-2 text-[11px] text-ink-muted">
                Reported {formatDateTime(selected.createdAt)} · {selected.category} · {selected.resident.email}
                {selected.resident.phone ? ` · ${selected.resident.phone}` : ""}
              </p>
            </div>

            {selected.images.length ? (
              <div className="grid grid-cols-3 gap-2">
                {selected.images.map((image) => (
                  <img key={image} src={image} alt="" className="h-20 w-full rounded-lg object-cover" />
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
                  {STATUSES.map((option) => <option key={option} value={option}>{option.replace("_", " ").toLowerCase()}</option>)}
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </Field>
            </div>

            <Field label="Reply to the resident" hint="They receive this as a notification.">
              <Textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Let them know what you are doing about it." />
            </Field>

            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Timeline</p>
              <ul className="space-y-2">
                {selected.updates.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-ink/5 px-3 py-2">
                    <p className="text-[12px] text-ink-soft">{entry.message}</p>
                    <p className="mt-0.5 text-[10px] text-ink-muted">
                      {entry.author.name} · {formatDateTime(entry.createdAt)}
                      {entry.statusTo ? ` · ${entry.statusTo.replace("_", " ").toLowerCase()}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
