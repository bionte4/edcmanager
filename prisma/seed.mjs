/**
 * Self-contained dummy seed (no imports from src/) — safe for Docker runner.
 * Run: node prisma/seed.mjs   OR   npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "edc123";
const DEMO_AS_OF = new Date("2026-09-17T07:00:00.000Z");

const __dirname = dirname(fileURLToPath(import.meta.url));
const levelA = JSON.parse(
  readFileSync(
    join(__dirname, "../src/config/data/locations-level-a.json"),
    "utf8"
  )
);

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

const ZONE_ALIASES = [
  {
    id: "loc-dalam-kota",
    code: "DALAM_KOTA",
    label: "Dalam Kota (alias zona)",
    slaZone: "DALAM_KOTA",
    description: "Legacy/OLA — jangan dipakai di tiket baru",
    sortOrder: 1,
    isTicketSelectable: false,
  },
  {
    id: "loc-luar-kota",
    code: "LUAR_KOTA",
    label: "Luar Kota (alias zona)",
    slaZone: "LUAR_KOTA",
    description: "Legacy/OLA — jangan dipakai di tiket baru",
    sortOrder: 2,
    isTicketSelectable: false,
  },
  {
    id: "loc-luar-pulau",
    code: "LUAR_PULAU",
    label: "Luar Pulau (alias zona)",
    slaZone: "LUAR_PULAU",
    description: "Legacy/OLA — jangan dipakai di tiket baru",
    sortOrder: 3,
    isTicketSelectable: false,
  },
];

const LOCATIONS = [
  ...ZONE_ALIASES,
  ...levelA.sites.map((s) => ({
    id: `loc-${s.code.toLowerCase().replace(/_/g, "-")}`,
    code: s.code,
    label: s.label,
    slaZone: s.slaZone,
    regionalOffice: s.regionalOffice,
    sortOrder: s.sortOrder,
    isTicketSelectable: true,
  })),
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
    ["u-tech-2", "Rina Teknisi", "rina.tech@edc.local", "0812-4444-0002", "VENDOR_TECH"],
    ["u-tech-3", "Agus Teknisi", "agus.tech@edc.local", "0812-4444-0003", "VENDOR_TECH"],
    ["u-tech-4", "Maya Teknisi", "maya.tech@edc.local", "0812-4444-0004", "VENDOR_TECH"],
    ["u-lo-1", "Farah Liaison", "farah.lo@edc.local", "0812-3333-0001", "LIAISON"],
    ["u-lo-2", "Gilang Liaison", "gilang.lo@edc.local", "0812-3333-0002", "LIAISON"],
  ];
  for (const [id, name, email, phone, role] of users) {
    const techCoverage =
      email === "eko.tech@edc.local"
        ? {
            homeRosJson: JSON.stringify(["RO Jakarta 1", "RO Bandung"]),
            standbyField: true,
          }
        : email === "rina.tech@edc.local"
          ? {
              homeRosJson: JSON.stringify([
                "RO Surabaya",
                "RO Semarang",
                "RO Denpasar",
              ]),
              standbyField: true,
            }
          : email === "agus.tech@edc.local"
            ? {
                homeRosJson: JSON.stringify(["RO Medan", "RO Palembang"]),
                standbyField: false,
              }
            : email === "maya.tech@edc.local"
              ? {
                  homeRosJson: JSON.stringify([
                    "RO Makassar",
                    "RO Manado",
                    "RO Jayapura",
                    "RO Balikpapan",
                    "RO Pontianak",
                  ]),
                  standbyField: false,
                }
              : { homeRosJson: "[]", standbyField: false };

    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role,
        phone,
        passwordHash: DEMO_PASSWORD,
        isActive: true,
        deletedAt: null,
        homeRosJson: techCoverage.homeRosJson,
        standbyField: techCoverage.standbyField,
      },
      create: {
        id,
        name,
        email,
        phone,
        role,
        passwordHash: DEMO_PASSWORD,
        isActive: true,
        homeRosJson: techCoverage.homeRosJson,
        standbyField: techCoverage.standbyField,
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
        description: loc.description ?? null,
        sortOrder: loc.sortOrder,
        isActive: true,
        isTicketSelectable: loc.isTicketSelectable ?? true,
      },
      create: {
        id: loc.id,
        code: loc.code,
        label: loc.label,
        slaZone: loc.slaZone,
        regionalOffice: loc.regionalOffice ?? null,
        description: loc.description ?? null,
        sortOrder: loc.sortOrder,
        isActive: true,
        isTicketSelectable: loc.isTicketSelectable ?? true,
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

  // Monthly MetricLog for executive SLA trend (last 6 months through Sep 2026)
  const metricMonths = [
    // [yyyy, mm(1-12), v1: [uptime, total, breached], v2: [...]]
    [2026, 4, [99.9, 110, 10], [99.82, 98, 12]],
    [2026, 5, [99.91, 118, 9], [99.84, 105, 11]],
    [2026, 6, [99.92, 125, 8], [99.85, 112, 10]],
    [2026, 7, [99.93, 130, 7], [99.85, 118, 10]],
    [2026, 8, [99.94, 136, 6], [99.86, 122, 9]],
    [2026, 9, [99.94, 142, 5], [99.86, 128, 11]],
  ];
  for (const [year, monthNum, v1, v2] of metricMonths) {
    const date = new Date(Date.UTC(year, monthNum - 1, 1));
    for (const [vendorId, uptime, total, breached] of [
      ["v1", ...v1],
      ["v2", ...v2],
    ]) {
      await prisma.metricLog.upsert({
        where: { vendorId_date: { vendorId, date } },
        update: {
          uptimePercent: uptime,
          metTarget: uptime >= 99.9,
          totalTickets: total,
          resolvedTickets: total - breached,
          breachedTickets: breached,
        },
        create: {
          vendorId,
          date,
          uptimePercent: uptime,
          targetPercent: 99.9,
          metTarget: uptime >= 99.9,
          totalTickets: total,
          resolvedTickets: total - breached,
          breachedTickets: breached,
        },
      });
    }
  }

  const shiftDate = new Date("2026-09-17T00:00:00.000Z");
  const shifts = [
    ["s1", "u-noc-1", "MORNING"],
    ["s2", "u-noc-2", "MORNING"],
    ["s3", "u-sup-1", "MORNING"],
    ["s4", "u-noc-3", "AFTERNOON"],
    ["s5", "u-noc-1", "NIGHT"],
    ["s-lo-1", "u-lo-1", "DAY_DOG"],
    ["s-lo-2", "u-lo-2", "NIGHT_DOG"],
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

  // Sample LO handover for demo date
  if ((await prisma.handoverLog.count()) === 0) {
    await prisma.handoverLog.create({
      data: {
        shiftDate,
        fromShiftType: "DAY_DOG",
        toShiftType: "NIGHT_DOG",
        fromUserId: "u-lo-1",
        toUserId: "u-lo-2",
        summary:
          "Handover DOG: pantau VIP Dalam Kota yang mendekati SLA; koordinasi BRI hold merchant MID-102938.",
        openTickets: ["INC-2026-8841"],
      },
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
        location: "JKT_SELATAN",
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
        vendorId: "v2",
        nocOwnerId: "u-noc-2",
        createdById: "u-noc-2",
      },
    });
    await prisma.ticket.create({
      data: {
        id: "t4",
        ticketNumber: "INC-2026-8846",
        merchantId: "MID-330119",
        location: "DPS_BALI",
        category: "VIP",
        status: "IN_PROGRESS",
        slaStatus: "ON_TRACK",
        openedAt: new Date(DEMO_AS_OF.getTime() - 5 * 60 * 60 * 1000),
        description: "Signal lemah — merchant beach club",
        technicianName: "Teknisi Dist C",
        vendorId: "v2",
        nocOwnerId: "u-noc-1",
        createdById: "u-noc-2",
      },
    });
    await prisma.ticket.create({
      data: {
        id: "t5",
        ticketNumber: "INC-2026-8847",
        merchantId: "MID-220881",
        location: "SBY_PUSAT",
        category: "NON_VIP",
        status: "ACKNOWLEDGED",
        slaStatus: "WARNING",
        openedAt: new Date(DEMO_AS_OF.getTime() - 10 * 60 * 60 * 1000),
        acknowledgedAt: new Date(DEMO_AS_OF.getTime() - 9 * 60 * 60 * 1000),
        description: "Paper jam berulang",
        vendorId: "v1",
        createdById: "u-noc-1",
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

  await prisma.integrationClient.upsert({
    where: { apiKey: "edc_sk_demo_monitoring_change_me" },
    update: {
      isActive: true,
      scopes: "monitoring:ingest,tickets:read",
      externalSystem: "uptime-monitor",
      name: "EDC Uptime Monitor",
    },
    create: {
      id: "ic-monitor-1",
      name: "EDC Uptime Monitor",
      apiKey: "edc_sk_demo_monitoring_change_me",
      scopes: "monitoring:ingest,tickets:read",
      externalSystem: "uptime-monitor",
      isActive: true,
    },
  });

  // Sample PM campaign run marker (tickets generated on demand via UI/cron)
  await prisma.pmCampaignRun.upsert({
    where: {
      kind_periodKey: { kind: "PM_MONTHLY", periodKey: "2026-09" },
    },
    update: {},
    create: {
      kind: "PM_MONTHLY",
      periodKey: "2026-09",
      status: "DONE",
      ticketCount: 0,
      metaJson: JSON.stringify({ note: "Seed placeholder — generate via /ops/campaigns" }),
    },
  });

  const peakDefaults = [
    {
      id: "peak-tb-2026",
      kind: "TAHUN_BARU",
      name: "Tahun Baru",
      startDate: "2025-12-28",
      endDate: "2026-01-05",
      alertLeadDays: 7,
      bufferFloorPercent: 15,
      sortOrder: 10,
      checklist: [
        "Naikkan buffer stock target RO metropolitan ke ≥15%",
        "Standby LO DOG full coverage malam tahun baru",
        "Prioritas VIP Dalam Kota — pantau near-breach tiap jam",
        "Siapkan pooling unit idle antar RO Jabodetabek",
      ],
    },
    {
      id: "peak-lebaran-2026",
      kind: "LEBARAN",
      name: "Lebaran / Idul Fitri",
      startDate: "2026-03-15",
      endDate: "2026-03-28",
      alertLeadDays: 14,
      bufferFloorPercent: 15,
      sortOrder: 20,
      checklist: [
        "Pre-position buffer di RO transit mudik (Bandung, Semarang, Surabaya)",
        "Batasi PM non-kritis selama H-3 s/d H+3",
        "Eskalasi LO untuk merchant mall/rest area",
        "Koordinasi BRI hold clock-stop force majeure mudik",
      ],
    },
    {
      id: "peak-natal-2026",
      kind: "NATAL",
      name: "Natal",
      startDate: "2026-12-20",
      endDate: "2026-12-27",
      alertLeadDays: 10,
      bufferFloorPercent: 12,
      sortOrder: 30,
      checklist: [
        "Intensifikasi monitoring uptime mall & F&B",
        "Roster LO + NOC overlapping shift malam Natal",
        "Pastikan spare thermal/paper peripheral di RO besar",
        "Near-breach digest 2× sehari (12:00 & 16:00)",
      ],
    },
  ];
  for (const w of peakDefaults) {
    await prisma.peakSeasonWindow.upsert({
      where: {
        kind_startDate: { kind: w.kind, startDate: w.startDate },
      },
      update: {
        name: w.name,
        endDate: w.endDate,
        alertLeadDays: w.alertLeadDays,
        bufferFloorPercent: w.bufferFloorPercent,
        checklistJson: JSON.stringify(w.checklist),
        sortOrder: w.sortOrder,
        isActive: true,
      },
      create: {
        id: w.id,
        kind: w.kind,
        name: w.name,
        startDate: w.startDate,
        endDate: w.endDate,
        alertLeadDays: w.alertLeadDays,
        bufferFloorPercent: w.bufferFloorPercent,
        checklistJson: JSON.stringify(w.checklist),
        sortOrder: w.sortOrder,
        isActive: true,
      },
    });
  }

  const allRos = [
    "RO Jakarta 1",
    "RO Bandung",
    "RO Semarang",
    "RO Surabaya",
    "RO Medan",
    "RO Palembang",
    "RO Denpasar",
    "RO Makassar",
    "RO Balikpapan",
    "RO Pontianak",
    "RO Manado",
    "RO Jayapura",
  ];
  await prisma.pmSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      generateDayOfMonth: 1,
      warningDaysBeforeMonthEnd: 5,
      activeRosJson: JSON.stringify(allRos),
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
