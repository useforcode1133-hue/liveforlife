import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Textarea,
  statusLabel,
  useToast,
} from "../../components/ui";
import { BuildingIcon } from "../../components/icons";

export default function ResidentProfile() {
  const { user, logout, setUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: "", phone: "", currentPassword: "", newPassword: "" });
  const [preferences, setPreferences] = useState({ rentReminders: true, announcements: true, menuUpdates: true, complaintUpdates: true });
  const [saving, setSaving] = useState(false);
  const [moveOutOpen, setMoveOutOpen] = useState(false);
  const [moveOutReason, setMoveOutReason] = useState("");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      api.get<{
        user: { name: string; phone: string | null; preferences: typeof preferences | null };
      }>("/auth/me"),
  });

  const dashboardQuery = useQuery({
    queryKey: ["resident-dashboard"],
    queryFn: () =>
      api.get<{ residency: { status: string; pg: { name: string } } | null }>("/resident/dashboard"),
  });

  useEffect(() => {
    if (meQuery.data?.user) {
      setProfile((current) => ({ ...current, name: meQuery.data.user.name, phone: meQuery.data.user.phone ?? "" }));
      if (meQuery.data.user.preferences) setPreferences(meQuery.data.user.preferences);
    }
  }, [meQuery.data]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const data = await api.patch<{ user: { name: string; phone: string | null } }>("/auth/profile", {
        name: profile.name,
        phone: profile.phone,
        ...(profile.newPassword ? { currentPassword: profile.currentPassword, newPassword: profile.newPassword } : {}),
      });
      if (user) setUser({ ...user, name: data.user.name, phone: data.user.phone });
      setProfile({ ...profile, currentPassword: "", newPassword: "" });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.push("Profile updated.");
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : "Could not save your profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    try {
      await api.put("/auth/notification-preferences", preferences);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.push("Notification preferences saved.");
    } catch {
      toast.push("Could not save preferences.", "error");
    }
  };

  const moveOut = useMutation({
    mutationFn: () => api.post("/resident/move-out-request", { reason: moveOutReason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resident-dashboard"] });
      toast.push("Move-out request sent to your owner.");
      setMoveOutOpen(false);
      setMoveOutReason("");
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not send the request.", "error"),
  });

  if (meQuery.isLoading) return <Skeleton className="h-64 w-full" />;

  const residency = dashboardQuery.data?.residency;

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your details, notifications and residency." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size={56} />
            <div>
              <p className="text-sm font-bold">{user?.name}</p>
              <p className="text-[12px] text-ink-muted">{user?.email}</p>
              <Badge tone="purple" className="mt-1">{statusLabel(user?.role ?? "")}</Badge>
            </div>
          </div>
          <div className="space-y-3">
            <Field label="Full name">
              <Input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Current password" hint="Only when changing it">
                <Input type="password" value={profile.currentPassword} onChange={(event) => setProfile({ ...profile, currentPassword: event.target.value })} autoComplete="current-password" />
              </Field>
              <Field label="New password" hint="At least 8 characters">
                <Input type="password" value={profile.newPassword} onChange={(event) => setProfile({ ...profile, newPassword: event.target.value })} autoComplete="new-password" />
              </Field>
            </div>
            <Button onClick={saveProfile} loading={saving}>Save changes</Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Residency" subtitle={residency ? `${residency.pg.name} · ${residency.status.toLowerCase()}` : "Not currently staying in a PG"} icon={<BuildingIcon size={22} />} />
            <div className="flex flex-wrap gap-2">
              <Link to="/resident/history" className="rounded-xl border border-ink/10 px-3 py-2 text-[12px] font-semibold text-ink-soft hover:border-primary/40 hover:text-primary">
                Residency history
              </Link>
              {residency && residency.status === "ACTIVE" ? (
                <Button size="sm" variant="secondary" onClick={() => setMoveOutOpen(true)}>
                  Request move-out
                </Button>
              ) : null}
            </div>
            {residency?.status === "NOTICE" ? (
              <p className="mt-3 rounded-xl bg-sun/15 px-3 py-2 text-[12px] text-[#141928]">
                Your move-out request is with the owner. Once you vacate you can join another PG with the same account.
              </p>
            ) : null}
            <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
              Leaving a PG keeps your rent history and past complaints available, and you can accept a new invitation
              any time.
            </p>
          </Card>

          <Card>
            <CardHeader title="Notifications" subtitle="Choose what you want to hear about." />
            <div className="space-y-2">
              {[
                { key: "rentReminders" as const, label: "Rent reminders", description: "Monthly due dates and payment confirmations" },
                { key: "announcements" as const, label: "Announcements", description: "Notices from your PG" },
                { key: "menuUpdates" as const, label: "Food menu updates", description: "When meals change" },
                { key: "complaintUpdates" as const, label: "Complaint updates", description: "Replies and status changes" },
              ].map((item) => (
                <label key={item.key} className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-ink/5 p-3">
                  <span>
                    <span className="block text-[13px] font-semibold">{item.label}</span>
                    <span className="block text-[11px] text-ink-muted">{item.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 accent-primary"
                    checked={preferences[item.key]}
                    onChange={(event) => setPreferences({ ...preferences, [item.key]: event.target.checked })}
                  />
                </label>
              ))}
            </div>
            <Button className="mt-3" variant="secondary" onClick={savePreferences}>Save preferences</Button>
          </Card>

          <Card>
            <CardHeader title="Session" subtitle="Sign out of this device." />
            <Button
              variant="danger"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              Sign out
            </Button>
          </Card>
        </div>
      </div>

      <Modal
        open={moveOutOpen}
        onClose={() => setMoveOutOpen(false)}
        title="Request to move out"
        description="This tells your owner you plan to leave. Your rent history and past complaints stay with you, and the bed is freed once they mark you vacated."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOutOpen(false)}>Cancel</Button>
            <Button onClick={() => moveOut.mutate()} loading={moveOut.isPending}>Send request</Button>
          </>
        }
      >
        <Field label="Reason" hint="Optional — helps your owner plan.">
          <Textarea value={moveOutReason} onChange={(event) => setMoveOutReason(event.target.value)} placeholder="Moving closer to work, finishing my course…" />
        </Field>
      </Modal>
    </div>
  );
}
