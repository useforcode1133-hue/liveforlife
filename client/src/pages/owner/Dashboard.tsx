import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, ArrowUpRight } from "lucide-react";
import { api } from "../../lib/api";
import { Badge, Card, CardHeader, EmptyState, ErrorNote, PageHeader, Progress, SkeletonCards, StatTile, StatusBadge } from "../../components/ui";
import { BedIcon, BuildingIcon, ComplaintIcon, FoodIcon, RentIcon, ResidentsIcon } from "../../components/icons";
import { compactInr, formatDate, inr } from "../../lib/format";

interface OwnerDashboardData {
  stats: {
    totalPgs: number;
    totalFloors: number;
    totalRooms: number;
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    activeResidents: number;
    collected: number;
    pending: number;
    openComplaints: number;
    occupancyRate: number;
  };
  pgOccupancy: { id: string; name: string; beds: number; filled: number; vacant: number }[];
  collectionSeries: { label: string; collected: number; pending: number }[];
  pendingRent: { id: string; residentName: string; roomNumber: string; amountDue: number; amountPaid: number; status: string }[];
  recentComplaints: { id: string; title: string; category: string; status: string; urgency: string; createdAt: string; residentName: string; pgName: string }[];
  announcements: { id: string; title: string; body: string; category: string; createdAt: string }[];
  residentsAttention: { id: string; name: string; roomNumber: string; floorName: string }[];
}

const quickActions = [
  { label: "Add PG", to: "/owner/pgs?new=1", icon: <BuildingIcon size={22} /> },
  { label: "Add resident", to: "/owner/residents?new=1", icon: <ResidentsIcon size={22} /> },
  { label: "Record rent", to: "/owner/rent", icon: <RentIcon size={22} /> },
  { label: "Create menu", to: "/owner/menus", icon: <FoodIcon size={22} /> },
];

export default function OwnerDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["owner-dashboard"],
    queryFn: () => api.get<OwnerDashboardData>("/owner/dashboard"),
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Loading your PG numbers…" />
        <SkeletonCards count={4} />
      </div>
    );
  }
  if (error || !data) return <ErrorNote message="Could not load your dashboard." onRetry={() => void refetch()} />;

  const { stats } = data;

  return (
    <div>
      <section className="relative isolate overflow-hidden rounded-4xl bg-[#141928] p-6 text-white shadow-float sm:p-8">
        <span className="pointer-events-none absolute inset-0 bg-aurora opacity-90" aria-hidden />
        <span
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(circle at 25% 10%, black, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle at 25% 10%, black, transparent 70%)",
          }}
        />
        <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/[0.09] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80 ring-1 ring-inset ring-white/15">
              Owner workspace
            </span>
            <h1 className="mt-4 max-w-lg text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] !text-white sm:text-[38px]">
              Everything running{" "}
              <span className="bg-gradient-to-r from-lime via-white to-[#CBE4FF] bg-clip-text text-transparent">under one roof.</span>
            </h1>
            <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-white/70">
              Rent, beds and complaints across {stats.totalPgs} {stats.totalPgs === 1 ? "property" : "properties"} — updated as things happen.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link
                to="/owner/pgs?new=1"
                className="inline-flex items-center gap-2 rounded-2xl bg-surface px-4 py-2.5 text-[13px] font-bold text-ink shadow-[0_10px_30px_-16px_rgba(0,0,0,0.8)] transition hover:bg-surface/90"
              >
                <Plus className="h-4 w-4" /> Add a property
              </Link>
              <Link
                to="/owner/rent"
                className="inline-flex items-center gap-2 rounded-2xl bg-surface/[0.08] px-4 py-2.5 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-surface/[0.14]"
              >
                Record rent <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 rounded-3xl bg-surface/[0.06] p-4 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
            <div className="relative grid h-[92px] w-[92px] place-items-center">
              <svg viewBox="0 0 100 100" className="h-[92px] w-[92px] -rotate-90" aria-hidden>
                <defs>
                  <linearGradient id="occupancyRing" gradientUnits="userSpaceOnUse" x1="8" y1="8" x2="92" y2="92">
                    <stop offset="0%" stopColor="#D9FA64" />
                    <stop offset="100%" stopColor="#CBE4FF" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="9" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#occupancyRing)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.min(100, stats.occupancyRate) * 2.64} 264`}
                />
              </svg>
              <span className="absolute text-[20px] font-extrabold tracking-tight">{stats.occupancyRate}%</span>
            </div>
            <div className="text-[12.5px] leading-snug text-white/70">
              <p className="text-[13px] font-bold text-white">Beds filled</p>
              <p className="mt-1">
                {stats.occupiedBeds} of {stats.totalBeds} occupied
              </p>
              <p className="mt-1 text-white/55">{stats.vacantBeds} ready to fill</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Properties" value={stats.totalPgs} hint={`${stats.totalFloors} floors · ${stats.totalRooms} rooms`} icon={<BuildingIcon size={20} />} tone="purple" />
        <StatTile label="Beds occupied" value={`${stats.occupiedBeds}/${stats.totalBeds}`} hint={`${stats.vacantBeds} vacant · ${stats.occupancyRate}% full`} icon={<BedIcon size={20} />} tone="blue" />
        <StatTile label="Rent collected" value={compactInr(stats.collected)} hint={`${inr(stats.pending)} pending`} icon={<RentIcon size={20} />} tone="green" />
        <StatTile label="Open complaints" value={stats.openComplaints} hint={`${stats.activeResidents} active residents`} icon={<ComplaintIcon size={20} />} tone="coral" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="surface group flex items-center gap-3 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift hover:ring-primary/25"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition group-hover:bg-primary/15">{action.icon}</span>
            <p className="min-w-0 flex-1 text-[13px] font-bold leading-tight">{action.label}</p>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:text-primary" />
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Rent collection" subtitle="Collected and pending over six months" />
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.collectionSeries} margin={{ left: -12, right: 8 }}>
                <defs>
                  <linearGradient id="ownerCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4E65F6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4E65F6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#CBE4FF" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value: number) => inr(value)} contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }} />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#4E65F6" strokeWidth={2.5} fill="url(#ownerCollected)" />
                <Area type="monotone" dataKey="pending" name="Pending" stroke="#5B5CE6" strokeWidth={2} fill="transparent" strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Occupancy" subtitle="Beds filled per property" />
          {data.pgOccupancy.length === 0 ? (
            <EmptyState compact title="No properties yet" description="Add your first PG to see occupancy." />
          ) : (
            <div className="space-y-4">
              {data.pgOccupancy.map((pg) => (
                <div key={pg.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <Link to={`/owner/pgs/${pg.id}`} className="truncate font-semibold text-ink-soft hover:text-primary">
                      {pg.name}
                    </Link>
                    <span className="shrink-0 text-ink-muted">{pg.filled}/{pg.beds}</span>
                  </div>
                  <Progress value={pg.beds ? (pg.filled / pg.beds) * 100 : 0} tone={pg.vacant === 0 ? "coral" : "green"} />
                  <p className="mt-1 text-[11px] text-ink-muted">{pg.vacant} beds available</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pending rent" subtitle="This month" action={<Link to="/owner/rent" className="text-xs font-semibold text-primary">Open rent</Link>} />
          {data.pendingRent.length === 0 ? (
            <EmptyState compact title="Nothing pending" description="Every rent record for this month is settled." />
          ) : (
            <ul className="divide-y divide-ink/5">
              {data.pendingRent.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{row.residentName}</p>
                    <p className="text-[11px] text-ink-muted">Room {row.roomNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold">{inr(row.amountDue - row.amountPaid)}</p>
                    <StatusBadge status={row.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent complaints" subtitle="Latest from your residents" action={<Link to="/owner/complaints" className="text-xs font-semibold text-primary">View all</Link>} />
          {data.recentComplaints.length === 0 ? (
            <EmptyState compact title="No complaints" description="Your residents have not reported any issues." />
          ) : (
            <ul className="space-y-3">
              {data.recentComplaints.slice(0, 4).map((complaint) => (
                <li key={complaint.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{complaint.title}</p>
                    <p className="text-[11px] text-ink-muted">
                      {complaint.residentName} · {complaint.pgName} · {formatDate(complaint.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={complaint.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent announcements" subtitle="What you told residents" action={<Link to="/owner/announcements" className="text-xs font-semibold text-primary">New</Link>} />
          {data.announcements.length === 0 ? (
            <EmptyState compact title="No announcements yet" description="Send a notice to residents in a few taps." />
          ) : (
            <ul className="space-y-3">
              {data.announcements.map((announcement) => (
                <li key={announcement.id}>
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold">{announcement.title}</p>
                    <Badge tone="purple">{announcement.category}</Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-muted">{announcement.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Residents" subtitle="Everyone currently staying" action={<Link to="/owner/residents" className="text-xs font-semibold text-primary">Manage</Link>} />
          {data.residentsAttention.length === 0 ? (
            <EmptyState compact title="No active residents" description="Invite someone to fill your first bed." />
          ) : (
            <ul className="divide-y divide-ink/5">
              {data.residentsAttention.map((resident) => (
                <li key={resident.id} className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] font-semibold">{resident.name}</span>
                  <span className="text-[11px] text-ink-muted">
                    {resident.floorName} · Room {resident.roomNumber}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
