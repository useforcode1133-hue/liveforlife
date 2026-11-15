import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Copy, KeyRound } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Progress,
  Skeleton,
  StatusBadge,
  useToast,
} from "../../components/ui";
import {
  AnnouncementIcon,
  BedIcon,
  BuildingIcon,
  ComplaintIcon,
  FoodIcon,
  RentIcon,
  RoomIcon,
  WifiIcon,
} from "../../components/icons";
import { formatDate, inr } from "../../lib/format";
import { useAuth } from "../../lib/auth";

interface DashboardData {
  residency: null | {
    id: string;
    status: string;
    monthlyRent: number;
    joinedAt: string | null;
    roomNumber: string;
    floorName: string;
    bedLabel: string | null;
    pg: { id: string; name: string; type: string; city: string; image: string | null; wifiName: string | null; wifiPassword: string | null };
  };
  invitations?: { id: string; code: string; pgName: string }[];
  rent?: null | { id: string; periodMonth: string; amountDue: number; amountPaid: number; balance: number; dueDate: string; status: string };
  todayMenu?: null | { date: string; note: string | null; meals: Record<string, string[]> };
  announcements?: { id: string; title: string; body: string; category: string; createdAt: string }[];
  openComplaints?: { id: string; title: string; status: string; category: string }[];
  unreadNotifications?: number;
  roommates?: { name: string; bedLabel: string | null }[];
  currentMonthLabel?: string;
}

const quickLinks = [
  { label: "Food menu", to: "/resident/food", icon: <FoodIcon size={24} />, tone: "bg-sun/20" },
  { label: "Wi-Fi", to: "/resident/wifi", icon: <WifiIcon size={24} />, tone: "bg-ocean/10" },
  { label: "Rent", to: "/resident/rent", icon: <RentIcon size={24} />, tone: "bg-mint/20" },
  { label: "Report issue", to: "/resident/complaints", icon: <ComplaintIcon size={24} />, tone: "bg-coral/15" },
];

export default function ResidentDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["resident-dashboard"],
    queryFn: () => api.get<DashboardData>("/resident/dashboard"),
  });

  const accept = useMutation({
    mutationFn: () => api.post<{ message: string }>("/resident/invitations/accept", { code: code.trim() }),
    onSuccess: async (result) => {
      toast.push(result.message);
      await queryClient.invalidateQueries({ queryKey: ["resident-dashboard"] });
      navigate("/resident", { replace: true });
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not accept this code.", "error"),
  });

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-28 w-full" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }
  if (error || !data) return <ErrorNote message="Could not load your dashboard." onRetry={() => void refetch()} />;

  if (!data.residency) {
    return (
      <div>
        <PageHeader eyebrow="Resident" title={`Welcome, ${user?.name.split(" ")[0]}`} subtitle="You are not part of a PG yet." />
        <Card className="max-w-lg">
          <CardHeader title="Join a PG" subtitle="Enter the invitation code your PG owner shared with you." icon={<BuildingIcon size={22} />} />
          <div className="space-y-3">
            <Field label="Invitation code">
              <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="e.g. SUNRISE7" />
            </Field>
            <Button full loading={accept.isPending} onClick={() => accept.mutate()} disabled={code.trim().length < 3}>
              Accept invitation
            </Button>
          </div>
          {data.invitations?.length ? (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Pending invitations</p>
              <ul className="space-y-2">
                {data.invitations.map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2">
                    <span className="text-[13px] font-semibold">{invitation.pgName}</span>
                    <button className="text-[12px] font-semibold text-primary" onClick={() => setCode(invitation.code)}>
                      Use {invitation.code}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-4 text-[12px] text-ink-muted">
            Have an invite link? Open it directly, or join with the code above.
          </p>
        </Card>
      </div>
    );
  }

  const { residency, rent } = data;
  const meals = data.todayMenu?.meals;
  const paidPercent = rent ? Math.min(100, Math.round((rent.amountPaid / Math.max(rent.amountDue, 1)) * 100)) : 0;

  return (
    <div>
      <div className="relative mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[#5B5CE6] to-ocean p-5 text-white sm:p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wider text-white/70">Welcome back</p>
            <h1 className="mt-0.5 text-2xl font-extrabold">{user?.name.split(" ")[0]}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-white/85">
              <BuildingIcon size={16} /> {residency.pg.name} · Room {residency.roomNumber} · {residency.floorName}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
            <div>
              <p className="text-[11px] text-white/70">This month's rent</p>
              <p className="text-lg font-extrabold">{inr(rent?.amountDue ?? residency.monthlyRent)}</p>
            </div>
            <StatusBadge status={rent?.status ?? "PENDING"} />
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickLinks.map((link) => (
          <Link key={link.label} to={link.to} className="surface flex flex-col gap-2 p-4 transition hover:shadow-lift">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${link.tone}`}>{link.icon}</span>
            <span className="text-[13px] font-bold">{link.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Today's food menu"
            subtitle={data.todayMenu ? formatDate(data.todayMenu.date) : "No menu published for today"}
            icon={<FoodIcon size={22} />}
            action={<Link to="/resident/food" className="text-xs font-semibold text-primary">Full week</Link>}
          />
          {meals ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "BREAKFAST", label: "Breakfast" },
                { key: "LUNCH", label: "Lunch" },
                { key: "SNACKS", label: "Snacks" },
                { key: "DINNER", label: "Dinner" },
              ].map((meal) => (
                <div key={meal.key} className="rounded-xl bg-canvas p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{meal.label}</p>
                  <p className="mt-1 text-[13px] leading-snug text-ink-soft">
                    {meals[meal.key]?.length ? meals[meal.key].join(", ") : "Not published"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact title="Menu not posted yet" description="Your owner will publish today's meals soon." />
          )}
          {data.todayMenu?.note ? <p className="mt-3 rounded-xl bg-sun/15 px-3 py-2 text-[12px] text-[#141928]">{data.todayMenu.note}</p> : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Your room" subtitle={`Bed ${residency.bedLabel ?? "—"}`} icon={<RoomIcon size={22} />} />
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Room</span>
                <span className="font-semibold">{residency.roomNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Floor</span>
                <span className="font-semibold">{residency.floorName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Joined</span>
                <span className="font-semibold">{formatDate(residency.joinedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Status</span>
                <StatusBadge status={residency.status} />
              </div>
            </div>
            {data.roommates?.length ? (
              <div className="mt-3 border-t border-ink/5 pt-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  <BedIcon size={14} /> Roommates
                </p>
                <p className="text-[13px] text-ink-soft">{data.roommates.map((mate) => mate.name).join(", ")}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Wi-Fi" subtitle={residency.pg.wifiName ?? "Not configured"} icon={<WifiIcon size={22} />} />
            {residency.pg.wifiPassword ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5">
                <span className="font-mono text-sm font-bold">{residency.pg.wifiPassword}</span>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(residency.pg.wifiPassword ?? "");
                    toast.push("Wi-Fi password copied.");
                  }}
                  className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-primary shadow-sm"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            ) : (
              <p className="text-[13px] text-ink-muted">Your owner has not shared the password yet.</p>
            )}
            <Link to="/resident/wifi" className="mt-3 flex items-center gap-1 text-[12px] font-semibold text-primary">
              Connection instructions <ArrowRight className="h-3 w-3" />
            </Link>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Latest announcement"
            subtitle="From your PG owner"
            icon={<AnnouncementIcon size={22} />}
            action={<Link to="/resident/announcements" className="text-xs font-semibold text-primary">All notices</Link>}
          />
          {data.announcements?.length ? (
            <div className="space-y-3">
              {data.announcements.slice(0, 2).map((announcement) => (
                <div key={announcement.id} className="rounded-xl bg-canvas p-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold">{announcement.title}</p>
                    <Badge tone="purple">{announcement.category}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] text-ink-soft">{announcement.body}</p>
                  <p className="mt-1 text-[10px] text-ink-muted">{formatDate(announcement.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact title="No announcements" description="Notices from your PG will appear here." />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Your open issues"
            subtitle="Track progress in one place"
            icon={<ComplaintIcon size={22} />}
            action={<Link to="/resident/complaints" className="text-xs font-semibold text-primary">Report new</Link>}
          />
          {data.openComplaints?.length ? (
            <ul className="divide-y divide-ink/5">
              {data.openComplaints.map((complaint) => (
                <li key={complaint.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{complaint.title}</p>
                    <p className="text-[11px] text-ink-muted">{complaint.category}</p>
                  </div>
                  <StatusBadge status={complaint.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No open issues" description="Something not working? Report it in a few taps." action={<Link to="/resident/complaints" className="text-[12px] font-semibold text-primary">Report an issue</Link>} />
          )}
        </Card>
      </div>

      {rent ? (
        <Card className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-bold">{data.currentMonthLabel} rent</p>
              <p className="text-[12px] text-ink-muted">
                {rent.balance > 0 ? `${inr(rent.balance)} pending · due ${formatDate(rent.dueDate)}` : "Fully paid. Thank you."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32">
                <Progress value={paidPercent} tone={paidPercent === 100 ? "green" : "amber"} />
              </div>
              <Link to="/resident/rent" className="text-[12px] font-semibold text-primary">
                <span className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> Payment history</span>
              </Link>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
