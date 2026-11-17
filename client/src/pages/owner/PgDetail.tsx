import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BedDouble, Plus, Settings2, Trash2, Users, Wrench } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Field,
  ImageUploader,
  InfoRow,
  Input,
  Modal,
  PageHeader,
  Progress,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  cn,
  useToast,
} from "../../components/ui";
import { FloorsIcon, RoomIcon, WifiIcon } from "../../components/icons";
import { inr } from "../../lib/format";

interface BedRow {
  id: string;
  label: string;
  occupied: boolean;
  residentName: string | null;
}

interface RoomRow {
  id: string;
  number: string;
  roomType: string;
  capacity: number;
  rentPerBed: number;
  amenities: string[];
  status: string;
  beds: BedRow[];
  occupantCount: number;
}

interface FloorRow {
  id: string;
  name: string;
  level: number;
  rooms: RoomRow[];
  totalBeds: number;
  occupiedBeds: number;
}

interface PgDetailData {
  pg: {
    id: string;
    name: string;
    description: string | null;
    address: string;
    city: string;
    state: string;
    pincode: string;
    type: string;
    status: string;
    rentMin: number;
    rentMax: number;
    images: string[];
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
  floors: FloorRow[];
  residentCount: number;
}

const FACILITY_OPTIONS = [
  "High-speed Wi-Fi", "Home-style food", "Laundry service", "Power backup", "CCTV security",
  "Hot water", "Housekeeping", "Air conditioning", "Attached bathroom", "Bike parking", "Study room", "Gym",
];

const ROOM_TYPES = [
  { value: "SINGLE", label: "Single sharing" },
  { value: "DOUBLE", label: "Double sharing" },
  { value: "TRIPLE", label: "Triple sharing" },
  { value: "FOUR", label: "Four sharing" },
  { value: "FIVE", label: "Five sharing" },
  { value: "STANDARD", label: "Custom sharing" },
];

export default function OwnerPgDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<"overview" | "rooms" | "info">("overview");
  const [floorModal, setFloorModal] = useState(false);
  const [floorName, setFloorName] = useState("");
  const [floorLevel, setFloorLevel] = useState("");
  const [roomModal, setRoomModal] = useState<{ floorId: string; room?: RoomRow } | null>(null);
  const [roomForm, setRoomForm] = useState({ number: "", roomType: "DOUBLE", capacity: "2", rentPerBed: "10000", amenities: "" });
  const [confirmDelete, setConfirmDelete] = useState<{ type: "room" | "floor" | "pg"; id: string; label: string } | null>(null);
  const [info, setInfo] = useState<Record<string, string>>({});
  const [facilities, setFacilities] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [savingInfo, setSavingInfo] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["owner-pg", id],
    queryFn: () => api.get<PgDetailData>(`/owner/pgs/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (!data) return;
    const pg = data.pg;
    setInfo({
      name: pg.name,
      description: pg.description ?? "",
      address: pg.address,
      city: pg.city,
      state: pg.state,
      pincode: pg.pincode,
      type: pg.type,
      rentMin: String(pg.rentMin),
      rentMax: String(pg.rentMax),
      houseRules: pg.houseRules ?? "",
      checkInRules: pg.checkInRules ?? "",
      checkOutRules: pg.checkOutRules ?? "",
      emergencyName: pg.emergencyName ?? "",
      emergencyPhone: pg.emergencyPhone ?? "",
      wifiName: pg.wifiName ?? "",
      wifiPassword: pg.wifiPassword ?? "",
      wifiInstructions: pg.wifiInstructions ?? "",
      waterTimings: pg.waterTimings ?? "",
      laundryTimings: pg.laundryTimings ?? "",
      cleaningSchedule: pg.cleaningSchedule ?? "",
      electricityInfo: pg.electricityInfo ?? "",
      visitorRules: pg.visitorRules ?? "",
      commonAreaRules: pg.commonAreaRules ?? "",
      notice: pg.notice ?? "",
    });
    setFacilities(pg.facilities);
    setImages(pg.images);
  }, [data]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["owner-pg", id] });
    await queryClient.invalidateQueries({ queryKey: ["owner-pgs"] });
    await queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
  };

  const saveInfo = async () => {
    setSavingInfo(true);
    try {
      await api.patch(`/owner/pgs/${id}`, {
        ...info,
        rentMin: Number(info.rentMin),
        rentMax: Number(info.rentMax),
        facilities,
        images,
      });
      await invalidate();
      toast.push("PG details saved.");
    } catch (saveError) {
      toast.push(saveError instanceof ApiError ? saveError.message : "Could not save details.", "error");
    } finally {
      setSavingInfo(false);
    }
  };

  const addFloor = useMutation({
    mutationFn: () => api.post(`/owner/pgs/${id}/floors`, { name: floorName, level: Number(floorLevel || 0) }),
    onSuccess: async () => {
      await invalidate();
      toast.push("Floor added.");
      setFloorModal(false);
      setFloorName("");
      setFloorLevel("");
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not add floor.", "error"),
  });

  const saveRoom = useMutation({
    mutationFn: async () => {
      const payload = {
        number: roomForm.number,
        roomType: roomForm.roomType,
        capacity: Number(roomForm.capacity),
        rentPerBed: Number(roomForm.rentPerBed),
        amenities: roomForm.amenities.split(",").map((item) => item.trim()).filter(Boolean),
      };
      if (roomModal?.room) return api.patch(`/owner/rooms/${roomModal.room.id}`, payload);
      return api.post(`/owner/floors/${roomModal?.floorId}/rooms`, payload);
    },
    onSuccess: async () => {
      await invalidate();
      toast.push(roomModal?.room ? "Room updated." : "Room created with beds.");
      setRoomModal(null);
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not save room.", "error"),
  });

  const toggleMaintenance = async (room: RoomRow) => {
    try {
      await api.patch(`/owner/rooms/${room.id}`, { status: room.status === "MAINTENANCE" ? "ACTIVE" : "MAINTENANCE" });
      await invalidate();
      toast.push(room.status === "MAINTENANCE" ? "Room is back in service." : "Room marked for maintenance.");
    } catch {
      toast.push("Could not update the room status.", "error");
    }
  };

  const remove = useMutation({
    mutationFn: async () => {
      if (!confirmDelete) return null;
      if (confirmDelete.type === "room") return api.del(`/owner/rooms/${confirmDelete.id}`);
      if (confirmDelete.type === "floor") return api.del(`/owner/floors/${confirmDelete.id}`);
      return api.del(`/owner/pgs/${confirmDelete.id}`);
    },
    onSuccess: async () => {
      toast.push("Removed.");
      const wasPg = confirmDelete?.type === "pg";
      setConfirmDelete(null);
      if (wasPg) {
        await queryClient.invalidateQueries({ queryKey: ["owner-pgs"] });
        navigate("/owner/pgs");
        return;
      }
      await invalidate();
    },
    onError: (mutationError) => {
      toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not remove this.", "error");
      setConfirmDelete(null);
    },
  });

  const openRoomModal = (floorId: string, room?: RoomRow) => {
    setRoomModal({ floorId, room });
    setRoomForm(
      room
        ? {
            number: room.number,
            roomType: room.roomType,
            capacity: String(room.capacity),
            rentPerBed: String(room.rentPerBed),
            amenities: room.amenities.join(", "),
          }
        : { number: "", roomType: "DOUBLE", capacity: "2", rentPerBed: "10000", amenities: "" }
    );
  };

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (error || !data) return <ErrorNote message="Could not load this PG." onRetry={() => void refetch()} />;

  const pg = data.pg;
  const totalBeds = data.floors.reduce((sum, floor) => sum + floor.totalBeds, 0);
  const occupied = data.floors.reduce((sum, floor) => sum + floor.occupiedBeds, 0);
  const rate = totalBeds ? Math.round((occupied / totalBeds) * 100) : 0;

  return (
    <div>
      <Link to="/owner/pgs" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> All PGs
      </Link>

      <PageHeader
        title={pg.name}
        subtitle={`${pg.address}, ${pg.city}, ${pg.state} ${pg.pincode}`}
        actions={
          <>
            <StatusBadge status={pg.status} />
            <Button variant="secondary" size="sm" onClick={() => navigate(`/owner/residents?pgId=${pg.id}`)} icon={<Users className="h-4 w-4" />}>
              Residents
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete({ type: "pg", id: pg.id, label: pg.name })} icon={<Trash2 className="h-4 w-4" />}>
              Delete
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Floors", value: data.floors.length },
          { label: "Rooms", value: data.floors.reduce((sum, floor) => sum + floor.rooms.length, 0) },
          { label: "Beds occupied", value: `${occupied}/${totalBeds}` },
          { label: "Residents", value: data.residentCount },
        ].map((item) => (
          <div key={item.label} className="surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{item.label}</p>
            <p className="mt-1 text-xl font-extrabold">{item.value}</p>
          </div>
        ))}
      </div>

      <Tabs
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "rooms", label: "Floors & rooms" },
          { value: "info", label: "PG information" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "overview" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="About this PG" subtitle={pg.description || "No description added yet."} />
            <Progress value={rate} tone={rate === 100 ? "coral" : "green"} />
            <p className="mt-1 text-[11px] text-ink-muted">{rate}% of beds occupied · {totalBeds - occupied} available</p>
            <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
              <InfoRow label="Type" value={pg.type === "CO_LIVING" ? "Co-living" : pg.type === "BOYS" ? "Boys PG" : "Girls PG"} />
              <InfoRow label="Rent range" value={`${inr(pg.rentMin)} – ${inr(pg.rentMax)}`} />
              <InfoRow label="Emergency contact" value={pg.emergencyName ? `${pg.emergencyName} · ${pg.emergencyPhone ?? ""}` : "Not set"} />
              <InfoRow label="Wi-Fi network" value={pg.wifiName ?? "Not set"} />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Facilities</p>
              <div className="flex flex-wrap gap-1.5">
                {pg.facilities.length ? pg.facilities.map((facility) => <Badge key={facility} tone="blue">{facility}</Badge>) : <span className="text-[13px] text-ink-muted">None listed</span>}
              </div>
            </div>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="House rules" subtitle="Visible to residents" icon={<Settings2 className="h-4 w-4 text-ink-muted" />} />
              <p className="text-[13px] leading-relaxed text-ink-soft">{pg.houseRules || "No house rules added yet."}</p>
            </Card>
            <Card>
              <CardHeader title="Photos" subtitle={`${pg.images.length} uploaded`} />
              {pg.images.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {pg.images.map((image) => (
                    <img key={image} src={image} alt="" className="h-24 w-full rounded-xl object-cover" />
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-ink-muted">Add photos from the PG information tab.</p>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "rooms" ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-ink-muted">Beds are created automatically with each room. Occupied beds cannot be double-booked.</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setFloorModal(true)} icon={<Plus className="h-4 w-4" />}>
                Add floor
              </Button>
            </div>
          </div>

          {data.floors.length === 0 ? (
            <EmptyState
              icon={<FloorsIcon size={34} />}
              title="No floors yet"
              description="Start with Ground Floor, then add rooms and beds to it."
              action={<Button onClick={() => setFloorModal(true)}>Add floor</Button>}
            />
          ) : (
            data.floors.map((floor) => (
              <Card key={floor.id}>
                <CardHeader
                  title={`${floor.name}`}
                  subtitle={`${floor.rooms.length} rooms · ${floor.occupiedBeds}/${floor.totalBeds} beds occupied`}
                  icon={<FloorsIcon size={22} />}
                  action={
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openRoomModal(floor.id)} icon={<Plus className="h-3.5 w-3.5" />}>
                        Room
                      </Button>
                      <button
                        onClick={() => setConfirmDelete({ type: "floor", id: floor.id, label: floor.name })}
                        className="rounded-lg p-2 text-ink-muted hover:bg-danger/5 hover:text-danger"
                        aria-label={`Delete ${floor.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  }
                />

                {floor.rooms.length === 0 ? (
                  <EmptyState compact title="No rooms on this floor" description="Add a room and its beds will be created automatically." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {floor.rooms.map((room) => {
                      const vacant = room.beds.length - room.occupantCount;
                      const tone = room.status === "MAINTENANCE" ? "border-danger/30 bg-danger/5" : vacant === 0 ? "border-coral/30 bg-coral/5" : room.occupantCount === 0 ? "border-mint/40 bg-mint/5" : "border-ocean/30 bg-ocean/5";
                      return (
                        <div key={room.id} className={cn("rounded-2xl border p-3.5", tone)}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-extrabold">Room {room.number}</p>
                              <p className="text-[11px] text-ink-muted">
                                {ROOM_TYPES.find((type) => type.value === room.roomType)?.label ?? room.roomType} · {inr(room.rentPerBed)}/bed
                              </p>
                            </div>
                            {room.status === "MAINTENANCE" ? <Badge tone="red">Maintenance</Badge> : <Badge tone={vacant === 0 ? "coral" : "green"}>{vacant === 0 ? "Full" : `${vacant} free`}</Badge>}
                          </div>

                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {room.beds.map((bed) => (
                              <span
                                key={bed.id}
                                className={cn(
                                  "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold",
                                  bed.occupied ? "bg-surface text-ink shadow-sm" : "border border-dashed border-ink/20 text-ink-muted"
                                )}
                                title={bed.residentName ?? "Available"}
                              >
                                <BedDouble className="h-3 w-3" />
                                {bed.label}
                                {bed.occupied ? <span className="max-w-[68px] truncate font-normal"> · {bed.residentName?.split(" ")[0]}</span> : null}
                              </span>
                            ))}
                          </div>

                          <div className="mt-3 flex items-center gap-1">
                            <button onClick={() => openRoomModal(floor.id, room)} className="flex-1 rounded-lg bg-surface/70 py-1.5 text-[11px] font-semibold text-ink-soft transition hover:bg-surface">
                              Edit
                            </button>
                            <button onClick={() => void toggleMaintenance(room)} className="rounded-lg bg-surface/70 p-1.5 text-ink-muted transition hover:bg-surface hover:text-warning" aria-label="Toggle maintenance">
                              <Wrench className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete({ type: "room", id: room.id, label: `Room ${room.number}` })}
                              className="rounded-lg bg-surface/70 p-1.5 text-ink-muted transition hover:bg-surface hover:text-danger"
                              aria-label={`Delete room ${room.number}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      ) : null}

      {tab === "info" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Basics" subtitle="Name, address and rent range" />
            <div className="space-y-3">
              <Field label="PG name">
                <Input value={info.name ?? ""} onChange={(event) => setInfo({ ...info, name: event.target.value })} />
              </Field>
              <Field label="Description">
                <Textarea value={info.description ?? ""} onChange={(event) => setInfo({ ...info, description: event.target.value })} />
              </Field>
              <Field label="Address">
                <Input value={info.address ?? ""} onChange={(event) => setInfo({ ...info, address: event.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="City">
                  <Input value={info.city ?? ""} onChange={(event) => setInfo({ ...info, city: event.target.value })} />
                </Field>
                <Field label="State">
                  <Input value={info.state ?? ""} onChange={(event) => setInfo({ ...info, state: event.target.value })} />
                </Field>
                <Field label="Pincode">
                  <Input value={info.pincode ?? ""} onChange={(event) => setInfo({ ...info, pincode: event.target.value })} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Type">
                  <Select value={info.type ?? "BOYS"} onChange={(event) => setInfo({ ...info, type: event.target.value })}>
                    <option value="BOYS">Boys PG</option>
                    <option value="GIRLS">Girls PG</option>
                    <option value="CO_LIVING">Co-living</option>
                  </Select>
                </Field>
                <Field label="Min rent">
                  <Input type="number" value={info.rentMin ?? ""} onChange={(event) => setInfo({ ...info, rentMin: event.target.value })} />
                </Field>
                <Field label="Max rent">
                  <Input type="number" value={info.rentMax ?? ""} onChange={(event) => setInfo({ ...info, rentMax: event.target.value })} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Emergency contact name">
                  <Input value={info.emergencyName ?? ""} onChange={(event) => setInfo({ ...info, emergencyName: event.target.value })} />
                </Field>
                <Field label="Emergency phone">
                  <Input value={info.emergencyPhone ?? ""} onChange={(event) => setInfo({ ...info, emergencyPhone: event.target.value })} />
                </Field>
              </div>
              <Field label="Facilities">
                <div className="flex flex-wrap gap-1.5">
                  {FACILITY_OPTIONS.map((facility) => {
                    const active = facilities.includes(facility);
                    return (
                      <button
                        key={facility}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFacilities((current) => (active ? current.filter((item) => item !== facility) : [...current, facility]))}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                          active ? "border-primary bg-primary/10 text-primary" : "border-ink/10 text-ink-soft"
                        )}
                      >
                        {facility}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Photos">
                <ImageUploader images={images} onChange={setImages} folder="pg" max={4} />
              </Field>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Wi-Fi" subtitle="Shown only to current residents" icon={<WifiIcon size={22} />} />
              <div className="space-y-3">
                <Field label="Network name">
                  <Input value={info.wifiName ?? ""} onChange={(event) => setInfo({ ...info, wifiName: event.target.value })} placeholder="Sunrise_5G" />
                </Field>
                <Field label="Password">
                  <Input value={info.wifiPassword ?? ""} onChange={(event) => setInfo({ ...info, wifiPassword: event.target.value })} placeholder="Shared with residents" />
                </Field>
                <Field label="Instructions">
                  <Textarea value={info.wifiInstructions ?? ""} onChange={(event) => setInfo({ ...info, wifiInstructions: event.target.value })} />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="Timings & daily life" subtitle="Water, laundry, cleaning and electricity" icon={<RoomIcon size={22} />} />
              <div className="space-y-3">
                <Field label="Water timings">
                  <Input value={info.waterTimings ?? ""} onChange={(event) => setInfo({ ...info, waterTimings: event.target.value })} />
                </Field>
                <Field label="Laundry timings">
                  <Input value={info.laundryTimings ?? ""} onChange={(event) => setInfo({ ...info, laundryTimings: event.target.value })} />
                </Field>
                <Field label="Cleaning schedule">
                  <Input value={info.cleaningSchedule ?? ""} onChange={(event) => setInfo({ ...info, cleaningSchedule: event.target.value })} />
                </Field>
                <Field label="Electricity information">
                  <Textarea value={info.electricityInfo ?? ""} onChange={(event) => setInfo({ ...info, electricityInfo: event.target.value })} />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="Rules & notices" subtitle="House, visitor and check-in rules" />
              <div className="space-y-3">
                <Field label="House rules">
                  <Textarea value={info.houseRules ?? ""} onChange={(event) => setInfo({ ...info, houseRules: event.target.value })} />
                </Field>
                <Field label="Check-in rules">
                  <Textarea value={info.checkInRules ?? ""} onChange={(event) => setInfo({ ...info, checkInRules: event.target.value })} />
                </Field>
                <Field label="Check-out rules">
                  <Textarea value={info.checkOutRules ?? ""} onChange={(event) => setInfo({ ...info, checkOutRules: event.target.value })} />
                </Field>
                <Field label="Visitor rules">
                  <Textarea value={info.visitorRules ?? ""} onChange={(event) => setInfo({ ...info, visitorRules: event.target.value })} />
                </Field>
                <Field label="Common area rules">
                  <Textarea value={info.commonAreaRules ?? ""} onChange={(event) => setInfo({ ...info, commonAreaRules: event.target.value })} />
                </Field>
                <Field label="Notice for residents">
                  <Textarea value={info.notice ?? ""} onChange={(event) => setInfo({ ...info, notice: event.target.value })} />
                </Field>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Button onClick={saveInfo} loading={savingInfo}>
              Save PG information
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={floorModal}
        onClose={() => setFloorModal(false)}
        title="Add a floor"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFloorModal(false)}>Cancel</Button>
            <Button loading={addFloor.isPending} onClick={() => addFloor.mutate()} disabled={!floorName.trim()}>
              Add floor
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Floor name">
            <Input value={floorName} onChange={(event) => setFloorName(event.target.value)} placeholder="Ground Floor" />
          </Field>
          <Field label="Level" hint="0 for ground, 1 for first, and so on.">
            <Input type="number" value={floorLevel} onChange={(event) => setFloorLevel(event.target.value)} placeholder="0" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!roomModal}
        onClose={() => setRoomModal(null)}
        title={roomModal?.room ? `Edit room ${roomModal.room.number}` : "Add a room"}
        description="Beds are generated automatically for the capacity you set."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRoomModal(null)}>Cancel</Button>
            <Button loading={saveRoom.isPending} onClick={() => saveRoom.mutate()} disabled={!roomForm.number.trim()}>
              {roomModal?.room ? "Save room" : "Create room"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Room number">
            <Input value={roomForm.number} onChange={(event) => setRoomForm({ ...roomForm, number: event.target.value })} placeholder="101" />
          </Field>
          <Field label="Room type">
            <Select value={roomForm.roomType} onChange={(event) => setRoomForm({ ...roomForm, roomType: event.target.value })}>
              {ROOM_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sharing capacity" hint="Number of beds in this room.">
            <Input type="number" min={1} max={20} value={roomForm.capacity} onChange={(event) => setRoomForm({ ...roomForm, capacity: event.target.value, roomType: event.target.value === "3" ? "TRIPLE" : roomForm.roomType })} />
          </Field>
          <Field label="Rent per bed">
            <Input type="number" value={roomForm.rentPerBed} onChange={(event) => setRoomForm({ ...roomForm, rentPerBed: event.target.value })} />
          </Field>
          <Field label="Amenities" hint="Comma separated" className="sm:col-span-2">
            <Input value={roomForm.amenities} onChange={(event) => setRoomForm({ ...roomForm, amenities: event.target.value })} placeholder="Attached bathroom, AC, Study table" />
          </Field>
          {roomModal?.room ? (
            <p className="sm:col-span-2 rounded-xl bg-sun/15 px-3 py-2 text-[12px] text-[#141928]">
              Reducing capacity below the number of occupied beds is blocked until those residents move.
            </p>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => remove.mutate()}
        title={`Delete ${confirmDelete?.label ?? "this"}?`}
        description={
          confirmDelete?.type === "pg"
            ? "This removes the PG, its floors, rooms, menus and history. Residents must be vacated first."
            : "This cannot be undone. Rooms or floors with residents cannot be deleted."
        }
        confirmLabel="Delete"
        loading={remove.isPending}
      />
    </div>
  );
}
