import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  ImageUploader,
  Input,
  Modal,
  PageHeader,
  Progress,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  cn,
  useToast,
} from "../../components/ui";
import { BuildingIcon } from "../../components/icons";
import { inr } from "../../lib/format";

interface PgRow {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  type: string;
  status: string;
  rentMin: number;
  rentMax: number;
  images: string[];
  facilities: string[];
  floorCount: number;
  roomCount: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  residentCount: number;
}

const FACILITY_OPTIONS = [
  "High-speed Wi-Fi",
  "Home-style food",
  "Laundry service",
  "Power backup",
  "CCTV security",
  "Hot water",
  "Housekeeping",
  "Air conditioning",
  "Attached bathroom",
  "Bike parking",
  "Study room",
  "Gym",
];

const schema = z.object({
  name: z.string().trim().min(2, "Give your PG a name."),
  type: z.enum(["BOYS", "GIRLS", "CO_LIVING"]),
  address: z.string().trim().min(5, "Enter the full address."),
  city: z.string().trim().min(2, "Enter the city."),
  state: z.string().trim().min(2, "Enter the state."),
  pincode: z.string().trim().min(4, "Enter the pincode."),
  rentMin: z.coerce.number().int().min(0),
  rentMax: z.coerce.number().int().min(0),
  description: z.string().trim().max(1200).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function OwnerPgs() {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const [images, setImages] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["owner-pgs"],
    queryFn: () => api.get<{ pgs: PgRow[] }>("/owner/pgs"),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "BOYS", rentMin: 8000, rentMax: 15000 },
  });

  useEffect(() => {
    if (params.get("new") === "1") setOpen(true);
  }, [params]);

  const closeModal = () => {
    setOpen(false);
    setParams({});
    setFormError(null);
    reset({ type: "BOYS", rentMin: 8000, rentMax: 15000 });
    setImages([]);
    setFacilities([]);
  };

  const createPg = useMutation({
    mutationFn: (values: FormValues) => api.post<{ pg: { id: string } }>("/owner/pgs", { ...values, images, facilities }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["owner-pgs"] });
      await queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
      toast.push("PG created. Add floors and rooms next.");
      closeModal();
      navigate(`/owner/pgs/${result.pg.id}`);
    },
    onError: (mutationError) => {
      setFormError(mutationError instanceof ApiError ? mutationError.message : "Could not create this PG.");
    },
  });

  return (
    <div>
      <PageHeader
        title="My PGs"
        subtitle="Everything you run, in one place."
        actions={
          <Button onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Add PG
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((index) => <Skeleton key={index} className="h-40 w-full" />)}
        </div>
      ) : error ? (
        <ErrorNote message="Could not load your PGs." onRetry={() => void refetch()} />
      ) : !data?.pgs.length ? (
        <EmptyState
          icon={<BuildingIcon size={36} />}
          title="No properties yet"
          description="Create your first PG, then add floors and rooms to start filling beds."
          action={<Button onClick={() => setOpen(true)}>Add your first PG</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.pgs.map((pg) => {
            const rate = pg.totalBeds ? Math.round((pg.occupiedBeds / pg.totalBeds) * 100) : 0;
            return (
              <Card key={pg.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold">{pg.name}</p>
                      <StatusBadge status={pg.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                      {pg.city}, {pg.state} · {pg.type === "CO_LIVING" ? "Co-living" : pg.type === "BOYS" ? "Boys PG" : "Girls PG"}
                    </p>
                  </div>
                  <Badge tone="purple">{rate}%</Badge>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Floors", value: pg.floorCount },
                    { label: "Rooms", value: pg.roomCount },
                    { label: "Beds", value: pg.totalBeds },
                    { label: "Residents", value: pg.residentCount },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-canvas py-2">
                      <p className="text-sm font-bold">{item.value}</p>
                      <p className="text-[10px] text-ink-muted">{item.label}</p>
                    </div>
                  ))}
                </div>

                <Progress value={rate} tone={pg.vacantBeds === 0 ? "coral" : "green"} />
                <div className="flex items-center justify-between text-[11px] text-ink-muted">
                  <span>{pg.vacantBeds} beds free</span>
                  <span>{inr(pg.rentMin)}–{inr(pg.rentMax)}</span>
                </div>

                <Link
                  to={`/owner/pgs/${pg.id}`}
                  className="mt-1 flex items-center justify-center rounded-xl border border-ink/10 py-2.5 text-[13px] font-semibold text-ink transition hover:border-primary/40 hover:text-primary"
                >
                  Manage floors, rooms and info
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={closeModal}
        title="Add a PG"
        description="Basic details first. You can add floors, rooms and house rules after creating it."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={isSubmitting}>Cancel</Button>
            <Button loading={isSubmitting} onClick={handleSubmit((values) => createPg.mutate(values))}>Create PG</Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit((values) => createPg.mutate(values))} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="PG name" error={errors.name?.message}>
              <Input placeholder="Sunrise Residency" {...register("name")} error={!!errors.name} />
            </Field>
            <Field label="PG type" error={errors.type?.message}>
              <Select
                value={watch("type")}
                onChange={(event) => setValue("type", event.target.value as FormValues["type"], { shouldValidate: true })}
              >
                <option value="BOYS">Boys PG</option>
                <option value="GIRLS">Girls PG</option>
                <option value="CO_LIVING">Co-living</option>
              </Select>
            </Field>
          </div>

          <Field label="Address" error={errors.address?.message}>
            <Input placeholder="14, 3rd Cross, AECS Layout" {...register("address")} error={!!errors.address} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" error={errors.city?.message}>
              <Input placeholder="Bengaluru" {...register("city")} error={!!errors.city} />
            </Field>
            <Field label="State" error={errors.state?.message}>
              <Input placeholder="Karnataka" {...register("state")} error={!!errors.state} />
            </Field>
            <Field label="Pincode" error={errors.pincode?.message}>
              <Input placeholder="560037" {...register("pincode")} error={!!errors.pincode} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum rent" error={errors.rentMin?.message} hint="Lowest monthly rent per bed">
              <Input type="number" inputMode="numeric" {...register("rentMin")} error={!!errors.rentMin} />
            </Field>
            <Field label="Maximum rent" error={errors.rentMax?.message} hint="Highest monthly rent per bed">
              <Input type="number" inputMode="numeric" {...register("rentMax")} error={!!errors.rentMax} />
            </Field>
          </div>

          <Field label="Description" hint="Optional, but it helps residents decide.">
            <Textarea placeholder="A calm, well-lit PG with home-style food and fast internet." {...register("description")} />
          </Field>

          <Field label="Facilities">
            <div className="flex flex-wrap gap-2">
              {FACILITY_OPTIONS.map((facility) => {
                const active = facilities.includes(facility);
                return (
                  <button
                    key={facility}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFacilities((current) => (active ? current.filter((item) => item !== facility) : [...current, facility]))}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      active ? "border-primary bg-primary/10 text-primary" : "border-ink/10 text-ink-soft hover:border-primary/30"
                    )}
                  >
                    {facility}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Photos" hint="Up to 4 photos. The first one becomes the cover.">
            <ImageUploader images={images} onChange={setImages} folder="pg" max={4} />
          </Field>

          {formError ? <p className="error-text">{formError}</p> : null}
          <button type="submit" className="hidden" aria-hidden />
        </form>
      </Modal>
    </div>
  );
}
