/**
 * Self-contained dummy seed (no imports from src/) — safe for Docker runner.
 * Run: node prisma/seed.mjs   OR   npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "edc123";
const DEMO_AS_OF = new Date("2026-09-17T07:00:00.000Z");

const CATEGORIES = [
  {
    id: "cat-vip",
    code: "VIP",
    label: "VIP",
    slaProfile: "VIP",
    description: "Merchant prioritas — peak Dalam Kota 2 jam",
    sortOrder: 10,
  },
  {
    id: "cat-non-vip",
    code: "NON_VIP",
    label: "Non-VIP",
    slaProfile: "NON_VIP",
    description: "Merchant standar",
    sortOrder: 20,
  },
];

const LOCATIONS = [
  {
    id: "loc-dalam-kota",
    code: "DALAM_KOTA",
    label: "Dalam Kota (zona)",
    slaZone: "DALAM_KOTA",
    description: "Alias zona — SLA peak VIP 2 jam",
    sortOrder: 10,
  },
  {
    id: "loc-luar-kota",
    code: "LUAR_KOTA",
    label: "Luar Kota (zona)",
    slaZone: "LUAR_KOTA",
    description: "Alias zona SLA luar kota",
    sortOrder: 20,
  },
  {
    id: "loc-luar-pulau",
    code: "LUAR_PULAU",
    label: "Luar Pulau (zona)",
    slaZone: "LUAR_PULAU",
    description: "Alias zona SLA luar pulau",
    sortOrder: 30,
  },
  {
    id: "loc-jkt-pusat",
    code: "JKT_PUSAT",
    label: "Jakarta Pusat",
    slaZone: "DALAM_KOTA",
    regionalOffice: "RO Jakarta 1",
    description: "Contoh lokasi dalam kota",
    sortOrder: 40,
  },
  {
    id: "loc-bdg",
    code: "BDG_KOTA",
    label: "Bandung Kota",
    slaZone: "LUAR_KOTA",
    regionalOffice: "RO Bandung",
    description: "Contoh lokasi luar kota",
    sortOrder: 50,
  },
  {
    id: "loc-dps",
    code: "DPS_BALI",
    label: "Denpasar Bali",
    slaZone: "LUAR_PULAU",
    regionalOffice: "RO Denpasar",
    description: "Contoh lokasi luar pulau",
    sortOrder: 60,
  },
];

const OLA = [
  {
    id: "ola-ack-vip-dk",
    name: "Ack · Incident VIP Dalam Kota",
    stage: "ACKNOWLEDGE",
    limitMinutes: 15,
    itsmType: "INCIDENT",
    location: "DALAM_KOTA",
    category: "VIP",
    priority: 90,
  },
  {
    id: "ola-ack-vip",
    name: "Ack · Incident VIP",
    stage: "ACKNOWLEDGE",
    limitMinutes: 20,
    itsmType: "INCIDENT",
    category: "VIP",
    priority: 80,
  },
  {
    id: "ola-ack-default",
    name: "Ack · Default",
    stage: "ACKNOWLEDGE",
    limitMinutes: 30,
    priority: 10,
  },
  {
    id: "ola-disp-vip-dk",
    name: "Dispatch · Incident VIP Dalam Kota",
    stage: "DISPATCH",
    limitMinutes: 30,
    itsmType: "INCIDENT",
    location: "DALAM_KOTA",
    category: "VIP",
    priority: 90,
  },
  {
    id: "ola-disp-vip",
    name: "Dispatch · Incident VIP",
    stage: "DISPATCH",
    limitMinutes: 45,
    itsmType: "INCIDENT",
    category: "VIP",
    priority: 80,
  },
  {
    id: "ola-disp-default",
    name: "Dispatch · Default",
    stage: "DISPATCH",
    limitMinutes: 60,
    priority: 10,
  },
];

const ROS = ["RO Jakarta 1", "RO Bandung", "RO Surabaya", "RO Denpasar"];

async function main() {
  console.log("[seed] starting…");

  await prisma.vendor.upsert({
    where: { id: "v1" },
    update: {},
    create: {
      id: "v1",
      name: "Vendor 1",
      contactName: "Budi FMS",
      contactEmail: "budi@vendor1.local",
      contactPhone: "0812-1000-0001",
      type: "FMS",
      allocationQuota: 1200,
    },
  });
  await prisma.vendor.upsert({
    where: { id: "v2" },
    update: {},
    create: {
      id: "v2",
      name: "Vendor 2",
      contactName: "Ani Dist",
      contactEmail: "ani@vendor2.local",
      contactPhone: "0812-1000-0002",
      type: "DISTRIBUTOR",
      allocationQuota: 900,
    },
  });

  const users = [
    ["u-admin-1", "Admin Sistem", "admin@edc.local", "0812-0000-0001", "ADMIN"],
    ["u-noc-1", "Andi Pratama", "andi.noc@edc.local", "0812-1111-0001", "NOC"],
    ["u-noc-2", "Siti Rahma", "siti.noc@edc.local", "0812-1111-0002", "NOC"],
    ["u-noc-3", "Budi Santoso", "budi.noc@edc.local", "0812-1111-0003", "NOC"],
    ["u-sup-1", "Dewi Lestari", "dewi.supervisor@edc.local", "0812-2222-0001", "SUPERVISOR"],
    ["u-ops-1", "Rudi Hartono", "rudi.ops@edc.local", null, "OPS_MANAGER"],
    ["u-gm-1", "Hendra Wijaya", "hendra.gm@edc.local", "0812-9999-0001", "GM"],
    ["u-tech-1", "Eko Teknisi", "eko.tech@edc.local", null, "VENDOR_TECH"],
  ];
  for (const [id, name, email, phone, role] of users) {
    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role,
        phone,
        passwordHash: DEMO_PASSWORD,
        isActive: true,
        deletedAt: null,
      },
      create: {
        id,
        name,
        email,
        phone,
        role,
        passwordHash: DEMO_PASSWORD,
        isActive: true,
      },
    });
  }

  for (const c of CATEGORIES) {
    await prisma.ticketCategoryDef.upsert({
      where: { code: c.code },
      update: {
        label: c.label,
        slaProfile: c.slaProfile,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: true,
      },
      create: { ...c, isActive: true },
    });
  }

  for (const loc of LOCATIONS) {
    await prisma.locationDef.upsert({
      where: { code: loc.code },
      update: {
        label: loc.label,
        slaZone: loc.slaZone,
        regionalOffice: loc.regionalOffice ?? null,
        description: loc.description,
        sortOrder: loc.sortOrder,
        isActive: true,
      },
      create: {
        id: loc.id,
        code: loc.code,
        label: loc.label,
        slaZone: loc.slaZone,
        regionalOffice: loc.regionalOffice ?? null,
        description: loc.description,
        sortOrder: loc.sortOrder,
        isActive: true,
      },
    });
  }

  for (const p of OLA) {
    await prisma.olaPolicy.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        stage: p.stage,
        limitMinutes: p.limitMinutes,
        itsmType: p.itsmType ?? "*",
        location: p.location ?? "*",
        category: p.category ?? "*",
        process: "*",
        priority: p.priority,
        isActive: true,
      },
      create: {
        id: p.id,
        name: p.name,
        stage: p.stage,
        limitMinutes: p.limitMinutes,
        warningThreshold: 0.8,
        itsmType: p.itsmType ?? "*",
        location: p.location ?? "*",
        category: p.category ?? "*",
        process: "*",
        priority: p.priority,
        isActive: true,
      },
    });
  }

  const units = [
    ["asset-1", "ING-JKT-10021", "Ingenico", "RO Jakarta 1", "BUFFER", "v1", null],
    ["asset-2", "VRF-JKT-10088", "Verifone", "RO Jakarta 1", "DEPLOYED", "v1", "MID-102938"],
    ["asset-3", "PAX-BDG-20011", "PAX", "RO Bandung", "BUFFER", "v2", null],
    ["asset-4", "ING-SBY-30044", "Ingenico", "RO Surabaya", "IDLE", "v1", null],
    ["asset-5", "CST-DPS-40002", "Castles", "RO Denpasar", "DEPLOYED", "v2", "MID-330119"],
  ];
  for (const [id, serialNumber, brand, regionalOffice, status, vendorId, merchantId] of units) {
    await prisma.edcUnit.upsert({
      where: { serialNumber },
      update: { status, regionalOffice, vendorId, merchantId },
      create: {
        id,
        serialNumber,
        brand,
        regionalOffice,
        status,
        vendorId,
        merchantId,
      },
    });
  }

  const month = new Date("2026-09-01T00:00:00.000Z");
  for (const [vendorId, uptime, total, breached, met] of [
    ["v1", 99.94, 142, 5, true],
    ["v2", 99.86, 128, 11, false],
  ]) {
    await prisma.metricLog.upsert({
      where: { vendorId_date: { vendorId, date: month } },
      update: {},
      create: {
        vendorId,
        date: month,
        uptimePercent: uptime,
        targetPercent: 99.9,
        metTarget: met,
        totalTickets: total,
        resolvedTickets: total - breached,
        breachedTickets: breached,
      },
    });
  }

  const shiftDate = new Date("2026-09-17T00:00:00.000Z");
  const shifts = [
    ["s1", "u-noc-1", "MORNING"],
    ["s2", "u-noc-2", "MORNING"],
    ["s3", "u-sup-1", "MORNING"],
    ["s4", "u-noc-3", "AFTERNOON"],
    ["s5", "u-noc-1", "NIGHT"],
  ];
  for (const [id, userId, shiftType] of shifts) {
    await prisma.nocShift.upsert({
      where: {
        userId_shiftDate_shiftType: { userId, shiftDate, shiftType },
      },
      update: { status: "SCHEDULED" },
      create: { id, userId, shiftDate, shiftType, status: "SCHEDULED" },
    });
  }

  if ((await prisma.ticket.count()) === 0) {
    await prisma.ticket.create({
      data: {
        id: "t1",
        ticketNumber: "INC-2026-8841",
        itsmType: "INCIDENT",
        process: "CM",
        merchantId: "MID-102938",
        location: "JKT_PUSAT",
        category: "VIP",
        status: "IN_PROGRESS",
        slaStatus: "WARNING",
        openedAt: new Date(DEMO_AS_OF.getTime() - 100 * 60 * 1000),
        acknowledgedAt: new Date(DEMO_AS_OF.getTime() - 95 * 60 * 1000),
        dispatchedAt: new Date(DEMO_AS_OF.getTime() - 90 * 60 * 1000),
        description: "EDC offline — merchant VIP mall",
        technicianName: "Teknisi FMS A",
        vendorId: "v1",
        nocOwnerId: "u-noc-1",
        createdById: "u-noc-2",
        activities: {
          create: [
            {
              id: "a1",
              activityType: "CREATED",
              note: "Incident CM dari monitoring",
              actorId: "u-noc-2",
              toStatus: "OPEN",
              createdAt: new Date(DEMO_AS_OF.getTime() - 100 * 60 * 1000),
            },
          ],
        },
      },
    });
    await prisma.ticket.create({
      data: {
        id: "t2",
        ticketNumber: "INC-2026-8842",
        merchantId: "MID-558201",
        location: "JKT_PUSAT",
        category: "VIP",
        status: "OPEN",
        slaStatus: "ON_TRACK",
        openedAt: new Date(DEMO_AS_OF.getTime() - 40 * 60 * 1000),
        description: "Printer EDC error",
        vendorId: "v1",
        createdById: "u-noc-2",
      },
    });
    await prisma.ticket.create({
      data: {
        id: "t3",
        ticketNumber: "INC-2026-8845",
        merchantId: "MID-990012",
        location: "BDG_KOTA",
        category: "NON_VIP",
        status: "DISPATCHED",
        slaStatus: "BREACHED",
        openedAt: new Date(DEMO_AS_OF.getTime() - 250 * 60 * 1000),
        description: "Kartu tidak terbaca",
        technicianName: "Teknisi Dist B",
        vendorId: "v1",
        nocOwnerId: "u-noc-2",
        createdById: "u-noc-2",
      },
    });
  }

  const skus = [
    ["sku-cable-usb", "CBL-USB-1M", "Kabel USB EDC 1m", "CABLE", "pcs", 50],
    ["sku-paper-57", "PPR-57MM", "Kertas thermal 57mm", "PAPER_ROLL", "roll", 200],
    ["sku-sim-xl", "SIM-XL-DATA", "SIM XL Data M2M", "SIM_CARD", "pcs", 30],
  ];
  for (const [id, skuCode, name, category, unit, minStock] of skus) {
    await prisma.peripheralSku.upsert({
      where: { skuCode },
      update: { name, minStock, isActive: true },
      create: { id, skuCode, name, category, unit, minStock, isActive: true },
    });
  }
  const qty = {
    "RO Jakarta 1": [80, 320, 60],
    "RO Bandung": [18, 90, 25],
    "RO Surabaya": [45, 150, 28],
    "RO Denpasar": [12, 40, 10],
  };
  for (const ro of ROS) {
    const q = qty[ro] || [10, 20, 5];
    for (let i = 0; i < skus.length; i++) {
      const skuId = skus[i][0];
      await prisma.peripheralBalance.upsert({
        where: { skuId_regionalOffice: { skuId, regionalOffice: ro } },
        update: { quantity: q[i] },
        create: { skuId, regionalOffice: ro, quantity: q[i] },
      });
    }
  }

  await prisma.integrationClient.upsert({
    where: { apiKey: "edc-demo-api-key-change-me" },
    update: { isActive: true },
    create: {
      id: "ic-demo-1",
      name: "Demo External NOC",
      apiKey: "edc-demo-api-key-change-me",
      scopes: "tickets:read,tickets:write",
      externalSystem: "demo-external",
      isActive: true,
    },
  });

  console.log("[seed] done");
}

main()
  .catch((e) => {
    console.error("[seed] failed", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
