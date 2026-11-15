import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../lib/api";
import { Badge, Card, CardHeader, EmptyState, ErrorNote, PageHeader, Progress, SkeletonCards, StatTile } from "../../components/ui";
import { BedIcon, BuildingIcon, ComplaintIcon, RentIcon, ResidentsIcon, SparkIcon } from "../../components/icons";
import { compactInr, formatDate, inr } from "../../lib/format";

interface AdminStats {
  stats: {
    totalOwners: number;
    pendingOwners: number;
    totalProperties: number;
    pendingProperties: number;
    totalResidents: number;
    activeResidents: number;
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    occupancyRate: number;
    rentTracked: number;
    rentCollected: number;
    outstanding: number;
    monthCollected: number;
    totalComplaints: number;
    openComplaints: number;
  };
  monthlySignups: { label: string; owners: number; residents: number; pgs: number }[];
  rentSeries: { label: string; collected: number; outstanding: number }[];
  complaintByCategory: { category: string; count: number }[];
  complaintByStatus: { status: string; count: number }[];
  pendingApprovals: { owners: { id: string; name: string }[]; properties: { id: string; name: string; city: string }[] };
  occupancyByPg: { id: string; name: string; beds: number; filled: number; vacant: number }[];
  recentActivity: { id: string; description: string; actorName: string; createdAt: string }[];
}

const PIE_COLORS = ["#4E65F6", "#5B5CE6", "#5B5CE6", "#4E65F6", "#5B5CE6", "#CBE4FF", "#64748B", "#4E65F6", "#141928"];

export default function AdminDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/admin/stats"),
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Platform overview" subtitle="Loading the latest numbers…" />
        <SkeletonCards count={4} />
      </div>
    );
  }
  if (error || !data) return <ErrorNote message="Could not load platform statistics." onRetry={() => void refetch()} />;

  const { stats } = data;

  return (
    <div>
      <PageHeader
        eyebrow="Administrator"
        title="Platform overview"
        subtitle="Everything happening across PG Manager right now."
        actions={
          <Link to="/admin/properties" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">
            Review properties
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="PG owners" value={stats.totalOwners} hint={`${stats.pendingOwners} awaiting approval`} icon={<ResidentsIcon size={20} />} tone="purple" />
        <StatTile label="Properties" value={stats.totalProperties} hint={`${stats.pendingProperties} pending verification`} icon={<BuildingIcon size={20} />} tone="blue" />
        <StatTile label="Residents" value={stats.totalResidents} hint={`${stats.activeResidents} currently staying`} icon={<BedIcon size={20} />} tone="green" />
        <StatTile label="Occupancy" value={`${stats.occupancyRate}%`} hint={`${stats.occupiedBeds} of ${stats.totalBeds} beds`} icon={<SparkIcon size={20} />} tone="amber" />
        <StatTile label="Rent tracked" value={compactInr(stats.rentTracked)} hint={`${inr(stats.rentCollected)} collected`} icon={<RentIcon size={20} />} tone="purple" />
        <StatTile label="Outstanding rent" value={compactInr(stats.outstanding)} hint="Across all properties" icon={<RentIcon size={20} />} tone="coral" />
        <StatTile label="This month collected" value={compactInr(stats.monthCollected)} hint="Live rent collection" icon={<RentIcon size={20} />} tone="green" />
        <StatTile label="Complaints" value={stats.totalComplaints} hint={`${stats.openComplaints} still open`} icon={<ComplaintIcon size={20} />} tone="red" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Growth" subtitle="New owners, residents and properties over six months" />
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlySignups} margin={{ left: -18, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="ownersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4E65F6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4E65F6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="residentsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5B5CE6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#5B5CE6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#CBE4FF" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }} />
                <Area type="monotone" dataKey="residents" name="Residents" stroke="#5B5CE6" strokeWidth={2} fill="url(#residentsGradient)" />
                <Area type="monotone" dataKey="owners" name="Owners" stroke="#4E65F6" strokeWidth={2} fill="url(#ownersGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Beds" subtitle="Occupied versus vacant" />
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <p className="text-3xl font-extrabold">{stats.occupiedBeds}</p>
              <p className="text-xs text-ink-muted">occupied of {stats.totalBeds}</p>
              <Badge tone="green">{stats.vacantBeds} vacant beds</Badge>
            </div>
            <div className="h-24 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Occupied", value: stats.occupiedBeds },
                      { name: "Vacant", value: stats.vacantBeds },
                    ]}
                    dataKey="value"
                    innerRadius={26}
                    outerRadius={40}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    <Cell fill="#4E65F6" />
                    <Cell fill="#CBE4FF" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {data.occupancyByPg.slice(0, 4).map((pg) => (
              <div key={pg.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate font-semibold text-ink-soft">{pg.name}</span>
                  <span className="text-ink-muted">
                    {pg.filled}/{pg.beds}
                  </span>
                </div>
                <Progress value={pg.beds ? (pg.filled / pg.beds) * 100 : 0} tone="primary" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Rent collection" subtitle="Collected and outstanding per month" />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.rentSeries} margin={{ left: -6, right: 6 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#CBE4FF" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value: number) => inr(value)} contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }} />
                <Bar dataKey="collected" name="Collected" fill="#4E65F6" radius={[6, 6, 0, 0]} maxBarSize={26} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#5B5CE6" radius={[6, 6, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Pending approvals" subtitle="Needs your attention" />
          <div className="space-y-2">
            {data.pendingApprovals.owners.length === 0 && data.pendingApprovals.properties.length === 0 ? (
              <EmptyState compact title="All clear" description="No accounts or properties waiting for review." />
            ) : null}
            {data.pendingApprovals.owners.map((owner) => (
              <Link key={owner.id} to="/admin/owners?status=PENDING" className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5 hover:bg-primary/5">
                <span className="text-[13px] font-semibold">{owner.name}</span>
                <Badge tone="amber">Owner</Badge>
              </Link>
            ))}
            {data.pendingApprovals.properties.map((property) => (
              <Link key={property.id} to="/admin/properties?status=PENDING" className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5 hover:bg-primary/5">
                <span className="truncate text-[13px] font-semibold">
                  {property.name} <span className="font-normal text-ink-muted">· {property.city}</span>
                </span>
                <Badge tone="blue">PG</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Complaint mix" subtitle="By category" />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.complaintByCategory} dataKey="count" nameKey="category" outerRadius={78} innerRadius={40} paddingAngle={2} strokeWidth={0}>
                  {data.complaintByCategory.map((entry, index) => (
                    <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.complaintByCategory.map((entry, index) => (
              <span key={entry.category} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                {entry.category} · {entry.count}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" subtitle="Latest actions across the platform" action={<Link to="/admin/logs" className="text-xs font-semibold text-primary">View all</Link>} />
          <ul className="space-y-3">
            {data.recentActivity.map((activity) => (
              <li key={activity.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/40" />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-ink-soft">{activity.description}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {activity.actorName} · {formatDate(activity.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
