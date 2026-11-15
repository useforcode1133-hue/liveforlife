import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { AuthShell } from "../../components/layouts";
import { Badge, Button, Card, ErrorNote, Field, Input, Skeleton, useToast } from "../../components/ui";
import { BedIcon, BuildingIcon, FloorsIcon, LogoMark, RoomIcon } from "../../components/icons";
import { formatDate, inr } from "../../lib/format";

interface InvitationPreview {
  code: string;
  status: string;
  expiresAt: string;
  email: string | null;
  monthlyRent: number;
  pg: { name: string; type: string; city: string; state: string; image: string | null };
  ownerName: string;
  roomNumber: string | null;
  floorName: string | null;
  bedLabel: string | null;
}

export default function JoinPage() {
  const { code = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualCode, setManualCode] = useState(code);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<{ invitation: InvitationPreview }>(`/resident/public-invitation/${code}`)
      .then((data) => {
        if (active) setPreview(data.invitation);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError instanceof ApiError ? fetchError.message : "Could not load this invitation.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code]);

  const accept = async () => {
    setAccepting(true);
    try {
      const result = await api.post<{ message: string }>("/resident/invitations/accept", { code });
      toast.push(result.message);
      navigate("/resident", { replace: true });
    } catch (acceptError) {
      toast.push(acceptError instanceof ApiError ? acceptError.message : "Could not accept the invitation.", "error");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-6 flex items-center gap-3 lg:hidden">
        <LogoMark size={36} />
        <span className="text-lg font-extrabold">PG Manager</span>
      </div>

      {loading || authLoading ? (
        <Card className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </Card>
      ) : error || !preview ? (
        <div className="space-y-4">
          <ErrorNote message={error ?? "This invitation could not be found."} />
          <Card>
            <p className="text-sm font-bold">Have an invite code?</p>
            <p className="mt-1 text-[13px] text-ink-muted">Enter it below after signing in to your resident account.</p>
            <Field className="mt-3" label="Invitation code">
              <Input value={manualCode} onChange={(event) => setManualCode(event.target.value.toUpperCase())} placeholder="e.g. SUNRISE7" />
            </Field>
            <Button className="mt-3" full onClick={() => navigate(`/join/${manualCode.trim()}`)} disabled={!manualCode.trim()}>
              Look up invitation
            </Button>
          </Card>
        </div>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="relative h-32 bg-gradient-to-br from-primary to-ocean">
              {preview.pg.image ? <img src={preview.pg.image} alt="" className="h-full w-full object-cover opacity-90" /> : null}
              <div className="absolute inset-x-4 bottom-3 flex items-end justify-between">
                <div className="rounded-xl bg-white/95 px-3 py-2 backdrop-blur">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Invitation</p>
                  <p className="text-sm font-extrabold">{preview.pg.name}</p>
                </div>
                <Badge tone={preview.status === "PENDING" ? "amber" : "gray"}>{preview.status === "PENDING" ? "Open" : preview.status}</Badge>
              </div>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-[13px] text-ink-muted">
                {preview.pg.city}, {preview.pg.state} · {preview.ownerName} invited you
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: <FloorsIcon size={20} />, label: "Floor", value: preview.floorName ?? "—" },
                  { icon: <RoomIcon size={20} />, label: "Room", value: preview.roomNumber ?? "—" },
                  { icon: <BedIcon size={20} />, label: "Bed", value: preview.bedLabel ?? "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-canvas p-3">
                    <span className="mb-1 block">{item.icon}</span>
                    <p className="text-[11px] text-ink-muted">{item.label}</p>
                    <p className="text-sm font-bold">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3">
                <span className="text-[13px] font-semibold text-ink-soft">Monthly rent</span>
                <span className="text-lg font-extrabold text-primary">{inr(preview.monthlyRent)}</span>
              </div>
              <p className="text-xs text-ink-muted">Invitation valid until {formatDate(preview.expiresAt)}.</p>
            </div>
          </Card>

          {preview.status !== "PENDING" ? (
            <p className="mt-4 rounded-xl bg-sun/15 px-4 py-3 text-[13px] text-[#141928]">
              This invitation is no longer open. Ask the PG owner to send a new one.
            </p>
          ) : user ? (
            user.role === "RESIDENT" ? (
              <Button className="mt-4" full size="lg" loading={accepting} onClick={accept}>
                Accept and join {preview.pg.name}
              </Button>
            ) : (
              <p className="mt-4 rounded-xl bg-sun/15 px-4 py-3 text-[13px] text-[#141928]">
                You are signed in as an {user.role === "SUPER_ADMIN" ? "administrator" : "owner"}. Sign in with a resident
                account to accept this invitation.
              </p>
            )
          ) : (
            <div className="mt-4 space-y-2">
              <p className="rounded-xl bg-canvas px-4 py-3 text-[13px] text-ink-soft">
                Sign in or create a free resident account to accept. Keep this invitation code: <strong>{preview.code}</strong>
              </p>
              <Button full size="lg" onClick={() => navigate(`/register?next=/join/${preview.code}`)}>
                Create a resident account
              </Button>
              <Button full variant="secondary" onClick={() => navigate(`/login?next=/join/${preview.code}`)}>
                I already have an account
              </Button>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-ink-muted">
            <Link to="/" className="font-semibold text-primary hover:underline">
              Go to PG Manager
            </Link>
          </p>
        </>
      )}

      {!preview && !loading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
          <BuildingIcon size={16} /> Invitations are created by the PG owner.
        </div>
      ) : null}
    </AuthShell>
  );
}
