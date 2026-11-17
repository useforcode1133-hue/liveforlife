import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
  SearchField,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "../../components/ui";
import { ResidentsIcon } from "../../components/icons";
import { formatDate, inr } from "../../lib/format";

interface ResidentRow {
  id: string;
  status: string;
  monthlyRent: number;
  joinedAt: string | null;
  vacatedAt: string | null;
  resident: { id: string; name: string; email: string; phone: string | null; status: string; createdAt: string };
  pgName: string;
  ownerName: string;
  roomNumber: string;
  floorName: string;
  bedLabel: string | null;
}

export default function AdminResidents() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-residents", status],
    queryFn: () => api.get<{ residents: ResidentRow[] }>(`/admin/residents?status=${status}`),
  });

  const queryClient = useQueryClient();
  const toast = useToast();

  const setAccountStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "ACTIVE" | "SUSPENDED" }) =>
      api.patch<{ message: string }>(`/admin/users/${id}/status`, { status: next }),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-residents"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-owners"] }),
      ]);
      toast.push(variables.next === "SUSPENDED" ? "Account suspended." : "Account reactivated.");
    },
    onError: (mutationError) =>
      toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not update this account.", "error"),
  });

  const rows = (data?.residents ?? []).filter((row) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return row.resident.name.toLowerCase().includes(term) || row.resident.email.toLowerCase().includes(term);
  });

  return (
    <div>
      <PageHeader title="Residents" subtitle="Every residency across all PG owners, with its current status." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchField value={search} onChange={setSearch} placeholder="Search residents" className="sm:max-w-sm" />
        <div className="sm:ml-auto sm:w-48">
          <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by residency status">
            <option value="ACTIVE">Active</option>
            <option value="NOTICE">Notice period</option>
            <option value="VACATED">Vacated</option>
            <option value="INVITED">Invited</option>
            <option value="">All statuses</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-20 w-full" />)}
        </div>
      ) : error ? (
        <ErrorNote message="Could not load residents." onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ResidentsIcon size={32} />} title="No residents found" description="Try a different status or search term." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-ink/5 bg-surface shadow-soft lg:block">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-canvas text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">Resident</th>
                  <th className="px-4 py-3 font-bold">PG</th>
                  <th className="px-4 py-3 font-bold">Room</th>
                  <th className="px-4 py-3 font-bold">Rent</th>
                  <th className="px-4 py-3 font-bold">Joined</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 text-right font-bold">Account</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-ink/5">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.resident.name}</p>
                      <p className="text-[11px] text-ink-muted">{row.resident.email}</p>
                      {row.resident.status === "SUSPENDED" ? <Badge tone="red" className="mt-1">Suspended</Badge> : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.pgName}</p>
                      <p className="text-[11px] text-ink-muted">{row.ownerName}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {row.roomNumber}
                      <span className="text-ink-muted"> · {row.floorName}{row.bedLabel ? ` · Bed ${row.bedLabel}` : ""}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{inr(row.monthlyRent)}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(row.joinedAt ?? row.resident.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={row.resident.status === "SUSPENDED" ? "secondary" : "danger"}
                        loading={setAccountStatus.isPending && setAccountStatus.variables?.id === row.resident.id}
                        onClick={() =>
                          setAccountStatus.mutate({
                            id: row.resident.id,
                            next: row.resident.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                          })
                        }
                      >
                        {row.resident.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 lg:hidden">
            {rows.map((row) => (
              <Card key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{row.resident.name}</p>
                    <p className="text-[11px] text-ink-muted">{row.pgName} · Room {row.roomNumber}</p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink-muted">
                  <Badge tone="gray">{inr(row.monthlyRent)}/mo</Badge>
                  <Badge tone="gray">{row.floorName}</Badge>
                  {row.bedLabel ? <Badge tone="gray">Bed {row.bedLabel}</Badge> : null}
                </div>
                <p className="mt-2 text-[11px] text-ink-muted">Joined {formatDate(row.joinedAt ?? row.resident.createdAt)}</p>
                <Button
                  size="sm"
                  variant={row.resident.status === "SUSPENDED" ? "secondary" : "danger"}
                  className="mt-3"
                  loading={setAccountStatus.isPending && setAccountStatus.variables?.id === row.resident.id}
                  onClick={() =>
                    setAccountStatus.mutate({
                      id: row.resident.id,
                      next: row.resident.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                    })
                  }
                >
                  {row.resident.status === "SUSPENDED" ? "Reactivate account" : "Suspend account"}
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
