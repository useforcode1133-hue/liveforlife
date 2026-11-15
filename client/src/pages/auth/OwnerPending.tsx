import { useState } from "react";
import { useAuth } from "../../lib/auth";
import { LogoMark, BuildingIcon, CheckInIcon } from "../../components/icons";
import { Button, Badge, Card } from "../../components/ui";

export default function OwnerPendingPage() {
  const { user, logout, refresh } = useAuth();
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark size={36} />
          <span className="text-lg font-extrabold">PG Manager</span>
        </div>
        <Card className="p-6 sm:p-8">
          <div className="mb-5 flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sun/20">
              <CheckInIcon size={30} />
            </span>
            <div>
              <Badge tone={user?.status === "REJECTED" ? "red" : "amber"}>
                {user?.status === "REJECTED" ? "Not approved" : "Awaiting approval"}
              </Badge>
              <h1 className="mt-2 text-xl font-extrabold">
                {user?.status === "REJECTED" ? "Your account was not approved" : "Your owner account is under review"}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {user?.status === "REJECTED"
                  ? "An administrator reviewed this account and did not approve it. Contact support if you think this is a mistake."
                  : "An administrator will verify your account before your properties go live. This usually takes less than a day."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-canvas p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-soft">
                <BuildingIcon size={22} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{user?.name}</p>
                <p className="truncate text-xs text-ink-muted">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button onClick={checkStatus} loading={checking} full>
              Check status
            </Button>
            <Button variant="secondary" onClick={logout} full>
              Sign out
            </Button>
          </div>
        </Card>
        <p className="mt-4 text-center text-xs text-ink-muted">
          You will also receive a notification as soon as your account is approved.
        </p>
      </div>
    </div>
  );
}
