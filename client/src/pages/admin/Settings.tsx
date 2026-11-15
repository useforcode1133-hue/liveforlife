import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Skeleton, StatusBadge, useToast } from "../../components/ui";
import { formatDateTime } from "../../lib/format";

interface SettingsResponse {
  settings: Record<string, string>;
}

export default function AdminSettings() {
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [broadcast, setBroadcast] = useState({ title: "", body: "", role: "ALL" });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api.get<SettingsResponse>("/admin/settings"),
  });

  const emails = useQuery({
    queryKey: ["admin-emails"],
    queryFn: () =>
      api.get<{
        configured: boolean;
        fromAddress: string;
        teamInbox: string;
        emails: { id: string; to: string; subject: string; status: string; category: string; error: string | null; createdAt: string }[];
      }>("/admin/emails"),
  });

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/settings", {
        platformName: form.platformName,
        supportEmail: form.supportEmail,
        supportPhone: form.supportPhone,
        autoApproveOwners: form.autoApproveOwners,
        maintenanceMode: form.maintenanceMode,
      });
      toast.push("Platform settings saved.");
    } catch {
      toast.push("Could not save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const sendBroadcast = async () => {
    setSending(true);
    try {
      const result = await api.post<{ message: string }>("/admin/broadcast", broadcast);
      toast.push(result.message);
      setBroadcast({ title: "", body: "", role: "ALL" });
    } catch {
      toast.push("Could not send the announcement.", "error");
    } finally {
      setSending(false);
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <PageHeader title="Platform settings" subtitle="Global configuration and platform-wide announcements." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="General" subtitle="Shown across the product and in support messages." />
          <div className="space-y-4">
            <Field label="Platform name">
              <Input value={form.platformName ?? ""} onChange={(event) => update("platformName", event.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Support email">
                <Input type="email" value={form.supportEmail ?? ""} onChange={(event) => update("supportEmail", event.target.value)} />
              </Field>
              <Field label="Support phone">
                <Input value={form.supportPhone ?? ""} onChange={(event) => update("supportPhone", event.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner approvals" hint="When enabled new owners skip manual review.">
                <Select value={form.autoApproveOwners ?? "false"} onChange={(event) => update("autoApproveOwners", event.target.value)}>
                  <option value="false">Manual review</option>
                  <option value="true">Auto approve</option>
                </Select>
              </Field>
              <Field label="Maintenance mode" hint="Reserved for planned downtime notices.">
                <Select value={form.maintenanceMode ?? "false"} onChange={(event) => update("maintenanceMode", event.target.value)}>
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </Select>
              </Field>
            </div>
            <Button onClick={save} loading={saving}>Save settings</Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Email delivery"
            subtitle="Invitations, password resets, rent reminders and team alerts."
            action={
              emails.data ? (
                <Badge tone={emails.data.configured ? "green" : "amber"}>
                  {emails.data.configured ? "SMTP connected" : "SMTP not configured"}
                </Badge>
              ) : null
            }
          />
          {emails.data ? (
            <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-ink-muted">
              <span>From: <strong className="font-semibold text-ink-soft">{emails.data.fromAddress}</strong></span>
              <span>Team inbox: <strong className="font-semibold text-ink-soft">{emails.data.teamInbox || "not set"}</strong></span>
            </div>
          ) : null}
          {!emails.data?.configured ? (
            <p className="mb-3 rounded-xl bg-sun/15 px-3 py-2 text-[12px] leading-relaxed text-[#141928]">
              Messages are saved in the outbox but not delivered. Add <code className="font-mono">SMTP_HOST</code>,
              <code className="font-mono"> SMTP_USER</code>, <code className="font-mono">SMTP_PASS</code> and
              <code className="font-mono"> MAIL_FROM</code> to the server environment (plus <code className="font-mono">TEAM_INBOX</code>{" "}
              for team alerts) to start sending.
            </p>
          ) : null}
          {emails.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !emails.data?.emails.length ? (
            <p className="text-[13px] text-ink-muted">No emails yet. Invite a resident or send a rent reminder to see them here.</p>
          ) : (
            <div className="divide-y divide-ink/5 rounded-xl border border-ink/5">
              {emails.data.emails.slice(0, 8).map((email) => (
                <div key={email.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{email.subject}</p>
                    <p className="truncate text-[11px] text-ink-muted">{email.to} · {formatDateTime(email.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="gray">{email.category.replace("_", " ").toLowerCase()}</Badge>
                    <StatusBadge status={email.status === "SENT" ? "PAID" : email.status === "FAILED" ? "OVERDUE" : "PENDING"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Send an announcement" subtitle="Delivered as an in-app notification to the audience you choose." />
          <div className="space-y-4">
            <Field label="Audience">
              <Select value={broadcast.role} onChange={(event) => setBroadcast({ ...broadcast, role: event.target.value })}>
                <option value="ALL">Everyone</option>
                <option value="PG_OWNER">PG owners</option>
                <option value="RESIDENT">Residents</option>
              </Select>
            </Field>
            <Field label="Title">
              <Input value={broadcast.title} onChange={(event) => setBroadcast({ ...broadcast, title: event.target.value })} placeholder="e.g. Scheduled maintenance" />
            </Field>
            <Field label="Message">
              <textarea
                className="field min-h-[110px]"
                value={broadcast.body}
                onChange={(event) => setBroadcast({ ...broadcast, body: event.target.value })}
                placeholder="Write the message people will see."
              />
            </Field>
            <Button onClick={sendBroadcast} loading={sending} disabled={!broadcast.title.trim() || !broadcast.body.trim()}>
              Send announcement
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
