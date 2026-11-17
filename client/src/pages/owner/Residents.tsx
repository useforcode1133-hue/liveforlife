import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Plus, Send, UserPlus, X } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Field,
  InfoRow,
  Input,
  Modal,
  PageHeader,
  SearchField,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  useToast,
} from "../../components/ui";
import { ResidentsIcon } from "../../components/icons";
import { formatDate, inr } from "../../lib/format";

interface ResidentRow {
  id: string;
  status: string;
  monthlyRent: number;
  securityDeposit: number;
  joinedAt: string | null;
  vacatedAt: string | null;
  resident: { id: string; name: string; email: string; phone: string | null };
  roomNumber: string;
  floorName: string;
  bedLabel: string | null;
  pgId: string;
  rentStatus: string;
  rentDue: number;
  rentPaid: number;
}

interface BedOption {
  id: string;
  label: string;
  roomNumber: string;
  floorName: string;
  rentPerBed: number;
  reserved: boolean;
}

interface InvitationRow {
  id: string;
  code: string;
  status: string;
  email: string | null;
  phone: string | null;
  pgName: string;
  roomNumber: string | null;
  bedLabel: string | null;
  monthlyRent: number;
  expiresAt: string;
  inviteLink: string;
}

interface PgOption {
  id: string;
  name: string;
}

export default function OwnerResidents() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"residents" | "invitations">("residents");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [pgFilter, setPgFilter] = useState(params.get("pgId") ?? "");
  const [addOpen, setAddOpen] = useState(params.get("new") === "1");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<ResidentRow | null>(null);
  const [addForm, setAddForm] = useState({ pgId: "", bedId: "", name: "", email: "", phone: "", monthlyRent: "", deposit: "0" });
  const [inviteForm, setInviteForm] = useState({ pgId: "", bedId: "", email: "", phone: "", monthlyRent: "" });
  const [transferBed, setTransferBed] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<InvitationRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (params.get("new") === "1") setAddOpen(true);
  }, [params]);

  const pgsQuery = useQuery({ queryKey: ["owner-pgs"], queryFn: () => api.get<{ pgs: PgOption[] }>("/owner/pgs") });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["owner-residents", status, pgFilter, search],
    queryFn: () =>
      api.get<{ residents: ResidentRow[] }>(
        `/owner/residents?status=${status}${pgFilter ? `&pgId=${pgFilter}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`
      ),
  });

  const invitationsQuery = useQuery({
    queryKey: ["owner-invitations"],
    queryFn: () => api.get<{ invitations: InvitationRow[] }>("/owner/invitations"),
    enabled: tab === "invitations" || inviteOpen,
  });

  const bedsQuery = useQuery({
    queryKey: ["available-beds", addForm.pgId || inviteForm.pgId],
    queryFn: () => api.get<{ beds: BedOption[] }>(`/owner/pgs/${addForm.pgId || inviteForm.pgId}/available-beds`),
    enabled: Boolean(addForm.pgId || inviteForm.pgId),
  });

  const detailQuery = useQuery({
    queryKey: ["owner-resident", selected?.id],
    queryFn: () =>
      api.get<{
        residency: ResidentRow;
        rent: { id: string; periodMonth: string; amountDue: number; amountPaid: number; status: string }[];
        previousStays: { id: string; pgName: string; roomNumber: string; status: string; joinedAt: string | null; vacatedAt: string | null }[];
      }>(`/owner/residents/${selected?.id}`),
    enabled: !!selected,
  });

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["owner-residents"] });
    await queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["owner-invitations"] });
    await queryClient.invalidateQueries({ queryKey: ["available-beds"] });
    await queryClient.invalidateQueries({ queryKey: ["owner-pg"] });
  };

  const addResident = useMutation({
    mutationFn: () =>
      api.post<{ residencyId: string; temporaryPassword?: string }>("/owner/residents", {
        pgId: addForm.pgId,
        bedId: addForm.bedId,
        name: addForm.name,
        email: addForm.email,
        phone: addForm.phone,
        monthlyRent: Number(addForm.monthlyRent),
        securityDeposit: Number(addForm.deposit || 0),
      }),
    onSuccess: async (result) => {
      await refreshAll();
      setAddOpen(false);
      setTempPassword(result.temporaryPassword ?? null);
      toast.push("Resident added and bed allocated.");
      setAddForm({ pgId: "", bedId: "", name: "", email: "", phone: "", monthlyRent: "", deposit: "0" });
    },
    onError: (mutationError) => setFormError(mutationError instanceof ApiError ? mutationError.message : "Could not add this resident."),
  });

  const createInvite = useMutation({
    mutationFn: () =>
      api.post<{ invitation: InvitationRow }>("/owner/invitations", {
        pgId: inviteForm.pgId,
        bedId: inviteForm.bedId,
        email: inviteForm.email || undefined,
        phone: inviteForm.phone || undefined,
        monthlyRent: inviteForm.monthlyRent ? Number(inviteForm.monthlyRent) : undefined,
      }),
    onSuccess: async () => {
      await refreshAll();
      setInviteOpen(false);
      setInviteForm({ pgId: "", bedId: "", email: "", phone: "", monthlyRent: "" });
      setTab("invitations");
      toast.push("Invitation created. Share the code with your resident.");
    },
    onError: (mutationError) => setFormError(mutationError instanceof ApiError ? mutationError.message : "Could not create the invitation."),
  });

  const cancelInvitation = useMutation({
    mutationFn: (id: string) => api.del<{ message: string }>(`/owner/invitations/${id}`),
    onSuccess: async () => {
      await refreshAll();
      setCancelTarget(null);
      toast.push("Invitation cancelled. The bed is free again.");
    },
    onError: (mutationError) =>
      toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not cancel the invitation.", "error"),
  });

  const exportResidents = async () => {
    setExporting(true);
    try {
      await api.download(`/owner/residents-export${pgFilter ? `?pgId=${pgFilter}` : ""}`, "residents.csv");
      toast.push("Residents exported as a CSV file.");
    } catch (exportError) {
      toast.push(exportError instanceof ApiError ? exportError.message : "Could not export residents.", "error");
    } finally {
      setExporting(false);
    }
  };

  const updateResidency = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown>; path?: string }) =>
      api.post(`/owner/residents/${payload.id}/${payload.path ?? ""}`, payload.data),
    onSuccess: async () => {
      await refreshAll();
      await queryClient.invalidateQueries({ queryKey: ["owner-resident"] });
      toast.push("Resident record updated.");
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not update.", "error"),
  });

  const beds = (bedsQuery.data?.beds ?? []).filter((bed) => !bed.reserved);
  const rows = data?.residents ?? [];
  const currentPgBeds = beds.filter((bed) => !inviteForm.pgId || bed.id);

  return (
    <div>
      <PageHeader
        title="Residents"
        subtitle="Allocate beds, invite new residents and manage moves."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void exportResidents()}
              loading={exporting}
              icon={<Download className="h-4 w-4" />}
            >
              Export
            </Button>
            <Button variant="secondary" onClick={() => setInviteOpen(true)} icon={<Send className="h-4 w-4" />}>
              Invite
            </Button>
            <Button onClick={() => setAddOpen(true)} icon={<Plus className="h-4 w-4" />}>
              Add resident
            </Button>
          </>
        }
      />

      <Tabs
        tabs={[
          { value: "residents", label: "Residents", count: rows.length },
          { value: "invitations", label: "Invitations", count: invitationsQuery.data?.invitations.filter((i) => i.status === "PENDING").length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "residents" ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_180px]">
            <SearchField value={search} onChange={setSearch} placeholder="Search by name, email or room" />
            <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Residency status">
              <option value="ACTIVE">Active</option>
              <option value="NOTICE">Notice period</option>
              <option value="VACATED">Vacated</option>
              <option value="">All</option>
            </Select>
            <Select value={pgFilter} onChange={(event) => setPgFilter(event.target.value)} aria-label="Filter by PG">
              <option value="">All PGs</option>
              {(pgsQuery.data?.pgs ?? []).map((pg) => (
                <option key={pg.id} value={pg.id}>{pg.name}</option>
              ))}
            </Select>
          </div>

          <div className="mt-3 space-y-2">
            {isLoading ? (
              [0, 1, 2].map((index) => <Skeleton key={index} className="h-20 w-full" />)
            ) : error ? (
              <ErrorNote message="Could not load residents." onRetry={() => void refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<ResidentsIcon size={32} />}
                title="No residents here"
                description="Add a resident manually or send an invitation link to a bed."
                action={<Button onClick={() => setAddOpen(true)}>Add resident</Button>}
              />
            ) : (
              rows.map((row) => (
                <Card key={row.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">{row.resident.name}</p>
                      <StatusBadge status={row.status} />
                      {row.rentStatus !== "NOT_GENERATED" ? <Badge tone={row.rentStatus === "PAID" ? "green" : row.rentStatus === "OVERDUE" ? "red" : "amber"}>{row.rentStatus === "NOT_GENERATED" ? "Rent not set" : `Rent ${row.rentStatus.toLowerCase()}`}</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      Room {row.roomNumber} · {row.floorName} · Bed {row.bedLabel ?? "—"} · {inr(row.monthlyRent)}/month
                    </p>
                    <p className="text-[11px] text-ink-muted">{row.resident.email}{row.resident.phone ? ` · ${row.resident.phone}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setSelected(row); setTransferBed(""); }}>
                      Details
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="mt-4 space-y-2">
          {invitationsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !invitationsQuery.data?.invitations.length ? (
            <EmptyState
              icon={<Send size={30} />}
              title="No invitations yet"
              description="Invite a resident to an empty bed and share the code or link."
              action={<Button onClick={() => setInviteOpen(true)}>Create invitation</Button>}
            />
          ) : (
            invitationsQuery.data.invitations.map((invitation) => (
              <Card key={invitation.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-bold tracking-wider">{invitation.code}</p>
                    <StatusBadge status={invitation.status} />
                  </div>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    {invitation.pgName} · Room {invitation.roomNumber ?? "—"} · Bed {invitation.bedLabel ?? "—"} · {inr(invitation.monthlyRent)}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {invitation.email ?? invitation.phone ?? "Open invitation"} · expires {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Copy className="h-3.5 w-3.5" />}
                    onClick={() => {
                      void navigator.clipboard.writeText(`${window.location.origin}${invitation.inviteLink}`);
                      toast.push("Invite link copied.");
                    }}
                  >
                    Copy link
                  </Button>
                  {invitation.status === "PENDING" ? (
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<X className="h-3.5 w-3.5" />}
                      onClick={() => setCancelTarget(invitation)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Add resident */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setFormError(null); }}
        title="Add a resident"
        description="Create an account and allocate a bed in one step."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button loading={addResident.isPending} onClick={() => addResident.mutate()} disabled={!addForm.pgId || !addForm.bedId || !addForm.name || !addForm.email || !addForm.monthlyRent}>
              Add and allocate
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="PG" className="sm:col-span-2">
            <Select value={addForm.pgId} onChange={(event) => setAddForm({ ...addForm, pgId: event.target.value, bedId: "", monthlyRent: "" })}>
              <option value="">Select a PG</option>
              {(pgsQuery.data?.pgs ?? []).map((pg) => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
            </Select>
          </Field>
          <Field label="Available bed" className="sm:col-span-2" hint={addForm.pgId && !beds.length ? "No free beds in this PG. Free a bed or add a room first." : undefined}>
            <Select
              value={addForm.bedId}
              onChange={(event) => {
                const bed = beds.find((item) => item.id === event.target.value);
                setAddForm({ ...addForm, bedId: event.target.value, monthlyRent: bed ? String(bed.rentPerBed) : addForm.monthlyRent });
              }}
              disabled={!addForm.pgId}
            >
              <option value="">Select a bed</option>
              {beds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.floorName} · Room {bed.roomNumber} · Bed {bed.label} · {inr(bed.rentPerBed)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Full name">
            <Input value={addForm.name} onChange={(event) => setAddForm({ ...addForm, name: event.target.value })} placeholder="Rahul Verma" />
          </Field>
          <Field label="Email">
            <Input type="email" value={addForm.email} onChange={(event) => setAddForm({ ...addForm, email: event.target.value })} placeholder="rahul@example.com" />
          </Field>
          <Field label="Phone" hint="Optional">
            <Input value={addForm.phone} onChange={(event) => setAddForm({ ...addForm, phone: event.target.value })} />
          </Field>
          <Field label="Monthly rent">
            <Input type="number" value={addForm.monthlyRent} onChange={(event) => setAddForm({ ...addForm, monthlyRent: event.target.value })} />
          </Field>
          <Field label="Security deposit">
            <Input type="number" value={addForm.deposit} onChange={(event) => setAddForm({ ...addForm, deposit: event.target.value })} />
          </Field>
          {formError ? <p className="error-text sm:col-span-2">{formError}</p> : null}
          <p className="text-xs text-ink-muted sm:col-span-2">
            If this email is new, an account is created and a temporary password is shown so you can share it.
          </p>
        </div>
      </Modal>

      {/* Invite */}
      <Modal
        open={inviteOpen}
        onClose={() => { setInviteOpen(false); setFormError(null); }}
        title="Invite a resident"
        description="Pick a free bed and share the code. The resident accepts it from their own account."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button loading={createInvite.isPending} onClick={() => createInvite.mutate()} disabled={!inviteForm.pgId || !inviteForm.bedId}>
              Create invitation
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="PG">
            <Select value={inviteForm.pgId} onChange={(event) => setInviteForm({ ...inviteForm, pgId: event.target.value, bedId: "" })}>
              <option value="">Select a PG</option>
              {(pgsQuery.data?.pgs ?? []).map((pg) => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
            </Select>
          </Field>
          <Field label="Free bed">
            <Select value={inviteForm.bedId} onChange={(event) => setInviteForm({ ...inviteForm, bedId: event.target.value })} disabled={!inviteForm.pgId}>
              <option value="">Select a bed</option>
              {currentPgBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.floorName} · Room {bed.roomNumber} · Bed {bed.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Resident email" hint="Optional. If they already have an account we notify them.">
            <Input type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} />
          </Field>
          <Field label="Phone" hint="Optional">
            <Input value={inviteForm.phone} onChange={(event) => setInviteForm({ ...inviteForm, phone: event.target.value })} />
          </Field>
          {formError ? <p className="error-text">{formError}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelInvitation.mutate(cancelTarget.id)}
        loading={cancelInvitation.isPending}
        title="Cancel this invitation?"
        description={
          cancelTarget
            ? `Code ${cancelTarget.code} for ${cancelTarget.pgName} room ${cancelTarget.roomNumber ?? "—"} will stop working and the bed becomes free to invite again.`
            : ""
        }
        confirmLabel="Cancel invitation"
      />

      {/* Temporary password */}
      <Modal
        open={!!tempPassword}
        onClose={() => setTempPassword(null)}
        title="Resident account created"
        size="sm"
        footer={<Button onClick={() => setTempPassword(null)}>Done</Button>}
      >
        <p className="text-[13px] text-ink-soft">Share this temporary password with the resident. They can change it after signing in.</p>
        <p className="mt-3 rounded-xl bg-canvas px-4 py-3 font-mono text-sm font-bold">{tempPassword}</p>
      </Modal>

      {/* Resident detail */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.resident.name ?? ""}
        description={selected ? `Room ${selected.roomNumber} · ${selected.floorName} · Bed ${selected.bedLabel ?? "—"}` : ""}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Monthly rent", value: inr(selected.monthlyRent) },
                { label: "Deposit", value: inr(selected.securityDeposit) },
                { label: "Joined", value: formatDate(selected.joinedAt) },
                { label: "Status", value: <StatusBadge status={selected.status} /> },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-canvas p-3">
                  <p className="text-[10px] uppercase tracking-wide text-ink-muted">{item.label}</p>
                  <div className="mt-0.5 text-[13px] font-bold">{item.value}</div>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Rent history</p>
              {detailQuery.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : detailQuery.data?.rent.length ? (
                <div className="divide-y divide-ink/5 rounded-xl border border-ink/5">
                  {detailQuery.data.rent.map((record) => (
                    <div key={record.id} className="flex items-center justify-between px-3 py-2 text-[13px]">
                      <span>{record.periodMonth}</span>
                      <span className="text-ink-muted">{inr(record.amountPaid)} / {inr(record.amountDue)}</span>
                      <StatusBadge status={record.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-ink-muted">No rent records yet. Generate this month from the rent page.</p>
              )}
            </div>

            {selected.status !== "VACATED" ? (
              <div className="space-y-3 rounded-xl border border-ink/5 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Transfer to another bed</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={transferBed} onChange={(event) => setTransferBed(event.target.value)}>
                    <option value="">Select a free bed in this PG</option>
                    {(invitationsQuery.data?.invitations.length ? beds : beds)
                      .filter((bed) => bed.id !== selected.id)
                      .map((bed) => (
                        <option key={bed.id} value={bed.id}>
                          {bed.floorName} · Room {bed.roomNumber} · Bed {bed.label}
                        </option>
                      ))}
                  </Select>
                  <Button
                    onClick={() => updateResidency.mutate({ id: selected.id, path: "transfer", data: { bedId: transferBed } })}
                    disabled={!transferBed}
                    loading={updateResidency.isPending}
                  >
                    Transfer
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.status === "ACTIVE" ? (
                    <Button size="sm" variant="secondary" onClick={() => updateResidency.mutate({ id: selected.id, data: { status: "NOTICE" } })}>
                      Start notice period
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      updateResidency.mutate({ id: selected.id, path: "vacate", data: {} });
                      setSelected(null);
                    }}
                  >
                    Vacate resident
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-canvas px-3 py-2 text-[12px] text-ink-muted">
                Vacated on {formatDate(selected.vacatedAt)}. History is kept for records.
              </p>
            )}

            {detailQuery.data?.previousStays.length ? (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Other stays</p>
                <ul className="space-y-1 text-[12px] text-ink-muted">
                  {detailQuery.data.previousStays.map((stay) => (
                    <li key={stay.id} className="rounded-lg bg-canvas px-3 py-2">
                      {stay.pgName} · Room {stay.roomNumber} · {stay.status.toLowerCase()} · {formatDate(stay.joinedAt)} → {formatDate(stay.vacatedAt)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-xl border border-ink/5 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Contact</p>
              <InfoRow label="Email" value={selected.resident.email} />
              <InfoRow label="Phone" value={selected.resident.phone ?? "Not provided"} />
            </div>
          </div>
        ) : null}
      </Modal>

      {rows.length === 0 && !isLoading && tab === "residents" ? (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-muted">
          <UserPlus className="h-3.5 w-3.5" /> Tip: invitations keep the resident in control of their own account.
        </p>
      ) : null}
    </div>
  );
}
