import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  ImageUploader,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "../../components/ui";
import { ComplaintIcon } from "../../components/icons";
import { formatDateTime } from "../../lib/format";

interface ComplaintRow {
  id: string;
  category: string;
  title: string;
  description: string;
  images: string[];
  urgency: string;
  priority: string;
  status: string;
  response: string | null;
  createdAt: string;
  pg: { name: string };
  updates: { id: string; message: string; statusTo: string | null; createdAt: string; author: { name: string } }[];
}

const CATEGORIES = [
  { value: "WIFI", label: "Wi-Fi / Internet" },
  { value: "WATER", label: "Water" },
  { value: "ELECTRICITY", label: "Electricity" },
  { value: "ROOM", label: "Room maintenance" },
  { value: "BATHROOM", label: "Bathroom" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "FOOD", label: "Food" },
  { value: "SECURITY", label: "Security" },
  { value: "OTHER", label: "Other" },
];

export default function ResidentComplaints() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "WIFI", title: "", description: "", urgency: "MEDIUM" });
  const [images, setImages] = useState<string[]>([]);
  const [reopenTarget, setReopenTarget] = useState<ComplaintRow | null>(null);
  const [reopenMessage, setReopenMessage] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["resident-complaints"],
    queryFn: () => api.get<{ complaints: ComplaintRow[] }>("/resident/complaints"),
  });

  const submit = useMutation({
    mutationFn: () => api.post("/resident/complaints", { ...form, images }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resident-complaints"] });
      await queryClient.invalidateQueries({ queryKey: ["resident-dashboard"] });
      toast.push("Complaint submitted. Your owner has been notified.");
      setOpen(false);
      setForm({ category: "WIFI", title: "", description: "", urgency: "MEDIUM" });
      setImages([]);
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not submit the complaint.", "error"),
  });

  const reopen = useMutation({
    mutationFn: () => api.post(`/resident/complaints/${reopenTarget?.id}/reopen`, { message: reopenMessage }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resident-complaints"] });
      toast.push("Complaint reopened.");
      setReopenTarget(null);
      setReopenMessage("");
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not reopen.", "error"),
  });

  const rows = data?.complaints ?? [];

  return (
    <div>
      <PageHeader
        title="Issues"
        subtitle="Report something that is not working and follow its progress."
        actions={<Button onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>Report an issue</Button>}
      />

      <div className="space-y-2">
        {isLoading ? (
          [0, 1].map((index) => <Skeleton key={index} className="h-28 w-full" />)
        ) : error ? (
          <ErrorNote message="Could not load your complaints." onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ComplaintIcon size={32} />}
            title="No issues reported"
            description="When something needs fixing, report it here and your owner will be notified."
            action={<Button onClick={() => setOpen(true)}>Report an issue</Button>}
          />
        ) : (
          rows.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{row.title}</p>
                    <StatusBadge status={row.status} />
                    <Badge tone={row.urgency === "HIGH" ? "red" : row.urgency === "MEDIUM" ? "amber" : "gray"}>{row.urgency.toLowerCase()}</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {row.pg.name} · {row.category} · {formatDateTime(row.createdAt)}
                  </p>
                </div>
                {["RESOLVED", "CLOSED"].includes(row.status) ? (
                  <Button size="sm" variant="secondary" onClick={() => setReopenTarget(row)}>
                    Reopen
                  </Button>
                ) : null}
              </div>

              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{row.description}</p>

              {row.images.length ? (
                <div className="mt-2 flex gap-2">
                  {row.images.map((image) => (
                    <img key={image} src={image} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  ))}
                </div>
              ) : null}

              {row.response ? (
                <p className="mt-2 rounded-xl bg-primary/5 px-3 py-2 text-[12px] text-ink-soft">
                  <span className="font-semibold text-ink">Owner reply:</span> {row.response}
                </p>
              ) : null}

              <div className="mt-3 border-t border-ink/5 pt-2">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Progress</p>
                <ol className="space-y-1.5">
                  {row.updates.map((update) => (
                    <li key={update.id} className="flex items-start gap-2 text-[12px]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      <span className="text-ink-soft">
                        {update.message}
                        <span className="ml-1 text-[10px] text-ink-muted">
                          {update.author.name} · {formatDateTime(update.createdAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Report an issue"
        description="Give your owner enough detail to fix it quickly."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              loading={submit.isPending}
              onClick={() => submit.mutate()}
              disabled={form.title.trim().length < 4 || form.description.trim().length < 10}
            >
              Submit complaint
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </Select>
            </Field>
            <Field label="Urgency">
              <Select value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value })}>
                <option value="LOW">Low — whenever possible</option>
                <option value="MEDIUM">Medium — affects daily use</option>
                <option value="HIGH">High — needs attention today</option>
              </Select>
            </Field>
          </div>
          <Field label="Title" error={form.title.length > 0 && form.title.trim().length < 4 ? "Add a few more characters." : undefined}>
            <input className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Wi-Fi drops every evening" />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="When did it start? What exactly happens?" />
          </Field>
          <Field label="Photos" hint="Optional — up to 4 images">
            <ImageUploader images={images} onChange={setImages} folder="complaints" max={4} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!reopenTarget}
        onClose={() => setReopenTarget(null)}
        title="Reopen this complaint"
        description="Tell your owner what is still not working."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReopenTarget(null)}>Cancel</Button>
            <Button loading={reopen.isPending} onClick={() => reopen.mutate()} disabled={reopenMessage.trim().length < 5}>
              Reopen
            </Button>
          </>
        }
      >
        <Field label="What is still wrong?">
          <Textarea value={reopenMessage} onChange={(event) => setReopenMessage(event.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
