import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const now = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (offset = 0) => {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const dayKey = (offset = 0) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dueDate = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 5, 12, 0, 0);
};
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);

async function reset() {
  await prisma.emailLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.announcementTarget.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.complaintUpdate.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.rentRecord.deleteMany();
  await prisma.foodMenuItem.deleteMany();
  await prisma.foodMenu.deleteMany();
  await prisma.pgInvitation.deleteMany();
  await prisma.residency.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.room.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.pg.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appSetting.deleteMany();
}

const bedLabels = (count: number) => Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));

type RoomSeed = {
  number: string;
  capacity: number;
  roomType: string;
  rent: number;
  amenities: string[];
  status?: string;
};

async function createPg(input: {
  ownerId: string;
  data: {
    name: string;
    description: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    type: string;
    rentMin: number;
    rentMax: number;
    facilities: string[];
    houseRules: string;
    emergencyName: string;
    emergencyPhone: string;
    status?: string;
    wifiName: string;
    wifiPassword: string;
    wifiInstructions: string;
    waterTimings: string;
    laundryTimings: string;
    cleaningSchedule: string;
    electricityInfo: string;
    visitorRules: string;
    commonAreaRules: string;
    notice: string;
  };
  floors: { name: string; level: number; rooms: RoomSeed[] }[];
}) {
  const pg = await prisma.pg.create({
    data: {
      ...input.data,
      status: input.data.status ?? "VERIFIED",
      ownerId: input.ownerId,
      images: JSON.stringify([]),
      facilities: JSON.stringify(input.data.facilities),
      checkInRules: "Check-in between 9 AM and 8 PM. Bring a photo ID.",
      checkOutRules: "Give 30 days notice before vacating. Clear dues before check-out.",
    },
  });

  for (const floorSeed of input.floors) {
    const floor = await prisma.floor.create({
      data: { pgId: pg.id, name: floorSeed.name, level: floorSeed.level },
    });
    for (const roomSeed of floorSeed.rooms) {
      const room = await prisma.room.create({
        data: {
          pgId: pg.id,
          floorId: floor.id,
          number: roomSeed.number,
          roomType: roomSeed.roomType,
          capacity: roomSeed.capacity,
          rentPerBed: roomSeed.rent,
          amenities: JSON.stringify(roomSeed.amenities),
          status: roomSeed.status ?? "ACTIVE",
        },
      });
      await prisma.bed.createMany({
        data: bedLabels(roomSeed.capacity).map((label) => ({ roomId: room.id, pgId: pg.id, label })),
      });
    }
  }
  return pg;
}

async function allocate(input: {
  residentId: string;
  pgId: string;
  roomNumber: string;
  bedLabel: string;
  rent: number;
  deposit: number;
  joinedAt: Date;
  status?: string;
}) {
  const room = await prisma.room.findFirstOrThrow({ where: { pgId: input.pgId, number: input.roomNumber } });
  const bed = await prisma.bed.findFirstOrThrow({ where: { roomId: room.id, label: input.bedLabel } });
  const residency = await prisma.residency.create({
    data: {
      residentId: input.residentId,
      pgId: input.pgId,
      floorId: room.floorId,
      roomId: room.id,
      bedId: bed.id,
      status: input.status ?? "ACTIVE",
      monthlyRent: input.rent,
      securityDeposit: input.deposit,
      joinedAt: input.joinedAt,
    },
  });
  if ((input.status ?? "ACTIVE") === "ACTIVE") {
    await prisma.bed.update({ where: { id: bed.id }, data: { activeResidencyId: residency.id } });
  }
  return { residency, room, bed };
}

async function addRent(input: {
  residencyId: string;
  pgId: string;
  month: string;
  due: number;
  paid: number;
  method?: string;
  recordedById?: string;
  overdue?: boolean;
}) {
  const fullyPaid = input.paid >= input.due;
  const record = await prisma.rentRecord.create({
    data: {
      residencyId: input.residencyId,
      pgId: input.pgId,
      periodMonth: input.month,
      amountDue: input.due,
      amountPaid: input.paid,
      status: fullyPaid ? "PAID" : input.overdue ? "OVERDUE" : input.paid > 0 ? "PARTIAL" : "UNPAID",
      dueDate: dueDate(input.month),
      paidAt: fullyPaid ? dueDate(input.month) : input.paid > 0 ? dueDate(input.month) : null,
      notes: input.paid > 0 && !fullyPaid ? "Partial payment received." : null,
    },
  });
  if (input.paid > 0) {
    await prisma.payment.create({
      data: {
        rentRecordId: record.id,
        amount: input.paid,
        method: input.method ?? "UPI",
        reference: `TXN${Math.floor(Math.random() * 900000 + 100000)}`,
        paidAt: dueDate(input.month),
        recordedById: input.recordedById!,
        note: fullyPaid ? "Rent for the month" : "Part payment",
      },
    });
  }
  return record;
}

async function addMenu(pgId: string, date: string, meals: Record<string, string[]>, note?: string) {
  const menu = await prisma.foodMenu.create({ data: { pgId, date, note: note ?? null } });
  const items = Object.entries(meals).flatMap(([meal, names]) =>
    names.map((name, index) => ({ menuId: menu.id, meal, name, sortOrder: index }))
  );
  await prisma.foodMenuItem.createMany({ data: items });
  return menu;
}

async function main() {
  await reset();
  const password = await bcrypt.hash("Password@123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Aarav Mehta",
      email: "admin@pgmanager.app",
      phone: "9800011122",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      passwordHash: password,
      preferences: { create: {} },
    },
  });

  const rajesh = await prisma.user.create({
    data: {
      name: "Rajesh Kumar",
      email: "owner@sunriseresidency.in",
      phone: "9812345678",
      role: "PG_OWNER",
      status: "ACTIVE",
      passwordHash: password,
      preferences: { create: {} },
    },
  });

  const meera = await prisma.user.create({
    data: {
      name: "Meera Nair",
      email: "owner@lakesidepg.in",
      phone: "9823456789",
      role: "PG_OWNER",
      status: "ACTIVE",
      passwordHash: password,
      preferences: { create: {} },
    },
  });

  await prisma.user.create({
    data: {
      name: "Priya Sharma",
      email: "owner@palmgrove.in",
      phone: "9834567890",
      role: "PG_OWNER",
      status: "PENDING",
      passwordHash: password,
      preferences: { create: {} },
    },
  });

  const sunrise = await createPg({
    ownerId: rajesh.id,
    data: {
      name: "Sunrise Residency",
      description:
        "A calm, well-lit boys PG with home-style food, high-speed internet and a rooftop study lounge. Ten minutes from the tech park gate.",
      address: "14, 3rd Cross, AECS Layout, Brookefield",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560037",
      type: "BOYS",
      rentMin: 8500,
      rentMax: 16000,
      facilities: [
        "High-speed Wi-Fi",
        "Home-style food",
        "Laundry service",
        "Power backup",
        "CCTV security",
        "Hot water",
        "Housekeeping",
        "Rooftop lounge",
        "Bike parking",
      ],
      houseRules:
        "Guests allowed only in the common area until 9 PM. Quiet hours after 10:30 PM. No smoking inside rooms. Keep the kitchen clean after use.",
      emergencyName: "Rajesh Kumar",
      emergencyPhone: "9812345678",
      wifiName: "Sunrise_5G",
      wifiPassword: "Sunrise@2026",
      wifiInstructions:
        "Connect to Sunrise_5G and enter the password. If the network does not appear, restart your Wi-Fi once. For slow speeds, raise a complaint from the app.",
      waterTimings: "Hot water 6:00 AM – 9:00 AM and 6:00 PM – 8:30 PM. Cauvery supply all day.",
      laundryTimings: "Pickup Tuesday and Friday at 8 AM, returned the next evening.",
      cleaningSchedule: "Rooms cleaned daily 10 AM – 12 PM. Bathrooms twice a day.",
      electricityInfo: "Power backup covers lights, fans and Wi-Fi. AC usage is metered separately.",
      visitorRules: "Visitors must sign in at the desk. No overnight guests without owner approval.",
      commonAreaRules: "Keep noise low after 10:30 PM. Clean up the dining table after meals.",
      notice: "Water tank cleaning on the 1st of every month, 10 AM – 1 PM.",
    },
    floors: [
      {
        name: "Ground Floor",
        level: 0,
        rooms: [
          { number: "001", capacity: 1, roomType: "SINGLE", rent: 16000, amenities: ["Attached bathroom", "AC", "Study table", "Wardrobe"] },
          { number: "002", capacity: 2, roomType: "DOUBLE", rent: 12000, amenities: ["Attached bathroom", "Balcony", "Study table"] },
          { number: "003", capacity: 3, roomType: "TRIPLE", rent: 9500, amenities: ["Attached bathroom", "Study table", "Wardrobe"] },
        ],
      },
      {
        name: "First Floor",
        level: 1,
        rooms: [
          { number: "101", capacity: 2, roomType: "DOUBLE", rent: 12500, amenities: ["Attached bathroom", "AC", "Balcony"] },
          { number: "102", capacity: 4, roomType: "FOUR", rent: 8500, amenities: ["Attached bathroom", "Wardrobe", "Study table"] },
          { number: "103", capacity: 3, roomType: "TRIPLE", rent: 10000, amenities: ["Attached bathroom", "Balcony"] },
        ],
      },
      {
        name: "Second Floor",
        level: 2,
        rooms: [
          { number: "201", capacity: 2, roomType: "DOUBLE", rent: 13000, amenities: ["Attached bathroom", "AC"] },
          { number: "202", capacity: 3, roomType: "TRIPLE", rent: 9000, amenities: ["Common bathroom", "Study table"] },
          { number: "203", capacity: 2, roomType: "DOUBLE", rent: 11000, amenities: ["Attached bathroom"], status: "MAINTENANCE" },
        ],
      },
    ],
  });

  const annexe = await createPg({
    ownerId: rajesh.id,
    data: {
      name: "Sunrise Annexe",
      description: "Co-living annexe for working professionals with a shared kitchen and co-working corner.",
      address: "21, 5th Main, AECS Layout",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560037",
      type: "CO_LIVING",
      rentMin: 11000,
      rentMax: 18000,
      facilities: ["Wi-Fi", "Shared kitchen", "Co-working corner", "Laundry", "CCTV"],
      houseRules: "Shared kitchen closes at 11 PM. Label your food. Keep the co-working corner call-friendly.",
      emergencyName: "Rajesh Kumar",
      emergencyPhone: "9812345678",
      wifiName: "Annexe_5G",
      wifiPassword: "Annexe@2026",
      wifiInstructions: "Use Annexe_5G with the password shared at check-in.",
      waterTimings: "24 hours",
      laundryTimings: "Wednesday and Saturday",
      cleaningSchedule: "Daily 9 AM",
      electricityInfo: "Included in rent up to 100 units per room.",
      visitorRules: "Guests allowed in the lounge until 10 PM.",
      commonAreaRules: "Wash utensils after use.",
      notice: "New co-working desks arriving this month.",
    },
    floors: [
      {
        name: "Ground Floor",
        level: 0,
        rooms: [
          { number: "A1", capacity: 1, roomType: "SINGLE", rent: 18000, amenities: ["Private bathroom", "AC", "Desk"] },
          { number: "A2", capacity: 2, roomType: "DOUBLE", rent: 14000, amenities: ["Attached bathroom", "AC"] },
        ],
      },
    ],
  });

  const lakeview = await createPg({
    ownerId: meera.id,
    data: {
      name: "Lakeview Girls PG",
      description: "Bright, secure girls PG a short walk from the university, with a study room and terrace garden.",
      address: "7, Lake Road, Kalyani Nagar",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411006",
      type: "GIRLS",
      rentMin: 9000,
      rentMax: 15000,
      facilities: ["Wi-Fi", "Study room", "Terrace garden", "CCTV", "Warden on site", "Laundry"],
      houseRules: "Entry closes at 10 PM. Visitors in the common area only. Keep the study room silent.",
      emergencyName: "Meera Nair",
      emergencyPhone: "9823456789",
      wifiName: "Lakeview_Home",
      wifiPassword: "Lake@2026",
      wifiInstructions: "Connect to Lakeview_Home. Ask the warden if the password changes.",
      waterTimings: "Hot water 6 AM – 9 AM, 6 PM – 9 PM.",
      laundryTimings: "Monday and Thursday",
      cleaningSchedule: "Daily 11 AM",
      electricityInfo: "Backup for lights and fans.",
      visitorRules: "Parents may visit until 8 PM with a gate entry.",
      commonAreaRules: "No cooking in rooms.",
      notice: "Terrace garden open every evening until 9 PM.",
    },
    floors: [
      {
        name: "Ground Floor",
        level: 0,
        rooms: [
          { number: "G1", capacity: 2, roomType: "DOUBLE", rent: 15000, amenities: ["Attached bathroom", "AC"] },
          { number: "G2", capacity: 3, roomType: "TRIPLE", rent: 11000, amenities: ["Attached bathroom"] },
        ],
      },
      {
        name: "First Floor",
        level: 1,
        rooms: [
          { number: "F1", capacity: 1, roomType: "SINGLE", rent: 15000, amenities: ["Private bathroom", "Study desk"] },
          { number: "F2", capacity: 2, roomType: "DOUBLE", rent: 12000, amenities: ["Balcony", "Attached bathroom"] },
        ],
      },
    ],
  });

  const residentSeeds = [
    { name: "Rahul Verma", email: "rahul@example.com", phone: "9900112233" },
    { name: "Arjun Rao", email: "arjun@example.com", phone: "9900112244" },
    { name: "Sai Krishna", email: "sai@example.com", phone: "9900112255" },
    { name: "Kiran Patil", email: "kiran@example.com", phone: "9900112266" },
    { name: "Vikram Shetty", email: "vikram@example.com", phone: "9900112277" },
    { name: "Ananya Iyer", email: "ananya@example.com", phone: "9900112288" },
    { name: "Sneha Kulkarni", email: "sneha@example.com", phone: "9900112299" },
    { name: "Divya Menon", email: "divya@example.com", phone: "9900112200" },
  ];

  const residents = [];
  for (const [index, seed] of residentSeeds.entries()) {
    residents.push(
      await prisma.user.create({
        data: {
          ...seed,
          role: "RESIDENT",
          status: "ACTIVE",
          passwordHash: password,
          createdAt: daysAgo(60 - index * 6),
          preferences: { create: {} },
        },
      })
    );
  }
  const [rahul, arjun, sai, kiran, vikram, ananya, sneha, divya] = residents;

  const allocations: { residencyId: string; pgId: string; rent: number; residentId: string }[] = [];
  const move = async (args: {
    residentId: string;
    pgId: string;
    roomNumber: string;
    bedLabel: string;
    rent: number;
    joinedDaysAgo: number;
  }) => {
    const created = await allocate({
      residentId: args.residentId,
      pgId: args.pgId,
      roomNumber: args.roomNumber,
      bedLabel: args.bedLabel,
      rent: args.rent,
      deposit: args.rent,
      joinedAt: daysAgo(args.joinedDaysAgo),
    });
    allocations.push({
      residencyId: created.residency.id,
      pgId: args.pgId,
      rent: args.rent,
      residentId: args.residentId,
    });
  };

  await move({ residentId: rahul.id, pgId: sunrise.id, roomNumber: "101", bedLabel: "A", rent: 12500, joinedDaysAgo: 74 });
  await move({ residentId: arjun.id, pgId: sunrise.id, roomNumber: "101", bedLabel: "B", rent: 12500, joinedDaysAgo: 52 });
  await move({ residentId: sai.id, pgId: sunrise.id, roomNumber: "003", bedLabel: "A", rent: 9500, joinedDaysAgo: 40 });
  await move({ residentId: kiran.id, pgId: sunrise.id, roomNumber: "001", bedLabel: "A", rent: 16000, joinedDaysAgo: 31 });
  await move({ residentId: vikram.id, pgId: sunrise.id, roomNumber: "102", bedLabel: "A", rent: 8500, joinedDaysAgo: 25 });
  await move({ residentId: ananya.id, pgId: lakeview.id, roomNumber: "G1", bedLabel: "A", rent: 15000, joinedDaysAgo: 64 });
  await move({ residentId: sneha.id, pgId: lakeview.id, roomNumber: "G2", bedLabel: "A", rent: 11000, joinedDaysAgo: 45 });
  await move({ residentId: divya.id, pgId: lakeview.id, roomNumber: "F1", bedLabel: "A", rent: 15000, joinedDaysAgo: 22 });
  await move({ residentId: sai.id, pgId: annexe.id, roomNumber: "A2", bedLabel: "A", rent: 14000, joinedDaysAgo: 2 });

  // A past stay that has been vacated keeps its history.
  const pastResident = await prisma.user.create({
    data: {
      name: "Nikhil Joshi",
      email: "nikhil@example.com",
      phone: "9900113311",
      role: "RESIDENT",
      status: "ACTIVE",
      passwordHash: password,
      preferences: { create: {} },
    },
  });
  const pastStay = await allocate({
    residentId: pastResident.id,
    pgId: sunrise.id,
    roomNumber: "103",
    bedLabel: "C",
    rent: 10000,
    deposit: 10000,
    joinedAt: daysAgo(190),
    status: "ACTIVE",
  });
  await addRent({ residencyId: pastStay.residency.id, pgId: sunrise.id, month: monthKey(-4), due: 10000, paid: 10000, recordedById: rajesh.id });
  await addRent({ residencyId: pastStay.residency.id, pgId: sunrise.id, month: monthKey(-3), due: 10000, paid: 10000, recordedById: rajesh.id });
  await prisma.residency.update({
    where: { id: pastStay.residency.id },
    data: { status: "VACATED", vacatedAt: daysAgo(95), exitReason: "Moved closer to work" },
  });
  await prisma.bed.update({ where: { id: pastStay.bed.id }, data: { activeResidencyId: null } });

  const current = monthKey(0);
  const previous = monthKey(-1);
  const older = monthKey(-2);

  for (const [index, allocation] of allocations.entries()) {
    const paidMonths = index < 2 ? [older, previous] : index < 4 ? [older, previous] : [older];
    for (const month of paidMonths) {
      await addRent({
        residencyId: allocation.residencyId,
        pgId: allocation.pgId,
        month,
        due: allocation.rent,
        paid: allocation.rent,
        recordedById: allocation.pgId === lakeview.id ? meera.id : rajesh.id,
      });
    }
    if (index === 4) {
      await addRent({
        residencyId: allocation.residencyId,
        pgId: allocation.pgId,
        month: previous,
        due: allocation.rent,
        paid: 4000,
        method: "CASH",
        recordedById: rajesh.id,
      });
    }
    const currentPaid = index % 3 === 0 ? allocation.rent : index === 2 ? Math.round(allocation.rent / 2) : 0;
    await addRent({
      residencyId: allocation.residencyId,
      pgId: allocation.pgId,
      month: current,
      due: allocation.rent,
      paid: currentPaid,
      recordedById: allocation.pgId === lakeview.id ? meera.id : rajesh.id,
      overdue: currentPaid === 0,
    });
  }

  await addMenu(
    sunrise.id,
    dayKey(0),
    {
      BREAKFAST: ["Idli", "Sambar", "Coconut chutney", "Filter coffee"],
      LUNCH: ["Steamed rice", "Dal tadka", "Beans palya", "Curd", "Papad"],
      SNACKS: ["Masala tea", "Biscuits"],
      DINNER: ["Chapati", "Paneer butter masala", "Jeera rice", "Salad"],
    },
    "Special Sunday dinner: paneer butter masala."
  );
  await addMenu(sunrise.id, dayKey(1), {
    BREAKFAST: ["Poha", "Banana", "Tea"],
    LUNCH: ["Rice", "Rajma curry", "Cabbage poriyal", "Curd"],
    SNACKS: ["Coffee", "Samosa"],
    DINNER: ["Roti", "Mixed vegetable curry", "Dal", "Salad"],
  });
  await addMenu(sunrise.id, dayKey(2), {
    BREAKFAST: ["Dosa", "Chutney", "Sambar"],
    LUNCH: ["Rice", "Kadhi", "Aloo fry", "Curd"],
    SNACKS: ["Tea", "Murukku"],
    DINNER: ["Chapati", "Egg curry", "Rice", "Salad"],
  });
  await addMenu(
    lakeview.id,
    dayKey(0),
    {
      BREAKFAST: ["Upma", "Chutney", "Tea"],
      LUNCH: ["Rice", "Dal", "Palak paneer", "Curd"],
      SNACKS: ["Coffee", "Biscuits"],
      DINNER: ["Roti", "Chole", "Rice", "Salad"],
    },
    "Light dinner today."
  );
  await addMenu(lakeview.id, dayKey(1), {
    BREAKFAST: ["Poha", "Sprouts", "Tea"],
    LUNCH: ["Rice", "Sambar", "Beans curry", "Curd"],
    SNACKS: ["Tea", "Cookies"],
    DINNER: ["Roti", "Paneer tikka", "Dal", "Salad"],
  });
  await addMenu(annexe.id, dayKey(0), {
    BREAKFAST: ["Bread toast", "Eggs", "Coffee"],
    LUNCH: ["Rice", "Chicken curry", "Dal", "Salad"],
    SNACKS: ["Tea", "Fruit"],
    DINNER: ["Chapati", "Dal makhani", "Rice"],
  });

  const wifiComplaint = await prisma.complaint.create({
    data: {
      pgId: sunrise.id,
      residentId: rahul.id,
      residencyId: allocations[0].residencyId,
      category: "WIFI",
      title: "Wi-Fi drops every evening",
      description:
        "The Wi-Fi disconnects for 10–15 minutes every evening around 8 PM. It happens on both the 5 GHz network and the backup router.",
      urgency: "HIGH",
      priority: "HIGH",
      status: "IN_PROGRESS",
      images: JSON.stringify([]),
      createdAt: daysAgo(3),
      updates: {
        create: [
          { authorId: rahul.id, message: "Complaint submitted.", statusTo: "SUBMITTED" },
          { authorId: rajesh.id, message: "Acknowledged. Checking the router logs with the ISP.", statusFrom: "SUBMITTED", statusTo: "ACKNOWLEDGED" },
          { authorId: rajesh.id, message: "ISP engineer visiting tomorrow at 11 AM.", statusFrom: "ACKNOWLEDGED", statusTo: "IN_PROGRESS" },
        ],
      },
    },
  });

  await prisma.complaint.create({
    data: {
      pgId: sunrise.id,
      residentId: sai.id,
      residencyId: allocations[2].residencyId,
      category: "WATER",
      title: "No hot water in the morning",
      description: "Hot water stops by 8:15 AM on the third floor even though the timing says 9 AM.",
      urgency: "MEDIUM",
      priority: "NORMAL",
      status: "RESOLVED",
      images: JSON.stringify([]),
      resolvedAt: daysAgo(6),
      createdAt: daysAgo(9),
      updates: {
        create: [
          { authorId: sai.id, message: "Complaint submitted.", statusTo: "SUBMITTED" },
          { authorId: rajesh.id, message: "Geyser thermostat replaced.", statusFrom: "SUBMITTED", statusTo: "RESOLVED" },
        ],
      },
    },
  });

  await prisma.complaint.create({
    data: {
      pgId: sunrise.id,
      residentId: vikram.id,
      residencyId: allocations[4].residencyId,
      category: "CLEANING",
      title: "Corridor bin not emptied",
      description: "The bin near room 102 has not been emptied for two days.",
      urgency: "LOW",
      priority: "NORMAL",
      status: "SUBMITTED",
      images: JSON.stringify([]),
      createdAt: daysAgo(1),
      updates: { create: [{ authorId: vikram.id, message: "Complaint submitted.", statusTo: "SUBMITTED" }] },
    },
  });

  await prisma.complaint.create({
    data: {
      pgId: lakeview.id,
      residentId: sneha.id,
      residencyId: allocations[6].residencyId,
      category: "ROOM",
      title: "Tube light flickering in G2",
      description: "The tube light flickers constantly and gives me a headache while studying.",
      urgency: "MEDIUM",
      priority: "NORMAL",
      status: "ACKNOWLEDGED",
      images: JSON.stringify([]),
      createdAt: daysAgo(2),
      updates: {
        create: [
          { authorId: sneha.id, message: "Complaint submitted.", statusTo: "SUBMITTED" },
          { authorId: meera.id, message: "Electrician will come tomorrow.", statusFrom: "SUBMITTED", statusTo: "ACKNOWLEDGED" },
        ],
      },
    },
  });

  await prisma.announcement.create({
    data: {
      pgId: sunrise.id,
      authorId: rajesh.id,
      title: "Water tank cleaning on Sunday",
      body: "The overhead tank will be cleaned this Sunday from 10 AM to 1 PM. Please store water if you need it during that window.",
      category: "WATER",
      audience: "ALL",
      createdAt: daysAgo(2),
    },
  });
  await prisma.announcement.create({
    data: {
      pgId: sunrise.id,
      authorId: rajesh.id,
      title: "Rent due reminder",
      body: "Rent for this month is due by the 5th. Pay via UPI to the number shared in the PG information section.",
      category: "RENT",
      audience: "ALL",
      createdAt: daysAgo(5),
    },
  });
  await prisma.announcement.create({
    data: {
      pgId: sunrise.id,
      authorId: rajesh.id,
      title: "First floor corridor painting",
      body: "The first floor corridor will be painted on Saturday. Please keep footwear inside your rooms.",
      category: "MAINTENANCE",
      audience: "FLOOR",
      floorId: (await prisma.floor.findFirstOrThrow({ where: { pgId: sunrise.id, level: 1 } })).id,
      createdAt: daysAgo(1),
    },
  });
  await prisma.announcement.create({
    data: {
      pgId: lakeview.id,
      authorId: meera.id,
      title: "Terrace garden evening access",
      body: "The terrace garden is open every evening from 5 PM to 9 PM. Please keep it tidy.",
      category: "GENERAL",
      audience: "ALL",
      createdAt: daysAgo(4),
    },
  });

  const vacancy = await prisma.bed.findFirstOrThrow({
    where: { room: { pgId: sunrise.id, number: "003" }, label: "C" },
  });
  await prisma.pgInvitation.create({
    data: {
      pgId: sunrise.id,
      floorId: vacancy.roomId ? (await prisma.room.findUniqueOrThrow({ where: { id: vacancy.roomId } })).floorId : "",
      roomId: vacancy.roomId,
      bedId: vacancy.id,
      invitedById: rajesh.id,
      code: "SUNRISE7",
      email: "newresident@example.com",
      phone: "9900114400",
      monthlyRent: 9500,
      status: "PENDING",
      expiresAt: new Date(now.getTime() + 12 * 86400000),
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: rahul.id,
        type: "COMPLAINT",
        title: "Wi-Fi complaint in progress",
        body: "Your Wi-Fi complaint is now in progress. The ISP engineer visits tomorrow.",
        link: "/resident/complaints",
        createdAt: daysAgo(2),
      },
      {
        userId: rahul.id,
        type: "RENT",
        title: "Rent confirmed",
        body: `Your rent for ${current} has been recorded.`,
        link: "/resident/rent",
        createdAt: daysAgo(4),
      },
      {
        userId: rahul.id,
        type: "ANNOUNCEMENT",
        title: "Water tank cleaning on Sunday",
        body: "Water supply will pause 10 AM – 1 PM on Sunday.",
        link: "/resident/announcements",
        createdAt: daysAgo(2),
      },
      {
        userId: rajesh.id,
        type: "COMPLAINT",
        title: "New complaint from Vikram",
        body: "Corridor bin not emptied near room 102.",
        link: "/owner/complaints",
        createdAt: daysAgo(1),
      },
      {
        userId: admin.id,
        type: "APPROVAL",
        title: "Owner awaiting approval",
        body: "Priya Sharma registered as a PG owner.",
        link: "/admin/owners",
        createdAt: daysAgo(3),
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: rajesh.id,
        action: "RESIDENT_ADDED",
        entityType: "Residency",
        entityId: allocations[0].residencyId,
        description: "Rajesh Kumar added Rahul Verma to Sunrise Residency room 101",
        createdAt: daysAgo(74),
      },
      {
        actorId: rajesh.id,
        action: "RENT_PAID",
        entityType: "RentRecord",
        description: "Rajesh Kumar recorded ₹12500 rent from Rahul Verma",
        createdAt: daysAgo(9),
      },
      {
        actorId: meera.id,
        action: "COMPLAINT_UPDATED",
        entityType: "Complaint",
        entityId: wifiComplaint.id,
        description: "Meera Nair updated a complaint at Lakeview Girls PG",
        createdAt: daysAgo(2),
      },
      {
        actorId: admin.id,
        action: "PG_STATUS_CHANGED",
        entityType: "Pg",
        entityId: lakeview.id,
        description: "Lakeview Girls PG set to VERIFIED",
        createdAt: daysAgo(30),
      },
    ],
  });

  await prisma.appSetting.createMany({
    data: [
      { key: "platformName", value: "PG Manager" },
      { key: "supportEmail", value: "support@pgmanager.app" },
      { key: "supportPhone", value: "+91 80 4567 8900" },
      { key: "autoApproveOwners", value: "false" },
      { key: "maintenanceMode", value: "false" },
    ],
  });

  console.log("Seeded demo data.");
  console.log("  Admin     admin@pgmanager.app / Password@123");
  console.log("  Owner     owner@sunriseresidency.in / Password@123");
  console.log("  Owner     owner@lakesidepg.in / Password@123");
  console.log("  Resident  rahul@example.com / Password@123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
