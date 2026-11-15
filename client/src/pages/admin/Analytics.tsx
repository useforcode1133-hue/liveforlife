import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../lib/api";
import { Card, CardHeader, ErrorNote, PageHeader, Progress, SkeletonCards, StatusBadge } from "../../components/ui";
import { compactInr, inr } from "../../lib/format";

interface AnalyticsData {
  occupancyByProperty: { name: string; city: string; beds: number; filled: number; rate: number }[];
  rentTrend: { month: string; label: string; collected: number; due: number; collectionRate: number }[];
  residencyLifecycle: { status: string; count: number }[];
  complaintBreakdown: { category: string; count: number }[];
  pgTypes: { type: string; count: number }[];
}

const COLORS = ["#4E65F6", "#5B5CE6", "#4E65F6", "#5B5CE6", "#5B5CE6"];

export default function AdminAnalytics() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => api.get<AnalyticsData>("/admin/analytics"),
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Loading trends…" />
        <SkeletonCards count={3} />
      </div>
    );
  }
  if (error || !data) return <ErrorNote message="Could not load analytics." onRetry={() => void refetch()} />;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Occupancy, rent collection and complaint trends across every property." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Rent collection trend" subtitle="Collected against billed, last six months" />
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.rentTrend} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#CBE4FF" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value: number) => inr(value)} contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }} />
                <Line type="monotone" dataKey="due" name="Billed" stroke="#64748B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="collected" name="Collected" stroke="#4E65F6" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Collection rate" subtitle="Share of billed rent collected each month" />
          <div className="space-y-4 pt-2">
            {data.rentTrend.map((row) => (
              <div key={row.month}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink-soft">{row.label}</span>
                  <span className="text-ink-muted">
                    {compactInr(row.collected)} of {compactInr(row.due)} · {row.collectionRate}%
                  </span>
                </div>
                <Progress value={row.collectionRate} tone={row.collectionRate >= 80 ? "green" : row.collectionRate >= 50 ? "amber" : "coral"} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Occupancy by property" subtitle="Beds filled per PG" />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.occupancyByProperty} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#CBE4FF" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} unit="%" />
                <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip formatter={(value: number) => `${value}%`} contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }} />
                <Bar dataKey="rate" name="Occupancy" fill="#5B5CE6" radius={[0, 6, 6, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Residency lifecycle" subtitle="Distribution of residency statuses" />
          <div className="grid grid-cols-2 gap-3">
            {data.residencyLifecycle.map((row) => (
              <div key={row.status} className="rounded-xl bg-canvas p-3">
                <StatusBadge status={row.status} />
                <p className="mt-2 text-xl font-extrabold">{row.count}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">PG types</p>
            <div className="flex items-center gap-4">
              <div className="h-24 w-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.pgTypes} dataKey="count" nameKey="type" innerRadius={24} outerRadius={40} strokeWidth={0} paddingAngle={3}>
                      {data.pgTypes.map((entry, index) => (
                        <Cell key={entry.type} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 text-[12px] text-ink-soft">
                {data.pgTypes.map((row, index) => (
                  <p key={row.type} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                    {row.type.replace("_", " ").toLowerCase()} · {row.count}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
