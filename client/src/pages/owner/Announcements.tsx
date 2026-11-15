import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Trash2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "../../components/ui";
import { AnnouncementIcon } from "../../components/icons";
import { formatDateTime } from "../../lib/format";

const CATEGORIES = ["GENERAL", "RENT", "MAINTENANCE", "FOOD", "WATER", "ELECTRICITY", "SECURITY", "EMERGENCY"];

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: string;
  audience: string;
  floorId: string | null;
  pgName: string;
  recipientCount: number | null;
  authorName: string;
  createdAt: string;
}

export default function OwnerAnnouncements() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ pgId: "", title: "", body: "", category: "GENERAL", audience: "ALL", floorId: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["owner-announcements"],
    queryFn: () => api.get<{ announcements: AnnouncementRow[]; pgs: { id: string; name: string }[] }>("/owner/announcements"),
  });

  const pgDetail = useQuery({
    queryKey: ["owner-pg", form.pgId],
    queryFn: () => api.get<{ floors: { id: string; name: string }[] }>(`/owner/pgs/${form.pgId}`),
    enabled: Boolean(form.pgId),
  });

  useEffect(() => {
    if (!form.pgId && data?.pgs.length) setForm((current) => ({ ...current, pgId: data.pgs[0].id }));
  }, [data, form.pgId]);

  const send = useMutation({
    mutationFn: () =>
      api.post<{ recipientCount: number }>("/owner/announcements", {
        pgId: form.pgId,
        title: form.title,
        body: form.body,
        category: form.category,
        audience: form.audience,
        floorId: form.audience === "FLOOR" ? form.floorId : undefined,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["owner-announcements"] });
      toast.push(`Announcement sent to ${result.recipientCount} residents.`);
      setForm({ ...form, title: "", body: "" });
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not send the announcement.", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/owner/announcements/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["owner-announcements"] });
      setDeleteId(null);
      toast.push("Announcement removed.");
    },
    onError: () => toast.push("Could not remove it.", "error"),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <ErrorNote message="Could not load announcements." onRetry={() => void refetch()} />;

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Tell residents what they need to know, without a group chat." />

      {!data.pgs.length ? (
        <EmptyState icon={<AnnouncementIcon size={32} />} title="Add a PG first" description="Announcements are sent to residents of a property." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Create announcement" subtitle="Residents receive an in-app notification instantly." icon={<Megaphone className="h-4 w-4 text-ink-muted" />} />
            <div className="space-y-3">
              <Field label="PG">
                <Select value={form.pgId} onChange={(event) => setForm({ ...form, pgId: event.target.value, floorId: "" })}>
                  {data.pgs.map((pg) => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Category">
                  <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category.charAt(0) + category.slice(1).toLowerCase()}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Audience">
                  <Select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>
                    <option value="ALL">All residents</option>
                    <option value="FLOOR">One floor</option>
                  </Select>
                </Field>
              </div>
              {form.audience === "FLOOR" ? (
                <Field label="Floor">
                  <Select value={form.floorId} onChange={(event) => setForm({ ...form, floorId: event.target.value })}>
                    <option value="">Select a floor</option>
                    {(pgDetail.data?.floors ?? []).map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                  </Select>
                </Field>
              ) : null}
              <Field label="Title">
                <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Water tank cleaning on Sunday" />
              </Field>
              <Field label="Message">
                <Textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Share the details residents need." />
              </Field>
              <Button
                full
                loading={send.isPending}
                onClick={() => send.mutate()}
                disabled={!form.pgId || form.title.trim().length < 4 || form.body.trim().length < 5 || (form.audience === "FLOOR" && !form.floorId)}
              >
                Send announcement
              </Button>
            </div>
          </Card>

          <div className="space-y-2">
            {data.announcements.length === 0 ? (
              <EmptyState icon={<AnnouncementIcon size={30} />} title="No announcements yet" description="Your first notice will appear here once sent." />
            ) : (
              data.announcements.map((announcement) => (
                <Card key={announcement.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">{announcement.title}</p>
                        <Badge tone="purple">{announcement.category}</Badge>
                        <Badge tone="gray">{announcement.audience === "ALL" ? "All residents" : announcement.audience === "FLOOR" ? "One floor" : "Selected"}</Badge>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{announcement.body}</p>
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {announcement.pgName} · {formatDateTime(announcement.createdAt)}
                        {announcement.recipientCount !== null ? ` · ${announcement.recipientCount} recipients` : ""}
                      </p>
                    </div>
                    <button onClick={() => setDeleteId(announcement.id)} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger/5 hover:text-danger" aria-label="Delete announcement">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
        title="Remove this announcement?"
        description="It will no longer appear for residents. Notifications already delivered stay in their inbox."
        confirmLabel="Remove"
        loading={remove.isPending}
      />
    </div>
  );
}
