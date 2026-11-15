import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Save, Trash2 } from "lucide-react";
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
  Input,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  Textarea,
  useToast,
} from "../../components/ui";
import { FoodIcon } from "../../components/icons";
import { addDaysKey, dayName, formatDay, todayKey } from "../../lib/format";

interface MenuRow {
  id: string;
  pgId: string;
  pgName?: string;
  date: string;
  note: string | null;
  meals: Record<string, string[]>;
  itemCount: number;
}

const MEALS = [
  { key: "BREAKFAST", label: "Breakfast", hint: "e.g. Idli, Sambar, Chutney" },
  { key: "LUNCH", label: "Lunch", hint: "e.g. Rice, Dal, Curry, Curd" },
  { key: "SNACKS", label: "Evening snacks", hint: "e.g. Tea, Biscuits" },
  { key: "DINNER", label: "Dinner", hint: "e.g. Chapati, Paneer curry" },
] as const;

export default function OwnerMenus() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pgId, setPgId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [meals, setMeals] = useState<Record<string, string>>({ BREAKFAST: "", LUNCH: "", SNACKS: "", DINNER: "" });
  const [note, setNote] = useState("");
  const [view, setView] = useState<"today" | "upcoming" | "past">("today");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["owner-menus", pgId],
    queryFn: () => api.get<{ menus: MenuRow[]; pgs: { id: string; name: string }[] }>(`/owner/menus${pgId ? `?pgId=${pgId}` : ""}`),
  });

  useEffect(() => {
    if (!pgId && data?.pgs.length) setPgId(data.pgs[0].id);
  }, [data, pgId]);

  useEffect(() => {
    const existing = data?.menus.find((menu) => menu.pgId === pgId && menu.date === date);
    setMeals({
      BREAKFAST: existing?.meals.BREAKFAST?.join(", ") ?? "",
      LUNCH: existing?.meals.LUNCH?.join(", ") ?? "",
      SNACKS: existing?.meals.SNACKS?.join(", ") ?? "",
      DINNER: existing?.meals.DINNER?.join(", ") ?? "",
    });
    setNote(existing?.note ?? "");
  }, [data, pgId, date]);

  const save = useMutation({
    mutationFn: () =>
      api.put<{ menu: MenuRow }>("/owner/menus", {
        pgId,
        date,
        note: note || undefined,
        meals: Object.fromEntries(
          MEALS.map((meal) => [
            meal.key,
            meals[meal.key]
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          ])
        ),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["owner-menus"] });
      toast.push(`Menu saved for ${formatDay(date)}. Residents notified.`);
    },
    onError: (mutationError) => toast.push(mutationError instanceof ApiError ? mutationError.message : "Could not save the menu.", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/owner/menus/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["owner-menus"] });
      setDeleteId(null);
      toast.push("Menu removed.");
    },
    onError: () => toast.push("Could not remove this menu.", "error"),
  });

  const today = todayKey();
  const yesterday = addDaysKey(today, -1);
  const selection = (data?.menus ?? []).filter((menu) => menu.pgId === pgId);
  const filtered = selection.filter((menu) => (view === "today" ? menu.date === today : view === "upcoming" ? menu.date > today : menu.date === yesterday || menu.date < today));

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (error || !data) return <ErrorNote message="Could not load menus." onRetry={() => void refetch()} />;

  if (!data.pgs.length) {
    return (
      <div>
        <PageHeader title="Food menu" subtitle="Plan breakfast, lunch, snacks and dinner." />
        <EmptyState icon={<FoodIcon size={34} />} title="Add a PG first" description="Menus belong to a property. Create a PG to start planning meals." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Food menu" subtitle="Plan meals for any day. Saving notifies every resident." />

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <Select value={pgId} onChange={(event) => setPgId(event.target.value)} aria-label="Select PG">
          {data.pgs.map((pg) => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
        </Select>
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Menu date" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`Menu for ${formatDay(date)}`}
            subtitle={dayName(date)}
            icon={<CalendarDays className="h-4 w-4 text-ink-muted" />}
            action={selection.find((menu) => menu.date === date) ? <Badge tone="green">Saved</Badge> : <Badge tone="gray">Draft</Badge>}
          />
          <div className="space-y-3">
            {MEALS.map((meal) => (
              <Field key={meal.key} label={meal.label} hint={meal.hint}>
                <Textarea
                  className="min-h-[70px]"
                  value={meals[meal.key]}
                  onChange={(event) => setMeals({ ...meals, [meal.key]: event.target.value })}
                  placeholder={meal.hint}
                />
              </Field>
            ))}
            <Field label="Note for residents" hint="Optional, e.g. special Sunday dinner">
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <Button full onClick={() => save.mutate()} loading={save.isPending} icon={<Save className="h-4 w-4" />}>
              Save menu and notify residents
            </Button>
            <p className="text-[11px] text-ink-muted">Separate items with commas. An empty meal is left off the menu.</p>
          </div>
        </Card>

        <div>
          <Tabs
            tabs={[
              { value: "today", label: "Today" },
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Previous" },
            ]}
            value={view}
            onChange={setView}
          />
          <div className="mt-3 space-y-2">
            {filtered.length === 0 ? (
              <EmptyState compact title="Nothing here" description="Save a menu for a date and it will appear in this list." />
            ) : (
              filtered.map((menu) => (
                <Card key={menu.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{formatDay(menu.date)}</p>
                      <p className="text-[11px] text-ink-muted">{menu.itemCount} items · {dayName(menu.date)}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setDate(menu.date)} className="rounded-lg bg-canvas px-2 py-1 text-[11px] font-semibold text-ink-soft hover:bg-primary/10 hover:text-primary">
                        Edit
                      </button>
                      <button onClick={() => setDeleteId(menu.id)} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger/5 hover:text-danger" aria-label="Delete menu">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-[12px]">
                    {MEALS.filter((meal) => menu.meals[meal.key]?.length).map((meal) => (
                      <p key={meal.key} className="text-ink-soft">
                        <span className="font-semibold text-ink">{meal.label}:</span> {menu.meals[meal.key].join(", ")}
                      </p>
                    ))}
                  </div>
                  {menu.note ? <p className="mt-2 rounded-lg bg-sun/15 px-2.5 py-1.5 text-[11px] text-[#141928]">{menu.note}</p> : null}
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
        title="Delete this menu?"
        description="Residents will no longer see this day's menu."
        confirmLabel="Delete menu"
        loading={remove.isPending}
      />
    </div>
  );
}
