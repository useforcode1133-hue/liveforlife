import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BellOff, CheckCheck, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button, Card, EmptyState, ErrorNote, PageHeader, Skeleton, Tabs, cn, useToast } from "../components/ui";
import { BellIcon } from "../components/icons";
import { relativeTime } from "../lib/format";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<"all" | "unread">("all");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ notifications: NotificationRow[]; unread: number }>("/notifications"),
  });

  const markAll = async () => {
    await api.post("/notifications/read-all");
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    toast.push("All notifications marked as read.");
  };

  const markOne = async (id: string) => {
    await api.post(`/notifications/${id}/read`);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const remove = async (id: string) => {
    await api.del(`/notifications/${id}`);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const rows = (data?.notifications ?? []).filter((row) => (tab === "unread" ? !row.readAt : true));

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Rent reminders, menu updates, complaint replies and announcements all land here."
        actions={
          <Button variant="secondary" size="sm" onClick={markAll} icon={<CheckCheck className="h-4 w-4" />} disabled={!data?.unread}>
            Mark all read
          </Button>
        }
      />

      <Tabs
        tabs={[
          { value: "all", label: "All", count: data?.notifications.length },
          { value: "unread", label: "Unread", count: data?.unread },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-4 space-y-2">
        {isLoading ? (
          [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-20 w-full" />)
        ) : error ? (
          <ErrorNote message="Could not load notifications." onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<BellOff className="h-8 w-8 text-ink-muted" />}
            title={tab === "unread" ? "No unread notifications" : "No notifications yet"}
            description="When there is rent news, a menu change or a complaint reply, you will see it here."
          />
        ) : (
          rows.map((row) => (
            <Card key={row.id} className={cn("flex items-start gap-3 p-4", !row.readAt && "border-primary/20 bg-primary/[0.02]")}>
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <BellIcon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold">{row.title}</p>
                  {!row.readAt ? <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" /> : null}
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{row.body}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-muted">
                  <span>{relativeTime(row.createdAt)}</span>
                  {row.link ? (
                    <Link to={row.link} onClick={() => void markOne(row.id)} className="font-semibold text-primary hover:underline">
                      Open
                    </Link>
                  ) : null}
                  {!row.readAt ? (
                    <button onClick={() => void markOne(row.id)} className="font-semibold text-ink-soft hover:underline">
                      Mark read
                    </button>
                  ) : null}
                </div>
              </div>
              <button
                onClick={() => void remove(row.id)}
                className="rounded-lg p-1.5 text-ink-muted transition hover:bg-danger/5 hover:text-danger"
                aria-label={`Delete notification: ${row.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
