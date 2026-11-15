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
  Progress,
  SearchField,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "../../components/ui";
import { BuildingIcon } from "../../components/icons";
import { formatDate, inr } from "../../lib/format";

interface PropertyRow {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
  status: string;
  images: string[];
  rentMin: number;
  rentMax: number;
  createdAt: string;
  owner: { id: string; name: string; email: string; status: string };
  floorCount: number;
  roomCount: number;
  totalBeds: number;
  occupiedBeds: number;
  residentCount: number;
}

const typeLabel: Record<string, string> = { BOYS: "Boys PG", GIRLS: "Girls PG", CO_LIVING: "Co-living" };

export default function AdminProperties() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PropertyRow | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-properties", status],
    queryFn: () => api.get<{ properties: PropertyRow[] }>(`/admin/properties?status=${status}`),
  });

  const setPropertyStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => api.patch(`/admin/properties/${id}/status`, { status: next }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.push("Property status updated.");
      setSelected(null);
    },
    onError: () => toast.push("Could not update this property.", "error"),
  });

  const rows = (data?.properties ?? []).filter((property) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      property.name.toLowerCase().includes(term) ||
      property.city.toLowerCase().includes(term) ||
      property.owner.name.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <PageHeader title="PG properties" subtitle="Verify properties before they appear to residents, or suspend them." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchField value={search} onChange={setSearch} placeholder="Search PG, city or owner" className="sm:max-w-sm" />
        <div className="sm:ml-auto sm:w-48">
          <Select
            value={status}
            aria-label="Filter by status"
            onChange={(event) => {
              setStatus(event.target.value);
              setParams(event.target.value === "ALL" ? {} : { status: event.target.value });
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {isLoading ? (
          [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-40 w-full" />)
        ) : error ? (
          <ErrorNote message="Could not load properties." onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState icon={<BuildingIcon size={32} />} title="No properties match" description="Adjust the filters or wait for owners to add PGs." />
          </div>
        ) : (
          rows.map((property) => {
            const rate = property.totalBeds ? Math.round((property.occupiedBeds / property.totalBeds) * 100) : 0;
            return (
              <Card key={property.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold">{property.name}</p>
                      <StatusBadge status={property.status} />
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-muted">
                      {property.city}, {property.state} · {typeLabel[property.type] ?? property.type}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      Owner {property.owner.name} · {inr(property.rentMin)}–{inr(property.rentMax)}/month
                    </p>
                  </div>
                  <Badge tone="purple">{rate}% full</Badge>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Floors", value: property.floorCount },
                    { label: "Rooms", value: property.roomCount },
                    { label: "Beds", value: property.totalBeds },
                    { label: "Residents", value: property.residentCount },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-canvas py-2">
                      <p className="text-sm font-bold">{item.value}</p>
                      <p className="text-[10px] text-ink-muted">{item.label}</p>
                    </div>
                  ))}
                </div>

                <Progress value={rate} tone={rate > 80 ? "coral" : "green"} />
                <div className="flex items-center justify-between text-[11px] text-ink-muted">
                  <span>{property.occupiedBeds} of {property.totalBeds} beds occupied</span>
                  <span>Added {formatDate(property.createdAt)}</span>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" full onClick={() => setSelected(property)}>
                    Review
                  </Button>
                  {property.status !== "VERIFIED" ? (
                    <Button size="sm" full onClick={() => setPropertyStatus.mutate({ id: property.id, next: "VERIFIED" })}>
                      Verify
                    </Button>
                  ) : (
                    <Button size="sm" variant="danger" full onClick={() => setPropertyStatus.mutate({ id: property.id, next: "SUSPENDED" })}>
                      Suspend
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        description="Property details submitted by the owner."
        footer={
          selected ? (
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
              {selected.status === "SUSPENDED" ? (
                <Button variant="success" onClick={() => setPropertyStatus.mutate({ id: selected.id, next: "VERIFIED" })}>
                  Restore property
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setPropertyStatus.mutate({ id: selected.id, next: "SUSPENDED" })}>
                  Suspend property
                </Button>
              )}
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-canvas p-4">
              <p className="text-[13px] text-ink-soft">
                {selected.name} is a {typeLabel[selected.type] ?? selected.type} in {selected.city}, {selected.state}. Owned by{" "}
                {selected.owner.name} ({selected.owner.email}).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-ink/5 p-3">
                <p className="text-[11px] text-ink-muted">Occupancy</p>
                <p className="text-sm font-bold">{selected.occupiedBeds} / {selected.totalBeds} beds</p>
              </div>
              <div className="rounded-xl border border-ink/5 p-3">
                <p className="text-[11px] text-ink-muted">Rent range</p>
                <p className="text-sm font-bold">{inr(selected.rentMin)} – {inr(selected.rentMax)}</p>
              </div>
              <div className="rounded-xl border border-ink/5 p-3">
                <p className="text-[11px] text-ink-muted">Owner account</p>
                <p className="text-sm font-bold capitalize">{selected.owner.status.toLowerCase()}</p>
              </div>
              <div className="rounded-xl border border-ink/5 p-3">
                <p className="text-[11px] text-ink-muted">Added on</p>
                <p className="text-sm font-bold">{formatDate(selected.createdAt)}</p>
              </div>
            </div>
            {selected.images.length ? (
              <div className="grid grid-cols-3 gap-2">
                {selected.images.slice(0, 3).map((image) => (
                  <img key={image} src={image} alt="" className="h-20 w-full rounded-lg object-cover" />
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-muted">No photos uploaded by the owner yet.</p>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
