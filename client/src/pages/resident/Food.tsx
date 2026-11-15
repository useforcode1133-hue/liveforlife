import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Card, CardHeader, EmptyState, ErrorNote, PageHeader, Skeleton, Tabs } from "../../components/ui";
import { FoodIcon } from "../../components/icons";
import { dayName, formatDay } from "../../lib/format";

interface MenuShape {
  id: string;
  date: string;
  note: string | null;
  meals: Record<string, string[]>;
}

interface MenuData {
  today: MenuShape | null;
  upcoming: MenuShape[];
  past: MenuShape[];
  pgName: string | null;
}

const MEALS = [
  { key: "BREAKFAST", label: "Breakfast", tone: "bg-sun/20" },
  { key: "LUNCH", label: "Lunch", tone: "bg-mint/15" },
  { key: "SNACKS", label: "Snacks", tone: "bg-blush/20" },
  { key: "DINNER", label: "Dinner", tone: "bg-ocean/10" },
];

function MenuView({ menu }: { menu: MenuShape }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {MEALS.map((meal) => (
          <div key={meal.key} className={`rounded-xl p-3 ${meal.tone}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{meal.label}</p>
            <p className="mt-1 text-[13px] leading-snug text-ink">
              {menu.meals[meal.key]?.length ? menu.meals[meal.key].join(", ") : "Not published"}
            </p>
          </div>
        ))}
      </div>
      {menu.note ? <p className="rounded-xl bg-sun/15 px-3 py-2 text-[12px] text-[#141928]">{menu.note}</p> : null}
    </div>
  );
}

export default function ResidentFood() {
  const [tab, setTab] = useState<"today" | "upcoming" | "past">("today");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["resident-menu"],
    queryFn: () => api.get<MenuData>("/resident/menu"),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <ErrorNote message="Could not load the menu." onRetry={() => void refetch()} />;

  const list = tab === "today" ? (data.today ? [data.today] : []) : tab === "upcoming" ? data.upcoming : data.past;

  return (
    <div>
      <PageHeader title="Food menu" subtitle={data.pgName ? `Meals planned at ${data.pgName}` : "Meals planned at your PG"} />

      <Tabs
        tabs={[
          { value: "today", label: "Today" },
          { value: "upcoming", label: "Upcoming", count: data.upcoming.length },
          { value: "past", label: "Previous", count: data.past.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <EmptyState
            icon={<FoodIcon size={32} />}
            title={tab === "today" ? "No menu for today" : "Nothing planned yet"}
            description="Your PG owner publishes the menu regularly. Check back later."
          />
        ) : (
          list.map((menu) => (
            <Card key={menu.id}>
              <CardHeader
                title={formatDay(menu.date)}
                subtitle={dayName(menu.date)}
                icon={<FoodIcon size={22} />}
                action={<Badge tone="purple">{menu.date === data.today?.date ? "Today" : "Planned"}</Badge>}
              />
              <MenuView menu={menu} />
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
