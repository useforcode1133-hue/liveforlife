import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth, homeForRole, type Role } from "./lib/auth";
import { AppShell, type NavItem } from "./components/layouts";
import {
  AnnouncementIcon,
  BedIcon,
  BellIcon,
  BuildingIcon,
  ComplaintIcon,
  FoodIcon,
  HomeIcon,
  PaymentsIcon,
  ProfileIcon,
  RentIcon,
  ResidentsIcon,
  SettingsIcon,
  SparkIcon,
  WifiIcon,
} from "./components/icons";
import { LogoMark } from "./components/icons";

import LoginPage from "./pages/auth/Login";
import RegisterPage from "./pages/auth/Register";
import ForgotPasswordPage from "./pages/auth/ForgotPassword";
import OwnerPendingPage from "./pages/auth/OwnerPending";
import JoinPage from "./pages/auth/Join";
import NotificationsPage from "./pages/Notifications";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminOwners from "./pages/admin/Owners";
import AdminProperties from "./pages/admin/Properties";
import AdminResidents from "./pages/admin/Residents";
import AdminComplaints from "./pages/admin/Complaints";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminAudit from "./pages/admin/Audit";
import AdminSettings from "./pages/admin/Settings";

import OwnerDashboard from "./pages/owner/Dashboard";
import OwnerPgs from "./pages/owner/Pgs";
import OwnerPgDetail from "./pages/owner/PgDetail";
import OwnerResidents from "./pages/owner/Residents";
import OwnerRent from "./pages/owner/Rent";
import OwnerMenus from "./pages/owner/Menus";
import OwnerComplaints from "./pages/owner/Complaints";
import OwnerAnnouncements from "./pages/owner/Announcements";
import OwnerSettings from "./pages/owner/Settings";

import ResidentDashboard from "./pages/resident/Dashboard";
import ResidentMyPg from "./pages/resident/MyPg";
import ResidentFood from "./pages/resident/Food";
import ResidentRent from "./pages/resident/Rent";
import ResidentComplaints from "./pages/resident/Complaints";
import ResidentAnnouncements from "./pages/resident/Announcements";
import ResidentHistory from "./pages/resident/History";
import ResidentProfile from "./pages/resident/Profile";

const icon = (node: React.ReactNode, size = 20) => (
  <span className="[&>svg]:h-5 [&>svg]:w-5" style={{ width: size, height: size }}>
    {node}
  </span>
);

const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: icon(<HomeIcon />), end: true },
  { to: "/admin/owners", label: "PG Owners", icon: icon(<ResidentsIcon />) },
  { to: "/admin/properties", label: "Properties", icon: icon(<BuildingIcon />) },
  { to: "/admin/residents", label: "Residents", icon: icon(<BedIcon />) },
  { to: "/admin/complaints", label: "Complaints", icon: icon(<ComplaintIcon />) },
  { to: "/admin/analytics", label: "Analytics", icon: icon(<SparkIcon />) },
  { to: "/admin/logs", label: "Activity logs", icon: icon(<PaymentsIcon />) },
  { to: "/admin/settings", label: "Settings", icon: icon(<SettingsIcon />) },
];

const ownerNav: NavItem[] = [
  { to: "/owner", label: "Dashboard", icon: icon(<HomeIcon />), end: true },
  { to: "/owner/pgs", label: "My PGs", icon: icon(<BuildingIcon />) },
  { to: "/owner/residents", label: "Residents", icon: icon(<ResidentsIcon />) },
  { to: "/owner/rent", label: "Rent", icon: icon(<RentIcon />) },
  { to: "/owner/menus", label: "Food menu", icon: icon(<FoodIcon />) },
  { to: "/owner/complaints", label: "Complaints", icon: icon(<ComplaintIcon />) },
  { to: "/owner/announcements", label: "Announcements", icon: icon(<AnnouncementIcon />) },
  { to: "/owner/notifications", label: "Notifications", icon: icon(<BellIcon />) },
  { to: "/owner/settings", label: "Settings", icon: icon(<SettingsIcon />) },
];

const residentNav: NavItem[] = [
  { to: "/resident", label: "Home", icon: icon(<HomeIcon />), end: true },
  { to: "/resident/pg", label: "My PG", icon: icon(<BuildingIcon />) },
  { to: "/resident/food", label: "Food", icon: icon(<FoodIcon />) },
  { to: "/resident/rent", label: "Rent", icon: icon(<RentIcon />) },
  { to: "/resident/complaints", label: "Issues", icon: icon(<ComplaintIcon />) },
  { to: "/resident/announcements", label: "Notices", icon: icon(<AnnouncementIcon />) },
  { to: "/resident/wifi", label: "Wi-Fi", icon: icon(<WifiIcon />) },
  { to: "/resident/notifications", label: "Notifications", icon: icon(<BellIcon />) },
  { to: "/resident/profile", label: "Profile", icon: icon(<ProfileIcon />) },
];

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <LogoMark size={48} />
        <p className="text-sm font-semibold text-ink-muted">Getting things ready…</p>
      </div>
    </div>
  );
}

function RoleLayout({ role, nav }: { role: Role; nav: NavItem[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={homeForRole(user.role)} replace />;
  if (role === "PG_OWNER" && user.status !== "ACTIVE") return <Navigate to="/owner/pending" replace />;

  return (
    <AppShell nav={nav}>
      <Outlet />
    </AppShell>
  );
}

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "PG_OWNER" && user.status !== "ACTIVE") return <Navigate to="/owner/pending" replace />;
  return <Navigate to={homeForRole(user.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route
        path="/owner/pending"
        element={
          <RequireAuth roles={["PG_OWNER"]}>
            <OwnerPendingPage />
          </RequireAuth>
        }
      />

      <Route path="/admin" element={<RoleLayout role="SUPER_ADMIN" nav={adminNav} />}>
        <Route index element={<AdminDashboard />} />
        <Route path="owners" element={<AdminOwners />} />
        <Route path="properties" element={<AdminProperties />} />
        <Route path="residents" element={<AdminResidents />} />
        <Route path="complaints" element={<AdminComplaints />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="logs" element={<AdminAudit />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="/owner" element={<RoleLayout role="PG_OWNER" nav={ownerNav} />}>
        <Route index element={<OwnerDashboard />} />
        <Route path="pgs" element={<OwnerPgs />} />
        <Route path="pgs/:id" element={<OwnerPgDetail />} />
        <Route path="residents" element={<OwnerResidents />} />
        <Route path="rent" element={<OwnerRent />} />
        <Route path="menus" element={<OwnerMenus />} />
        <Route path="complaints" element={<OwnerComplaints />} />
        <Route path="announcements" element={<OwnerAnnouncements />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<OwnerSettings />} />
      </Route>

      <Route path="/resident" element={<RoleLayout role="RESIDENT" nav={residentNav} />}>
        <Route index element={<ResidentDashboard />} />
        <Route path="pg" element={<ResidentMyPg />} />
        <Route path="food" element={<ResidentFood />} />
        <Route path="rent" element={<ResidentRent />} />
        <Route path="complaints" element={<ResidentComplaints />} />
        <Route path="announcements" element={<ResidentAnnouncements />} />
        <Route path="wifi" element={<ResidentMyPg initialSection="wifi" />} />
        <Route path="history" element={<ResidentHistory />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ResidentProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
