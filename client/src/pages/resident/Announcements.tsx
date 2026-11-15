import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Card, EmptyState, ErrorNote, PageHeader, Skeleton } from "../../components/ui";
import { AnnouncementIcon } from "../../components/icons";
import { formatDateTime } from "../../lib/format";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: string;
  authorName: string;
  createdAt: string;
}

const toneFor: Record<string, "purple" | "blue" | "green" | "amber" | "coral" | "red" | "gray"> = {
  EMERGENCY: "red",
  MAINTENANCE: "amber",
  WATER: "blue",
  ELECTRICITY: "amber",
  RENT: "coral",
  FOOD: "green",
  SECURITY: "purple",
  GENERAL: "gray",
};

export default function ResidentAnnouncements() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["resident-announcements"],
    queryFn: () => api.get<{ announcements: AnnouncementRow[] }>("/resident/announcements"),
  });

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Notices from your PG owner." />

      <div className="space-y-2">
        {isLoading ? (
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-24 w-full" />)
        ) : error ? (
          <ErrorNote message="Could not load announcements." onRetry={() => void refetch()} />
        ) : !data?.announcements.length ? (
          <EmptyState
            icon={<AnnouncementIcon size={32} />}
            title="No announcements yet"
            description="Important notices from your PG will appear here."
          />
        ) : (
          data.announcements.map((announcement) => (
            <Card key={announcement.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold">{announcement.title}</p>
                <Badge tone={toneFor[announcement.category] ?? "gray"}>{announcement.category}</Badge>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{announcement.body}</p>
              <p className="mt-2 text-[11px] text-ink-muted">
                {announcement.authorName} · {formatDateTime(announcement.createdAt)}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
