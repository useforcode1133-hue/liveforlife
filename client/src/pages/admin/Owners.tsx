import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Modal,
  PageHeader,
  SearchField,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  useToast,
} from "../../components/ui";
import { BuildingIcon, ResidentsIcon } from "../../components/icons";
import { formatDate } from "../../lib/format";

interface OwnerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  pgCount: number;
  residentCount: number;
  bedCount: number;
  propertyNames: string[];
}

export default function AdminOwners() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OwnerRow | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-owners", status],
    queryFn: () => api.get<{ owners: OwnerRow[] }>(`/admin/owners?status=${status}`),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: string }) =>
      api.patch(`/admin/owners/${id}/status`, { status: nextStatus }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-owners"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.push("Owner account updated.");
      setSelected(null);
    },
    onError: () => toast.push("Could not update this owner.", "error"),
  });

  const rows = (data?.owners ?? []).filter((owner) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return owner.name.toLowerCase().includes(term) || owner.email.toLowerCase().includes(term);
  });

  return (
    <div>
      <PageHeader
        title="PG owners"
        subtitle="Approve new owners, review their portfolio and pause accounts when needed."
        actions={<Badge tone="purple">{data?.owners.length ?? 0} accounts</Badge>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField value={search} onChange={setSearch} placeholder="Search by name or email" className="sm:max-w-xs" />
        <div className="sm:ml-auto sm:w-48">
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setParams(event.target.value === "ALL" ? {} : { status: event.target.value });
            }}
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Approved</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
      </div>

      <Tabs
        tabs={[
          { value: "ALL", label: "All" },
          { value: "PENDING", label: "Pending" },
          { value: "ACTIVE", label: "Approved" },
          { value: "SUSPENDED", label: "Suspended" },
        ]}
        value={status}
        onChange={(next) => {
          setStatus(next);
          setParams(next === "ALL" ? {} : { status: next });
        }}
      />

      <div className="mt-4 space-y-3">
        {isLoading ? (
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-24 w-full" />)
        ) : error ? (
          <ErrorNote message="Could not load owners." onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ResidentsIcon size={32} />} title="No owners here" description="Try a different search or status filter." />
        ) : (
          rows.map((owner) => (
            <Card key={owner.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold">{owner.name}</p>
                  <StatusBadge status={owner.status} />
                </div>
                <p className="mt-0.5 truncate text-[13px] text-ink-muted">{owner.email}{owner.phone ? ` · ${owner.phone}` : ""}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1"><BuildingIcon size={14} /> {owner.pgCount} PGs</span>
                  <span className="flex items-center gap-1"><ResidentsIcon size={14} /> {owner.residentCount} residents</span>
                  <span>{owner.bedCount} beds</span>
                  <span>Joined {formatDate(owner.createdAt)}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSelected(owner)}>
                  Review
                </Button>
                {owner.status === "PENDING" ? (
                  <Button size="sm" loading={changeStatus.isPending} onClick={() => changeStatus.mutate({ id: owner.id, nextStatus: "ACTIVE" })}>
                    Approve
                  </Button>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        description="Review this owner and change their access."
        footer={
          selected ? (
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
              {selected.status === "ACTIVE" ? (
                <Button variant="danger" loading={changeStatus.isPending} onClick={() => changeStatus.mutate({ id: selected.id, nextStatus: "SUSPENDED" })}>
                  Suspend account
                </Button>
              ) : (
                <Button variant="success" loading={changeStatus.isPending} onClick={() => changeStatus.mutate({ id: selected.id, nextStatus: "ACTIVE" })}>
                  Approve account
                </Button>
              )}
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Properties", value: selected.pgCount },
                { label: "Residents", value: selected.residentCount },
                { label: "Beds", value: selected.bedCount },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-canvas p-3">
                  <p className="text-lg font-extrabold">{item.value}</p>
                  <p className="text-[11px] text-ink-muted">{item.label}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Properties</p>
              {selected.propertyNames.length ? (
                <ul className="space-y-1 text-[13px] text-ink-soft">
                  {selected.propertyNames.map((name) => (
                    <li key={name} className="rounded-lg bg-canvas px-3 py-2">{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-muted">No properties created yet.</p>
              )}
            </div>
            <p className="text-xs text-ink-muted">Email {selected.email}{selected.phone ? ` · Phone ${selected.phone}` : ""}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
