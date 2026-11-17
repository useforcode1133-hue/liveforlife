import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Menu, X, CheckCheck, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Badge, Button, cn, EmptyState, statusLabel, ThemeToggle } from "./ui";
import { BuildingScene, LogoMark } from "./icons";
import { relativeTime } from "../lib/format";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const notificationsPath =
    user?.role === "SUPER_ADMIN" ? "/admin/notifications" : user?.role === "PG_OWNER" ? "/owner/notifications" : "/resident/notifications";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ notifications: NotificationRow[]; unread: number }>("/notifications"),
    enabled: open,
  });

  const markAll = async () => {
    await api.post("/notifications/read-all");
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const openNotification = async (notification: NotificationRow) => {
    if (!notification.readAt) {
      await api.post(`/notifications/${notification.id}/read`);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    onClose();
    if (notification.link) navigate(notification.link);
  };

  if (!open) return null;

  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default" onClick={onClose} aria-label="Close notifications" tabIndex={-1} />
      <div className="fixed inset-x-3 top-16 z-50 max-h-[75vh] overflow-hidden rounded-2xl bg-surface shadow-lift ring-1 ring-ink/[0.08] animate-pop-in sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]">
        <div className="flex items-center justify-between border-b border-ink/5 px-4 py-3">
          <div>
            <p className="text-sm font-bold">Notifications</p>
            <p className="text-xs text-ink-muted">{data ? `${data.unread} unread` : "Loading…"}</p>
          </div>
          <button onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-primary">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((index) => (
                <div key={index} className="skeleton h-14 w-full" />
              ))}
            </div>
          ) : !data?.notifications.length ? (
            <div className="p-4">
              <EmptyState compact title="Nothing new" description="Rent reminders, announcements and updates will appear here." />
            </div>
          ) : (
            data.notifications.slice(0, 12).map((notification) => (
              <button
                key={notification.id}
                onClick={() => void openNotification(notification)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-ink/5 px-4 py-3 text-left transition last:border-0 hover:bg-canvas",
                  !notification.readAt && "bg-primary/[0.03]"
                )}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", notification.readAt ? "bg-ink/15" : "bg-primary")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{notification.title}</span>
                  <span className="mt-0.5 block line-clamp-2 text-xs text-ink-muted">{notification.body}</span>
                  <span className="mt-1 block text-[11px] text-ink-muted">{relativeTime(notification.createdAt)}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-ink/5 p-2">
          <Link
            to={notificationsPath}
            onClick={onClose}
            className="flex items-center justify-center gap-1 rounded-lg py-2 text-[13px] font-semibold text-primary hover:bg-primary/5"
          >
            View all notifications <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </>
  );
}

export function AppShell({ nav, children }: { nav: NavItem[]; children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ notifications: NotificationRow[]; unread: number }>("/notifications"),
    refetchInterval: 60000,
  });

  useEffect(() => {
    setMobileNavOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const primaryNav = nav.slice(0, 4);
  const secondaryNav = nav.slice(4);
  const roleLabel = user.role === "SUPER_ADMIN" ? "Administrator" : user.role === "PG_OWNER" ? "PG owner" : "Resident";
  const accountPath =
    user.role === "RESIDENT" ? "/resident/profile" : user.role === "SUPER_ADMIN" ? "/admin/settings" : "/owner/settings";

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-[248px] flex-col overflow-hidden rounded-3xl bg-surface/85 shadow-float ring-1 ring-ink/[0.06] backdrop-blur-xl lg:flex">
        <span className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <span className="pointer-events-none absolute -left-16 bottom-10 h-40 w-40 rounded-full bg-teal/15 blur-3xl" aria-hidden />
        <div className="relative mx-3 mt-4 flex items-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/[0.10] via-surface to-ocean/[0.08] px-3.5 py-3.5 ring-1 ring-inset ring-ink/[0.06]">
          <span className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-primary/15 blur-2xl" aria-hidden />
          <LogoMark size={34} />
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold leading-none tracking-tight">PG Manager</p>
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">{roleLabel}</p>
          </div>
        </div>
        <p className="px-5 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted/70">Menu</p>
        <nav className="flex-1 space-y-0.5 px-3 py-1" aria-label="Main navigation">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition",
                  isActive
                    ? "bg-surface text-primary shadow-[0_1px_2px_rgba(20,25,40,0.05),0_8px_18px_-14px_rgba(20,25,40,0.4)] ring-1 ring-inset ring-primary/15"
                    : "text-ink-soft hover:bg-surface/70 hover:text-ink"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition",
                      isActive ? "bg-primary opacity-100" : "opacity-0"
                    )}
                    aria-hidden
                  />
                  {item.icon}
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink/5 p-3">
          <Link to={accountPath} className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-canvas">
            <Avatar name={user.name} src={user.avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold">{user.name}</p>
              <p className="truncate text-[11px] text-ink-muted">{user.email}</p>
            </div>
          </Link>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-muted transition hover:bg-danger/5 hover:text-danger"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-20 border-b border-ink/[0.05] bg-canvas/75 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <LogoMark size={32} />
              <span className="text-[15px] font-extrabold">PG Manager</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen((open) => !open)}
                  className="relative rounded-xl bg-surface p-2.5 text-ink-soft shadow-[0_1px_2px_rgba(20,25,40,0.05)] ring-1 ring-inset ring-ink/[0.08] transition hover:text-primary hover:ring-primary/30"
                  aria-label="Notifications"
                  aria-expanded={notificationsOpen}
                >
                  <Bell className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                  {notifications && notifications.unread > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
                      {notifications.unread > 9 ? "9+" : notifications.unread}
                    </span>
                  ) : null}
                </button>
                <NotificationPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
              </div>
              <Link
                to={accountPath}
                className="hidden items-center gap-2 rounded-xl bg-surface px-3 py-1.5 shadow-[0_1px_2px_rgba(20,25,40,0.05)] ring-1 ring-inset ring-ink/[0.08] transition hover:ring-primary/25 sm:flex"
              >
                <Avatar name={user.name} src={user.avatarUrl} size={28} />
                <span className="max-w-[120px] truncate text-[13px] font-semibold">{user.name.split(" ")[0]}</span>
              </Link>
              <button
                onClick={() => setMobileNavOpen(true)}
                className="rounded-xl bg-surface p-2.5 text-ink-soft shadow-[0_1px_2px_rgba(20,25,40,0.05)] ring-1 ring-inset ring-ink/[0.08] lg:hidden"
                aria-label="Open menu"
              >
                <Menu style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>
        </header>

        <main key={location.pathname} className="mx-auto w-full max-w-6xl animate-fade-up px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:pb-12">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-3 bottom-3 z-30 rounded-2xl bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-float ring-1 ring-ink/[0.06] backdrop-blur-xl lg:hidden"
        aria-label="Primary"
      >
        <div className="flex items-stretch justify-around px-1">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition",
                  isActive ? "text-primary" : "text-ink-muted"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute top-0 h-[3px] w-8 rounded-b-full transition",
                      isActive ? "bg-primary opacity-100" : "opacity-0"
                    )}
                    aria-hidden
                  />
                  {item.icon}
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold text-ink-muted"
          >
            <Menu style={{ width: 22, height: 22 }} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-ink/40" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" tabIndex={-1} />
          <div className="absolute inset-y-0 right-0 w-[82%] max-w-sm overflow-y-auto rounded-l-3xl bg-surface p-5 shadow-lift animate-slide-in">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar name={user.name} src={user.avatarUrl} size={40} />
                <div>
                  <p className="text-sm font-bold">{user.name}</p>
                  <Badge tone="purple">{statusLabel(user.role)}</Badge>
                </div>
              </div>
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close" className="rounded-lg p-2 text-ink-muted hover:bg-ink/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold",
                      isActive ? "bg-primary/10 text-primary" : "text-ink-soft"
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
              {secondaryNav.length ? null : null}
            </div>
            <Button variant="secondary" full className="mt-6" icon={<LogOut className="h-4 w-4" />} onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      <div className="relative hidden w-[48%] flex-col justify-between overflow-hidden bg-[#4E65F6] p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-mesh" aria-hidden />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(circle at 30% 20%, black, transparent 72%)",
            WebkitMaskImage: "radial-gradient(circle at 30% 20%, black, transparent 72%)",
          }}
          aria-hidden
        />
        <div className="relative z-10 flex items-center gap-3">
          <LogoMark size={38} />
          <span className="text-[17px] font-extrabold tracking-tight">PG Manager</span>
        </div>
        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/90 ring-1 ring-inset ring-white/20 backdrop-blur-sm">
            For owners and residents
          </span>
          <h2 className="mt-5 text-[32px] font-extrabold leading-[1.16] tracking-[-0.02em] !text-white">
            Every room, every rupee, every resident — in one calm place.
          </h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-white/75">
            Owners run the PG, residents stay informed, and nothing falls through the gaps. Rent, food menus,
            Wi-Fi details and complaints live together.
          </p>
          <ul className="mt-7 space-y-2.5 text-[13.5px] text-white/85">
            {[
              "Bed-level occupancy that never double-books",
              "Rent tracking with partial payments and reminders",
              "Complaints that actually get tracked to resolved",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <CheckCheck className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 mt-6 flex justify-end">
          <BuildingScene className="h-[168px] w-[300px] max-w-full opacity-95" />
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-10">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle withLabel />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
