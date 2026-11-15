import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Card, EmptyState, ErrorNote, PageHeader, SearchField, Select, Skeleton, StatusBadge } from "../../components/ui";
import { ComplaintIcon } from "../../components/icons";
import { formatDate } from "../../lib/format";

interface ComplaintRow {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  createdAt: string;
  residentName: string;
  residentEmail: string;
  pgName: string;
  roomNumber: string | null;
  images: string[];
}

const CATEGORIES = ["ALL", "WIFI", "WATER", "ELECTRICITY", "ROOM", "BATHROOM", "CLEANING", "FOOD", "SECURITY", "OTHER"];

export default function AdminComplaints() {
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-complaints", status, category],
    queryFn: () => api.get<{ complaints: ComplaintRow[] }>(`/admin/complaints?status=${status}&category=${category}`),
  });

  const rows = (data?.complaints ?? []).filter((row) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return row.title.toLowerCase().includes(term) || row.residentName.toLowerCase().includes(term) || row.pgName.toLowerCase().includes(term);
  });

  return (
    <div>
      <PageHeader title="Complaints" subtitle="Monitor how quickly issues are being resolved across the platform." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SearchField value={search} onChange={setSearch} placeholder="Search complaints" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          <option value="ALL">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </Select>
        <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
          {CATEGORIES.map((option) => (
            <option key={option} value={option}>{option === "ALL" ? "All categories" : option}</option>
          ))}
        </Select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-24 w-full" />)
        ) : error ? (
          <ErrorNote message="Could not load complaints." onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ComplaintIcon size={32} />} title="No complaints match" description="Nothing to review with these filters." />
        ) : (
          rows.map((row) => (
            <Card key={row.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{row.title}</p>
                    <StatusBadge status={row.status} />
                    <Badge tone={row.urgency === "HIGH" ? "red" : row.urgency === "MEDIUM" ? "amber" : "gray"}>{row.urgency} urgency</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {row.pgName} · Room {row.roomNumber ?? "—"} · {row.residentName} · {formatDate(row.createdAt)}
                  </p>
                </div>
                <Badge tone="blue">{row.category}</Badge>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-soft">{row.description}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
