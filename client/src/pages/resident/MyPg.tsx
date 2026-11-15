import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Phone } from "lucide-react";
import { api } from "../../lib/api";
import { Badge, Card, CardHeader, EmptyState, ErrorNote, InfoRow, PageHeader, Skeleton, StatusBadge, Tabs, useToast } from "../../components/ui";
import { BuildingIcon, FloorsIcon, RoomIcon, SecurityIcon, WifiIcon } from "../../components/icons";
import { formatDate, inr } from "../../lib/format";

interface MyPgData {
  pg: {
    name: string;
    type: string;
    description: string | null;
    address: string;
    city: string;
    state: string;
    pincode: string;
    facilities: string[];
    houseRules: string | null;
    checkInRules: string | null;
    checkOutRules: string | null;
    emergencyName: string | null;
    emergencyPhone: string | null;
    wifiName: string | null;
    wifiPassword: string | null;
    wifiInstructions: string | null;
    waterTimings: string | null;
    laundryTimings: string | null;
    cleaningSchedule: string | null;
    electricityInfo: string | null;
    visitorRules: string | null;
    commonAreaRules: string | null;
    notice: string | null;
  };
  residency: {
    status: string;
    floorName: string;
    roomNumber: string;
    bedLabel: string | null;
    monthlyRent: number;
    securityDeposit: number;
    joinedAt: string | null;
    roomType: string;
    amenities: string[];
  };
  roommates: { id: string; name: string; bedLabel: string | null; isMe: boolean }[];
  owner: { name: string; email: string; phone: string | null } | null;
}

type Section = "details" | "wifi" | "rules" | "roommates";

export default function ResidentMyPg({ initialSection = "details" }: { initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection);
  const toast = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["resident-pg"],
    queryFn: () => api.get<MyPgData>("/resident/pg"),
  });

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (error || !data) return <ErrorNote message="You are not part of a PG right now." onRetry={() => void refetch()} />;

  const { pg, residency, owner } = data;

  return (
    <div>
      <PageHeader
        title={pg.name}
        subtitle={`${pg.address}, ${pg.city}, ${pg.state} ${pg.pincode}`}
        actions={<StatusBadge status={residency.status} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><FloorsIcon size={22} /></span>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Floor</p>
            <p className="text-sm font-bold">{residency.floorName}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ocean/10"><RoomIcon size={22} /></span>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Room · Bed</p>
            <p className="text-sm font-bold">{residency.roomNumber} · {residency.bedLabel ?? "—"}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint/20"><BuildingIcon size={22} /></span>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Monthly rent</p>
            <p className="text-sm font-bold">{inr(residency.monthlyRent)}</p>
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { value: "details", label: "PG details" },
          { value: "wifi", label: "Wi-Fi" },
          { value: "rules", label: "Rules & timings" },
          { value: "roommates", label: "Roommates" },
        ]}
        value={section}
        onChange={setSection}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {section === "details" ? (
          <>
            <Card>
              <CardHeader title="About" subtitle={pg.type === "BOYS" ? "Boys PG" : pg.type === "GIRLS" ? "Girls PG" : "Co-living"} />
              <p className="text-[13px] leading-relaxed text-ink-soft">{pg.description || "No description added by the owner."}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pg.facilities.map((facility) => <Badge key={facility} tone="blue">{facility}</Badge>)}
              </div>
            </Card>
            <Card>
              <CardHeader title="Your stay" subtitle={`Joined ${formatDate(residency.joinedAt)}`} />
              <InfoRow label="Deposit" value={inr(residency.securityDeposit)} />
              <InfoRow label="Room type" value={residency.roomType.toLowerCase()} />
              <InfoRow label="Room amenities" value={residency.amenities.join(", ") || "—"} />
              <InfoRow label="Owner" value={owner ? `${owner.name} · ${owner.phone ?? owner.email}` : "—"} />
              {pg.emergencyName ? (
                <a href={`tel:${pg.emergencyPhone ?? ""}`} className="mt-3 flex items-center gap-2 rounded-xl bg-danger/5 px-3 py-2 text-[13px] font-semibold text-[#141928]">
                  <Phone className="h-4 w-4" /> Emergency: {pg.emergencyName} · {pg.emergencyPhone}
                </a>
              ) : null}
            </Card>
          </>
        ) : null}

        {section === "wifi" ? (
          <>
            <Card>
              <CardHeader title="Wi-Fi access" subtitle="Only visible to current residents" icon={<WifiIcon size={22} />} />
              <InfoRow label="Network" value={pg.wifiName ?? "Not set"} />
              <InfoRow
                label="Password"
                value={
                  pg.wifiPassword ? (
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(pg.wifiPassword ?? "");
                        toast.push("Password copied.");
                      }}
                      className="inline-flex items-center gap-1.5 text-primary"
                    >
                      <span className="font-mono">{pg.wifiPassword}</span>
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    "Not shared yet"
                  )
                }
              />
              <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{pg.wifiInstructions || "No additional instructions."}</p>
            </Card>
            <Card>
              <CardHeader title="Connectivity tips" subtitle="If the internet is not working" />
              <ol className="list-decimal space-y-2 pl-4 text-[13px] text-ink-soft">
                <li>Toggle Wi-Fi off and on, then reconnect to {pg.wifiName ?? "the network"}.</li>
                <li>Move closer to the router on your floor and try again.</li>
                <li>Restart your device if the network does not appear.</li>
                <li>Still slow or down? Report an issue from the app so it is tracked.</li>
              </ol>
            </Card>
          </>
        ) : null}

        {section === "rules" ? (
          <>
            <Card>
              <CardHeader title="House rules" icon={<SecurityIcon size={22} />} />
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{pg.houseRules || "No house rules listed."}</p>
              {pg.notice ? <p className="mt-3 rounded-xl bg-sun/15 px-3 py-2 text-[12px] text-[#141928]">{pg.notice}</p> : null}
            </Card>
            <Card>
              <CardHeader title="Timings" subtitle="Water, laundry and cleaning" />
              <InfoRow label="Water" value={pg.waterTimings ?? "—"} />
              <InfoRow label="Laundry" value={pg.laundryTimings ?? "—"} />
              <InfoRow label="Cleaning" value={pg.cleaningSchedule ?? "—"} />
              <InfoRow label="Electricity" value={pg.electricityInfo ?? "—"} />
              <InfoRow label="Visitors" value={pg.visitorRules ?? "—"} />
              <InfoRow label="Common areas" value={pg.commonAreaRules ?? "—"} />
              <InfoRow label="Check-in" value={pg.checkInRules ?? "—"} />
              <InfoRow label="Check-out" value={pg.checkOutRules ?? "—"} />
            </Card>
          </>
        ) : null}

        {section === "roommates" ? (
          <Card className="lg:col-span-2">
            <CardHeader title="Your roommates" subtitle={`Room ${residency.roomNumber} · ${residency.floorName}`} />
            {data.roommates.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.roommates.map((mate) => (
                  <li key={mate.id} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5">
                    <span className="text-[13px] font-semibold">
                      {mate.name} {mate.isMe ? <span className="text-[11px] font-normal text-ink-muted">(you)</span> : null}
                    </span>
                    <Badge tone="gray">Bed {mate.bedLabel ?? "—"}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No roommates yet" description="You have this room to yourself for now." />
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
