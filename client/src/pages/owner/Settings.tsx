import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, PageHeader, Skeleton, useToast } from "../../components/ui";
import { statusLabel } from "../../components/ui";

export default function OwnerSettings() {
  const { user, logout, setUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: "", phone: "", currentPassword: "", newPassword: "" });
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({ rentReminders: true, announcements: true, menuUpdates: true, complaintUpdates: true });

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      api.get<{ user: { name: string; phone: string | null; preferences: typeof preferences | null } }>("/auth/me"),
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

  if (meQuery.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <PageHeader title="Account settings" subtitle="Your profile, password and notification preferences." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" subtitle="How your name appears to residents." />
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size={52} />
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
            <CardHeader title="Notifications" subtitle="Choose what reaches you. Rent reminders and complaint updates are sent by your own PG activity." />
            <div className="space-y-2">
              {[
                { key: "rentReminders" as const, label: "Rent reminders", description: "Monthly rent due and payment confirmations" },
                { key: "announcements" as const, label: "Announcements", description: "Notices sent to your PG" },
                { key: "menuUpdates" as const, label: "Food menu updates", description: "When the menu changes" },
                { key: "complaintUpdates" as const, label: "Complaint updates", description: "Status changes and replies" },
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
    </div>
  );
}
