# EDC Manager — Entity Relationship Diagram (ERD)

Sumber kebenaran: `prisma/schema.prisma` (PostgreSQL produksi).

Terkait: [Manual](./MANUAL.md) · [README](../README.md) · [Deploy VPS](./DEPLOY-VPS.md)

---

## 1. Ringkasan domain

```text
User / RBAC
  ├── NocShift (NOC 3-shift + LO DAY_DOG/NIGHT_DOG)
  ├── HandoverLog (LO DOG)
  ├── Ticket (nocOwner / createdBy)
  │     ├── TicketActivity
  │     └── SlaPauseInterval (clock-stop + approval)
  ├── AttendanceLog / ShiftSwapRequest (WFM)
  └── AuditLog

Vendor ── EdcUnit ── EdcMutationHistory
   │          └── Ticket (optional)
   └── MetricLog (uptime 99.9%)

Masters: LocationDef · TicketCategoryDef · OlaPolicy · PeakSeasonWindow · PmSettings
Integrasi: IntegrationClient · IngestEvent · NotificationLog · AiInsight
Kampanye: PmCampaignRun
Peripherals: PeripheralSku / Balance / Mutation
```

**SLA** = `location` + `category` + `itsmType` + `openedAt`/`closedAt` − pause **APPROVED/NOT_REQUIRED**.  
**OLA** = `acknowledgedAt` / `dispatchedAt` + `OlaPolicy` match.  
**Dispatch** = skor dari open load + `User.homeRos` + `User.standbyField` (rasio 1:25 di config).

---

## 2. ERD inti

```mermaid
erDiagram
  User ||--o{ NocShift : roster
  User ||--o{ Ticket : nocOwner
  User ||--o{ Ticket : createdBy
  User ||--o{ TicketActivity : actor
  User ||--o{ SlaPauseInterval : startedBy
  User ||--o{ SlaPauseInterval : endedBy
  User ||--o{ SlaPauseInterval : approvedBy
  User ||--o{ HandoverLog : from
  User ||--o{ HandoverLog : to
  User ||--o{ AttendanceLog : punch
  User ||--o{ ShiftSwapRequest : requester
  User ||--o{ AuditLog : actor

  Vendor ||--o{ EdcUnit : owns
  Vendor ||--o{ Ticket : handles
  Vendor ||--o{ MetricLog : daily

  EdcUnit ||--o{ EdcMutationHistory : mutations
  EdcUnit ||--o{ Ticket : optional

  Ticket ||--o{ TicketActivity : timeline
  Ticket ||--o{ SlaPauseInterval : pauses
  Ticket ||--o{ Ticket : problemId
  Ticket ||--o{ Ticket : relatedChangeId

  Permission ||--o{ RolePermission : grants

  User {
    string id PK
    string email UK
    enum role
    boolean isActive
    string homeRosJson
    boolean standbyField
  }

  NocShift {
    string id PK
    string userId FK
    date shiftDate
    enum shiftType
    enum status
  }

  HandoverLog {
    string id PK
    date shiftDate
    enum fromShiftType
    enum toShiftType
    string fromUserId FK
    string toUserId FK
    string summary
    string openTickets
  }

  Ticket {
    string id PK
    string ticketNumber UK
    enum itsmType
    enum process
    string merchantId
    string location
    string category
    enum status
    enum slaStatus
    datetime openedAt
    datetime closedAt
    string vendorId FK
    string edcUnitId FK
    string externalSystem
    string externalTicketId
  }

  SlaPauseInterval {
    string id PK
    string ticketId FK
    string reasonCode
    enum approvalStatus
    datetime startedAt
    datetime endedAt
    string approvedById FK
  }

  TicketActivity {
    string id PK
    string ticketId FK
    enum activityType
    string note
  }

  IngestEvent {
    string id PK
    string sourceSystem
    string externalEventId
    string outcome
    string ticketId
  }

  PmCampaignRun {
    string id PK
    string kind
    string periodKey
    int ticketCount
    string status
  }

  PeakSeasonWindow {
    string id PK
    string kind
    string name
    string startDate
    string endDate
    int bufferFloorPercent
    boolean isActive
  }

  PmSettings {
    string id PK
    int generateDayOfMonth
    string activeRosJson
  }

  IntegrationClient {
    string id PK
    string apiKey UK
    string scopes
    string externalSystem
  }

  LocationDef {
    string id PK
    string code UK
    enum slaZone
    string regionalOffice
    boolean isTicketSelectable
  }

  OlaPolicy {
    string id PK
    enum stage
    int limitMinutes
    int priority
  }

  MetricLog {
    string id PK
    string vendorId FK
    date date
    decimal uptimePercent
  }
```

---

## 3. Relasi kunci

| Dari | Ke | Catatan |
|------|-----|---------|
| User | NocShift | Unique `(userId, shiftDate, shiftType)` — NOC + LO |
| User | HandoverLog | From / To LO shift |
| Ticket | SlaPauseInterval | Pause efektif hanya `NOT_REQUIRED` / `APPROVED` |
| Ticket | external | Unique `(externalSystem, externalTicketId)` — dedup API/PM/monitoring |
| Vendor | MetricLog | Unique `(vendorId, date)` |
| IngestEvent | — | Unique `(sourceSystem, externalEventId)` |
| PmCampaignRun | — | Unique `(kind, periodKey)` — `PM_MONTHLY` / `PEAK_INTENSIFY` |
| PeakSeasonWindow | — | Unique `(kind, startDate)` — multi-tahun |
| PmSettings | — | Singleton `id=default` — hari generate + RO aktif |
| User | homeRos / standby | Coverage dispatch untuk `VENDOR_TECH` |

### Enum penting

- **UserRole:** `ADMIN` · `NOC` · `SUPERVISOR` · `VENDOR_TECH` · `OPS_MANAGER` · `GM` · `LIAISON`
- **ShiftType:** `MORNING` · `AFTERNOON` · `NIGHT` · `DAY_DOG` · `NIGHT_DOG`
- **SlaPauseApprovalStatus:** `NOT_REQUIRED` · `PENDING` · `APPROVED` · `REJECTED`
- **TicketActivityType:** termasuk `CLOCK_*`, `HANDOVER`, `ESCALATED`, …
- **ItsmType / Process:** `INCIDENT`/`CM`, `REQUEST`/`PM`, …
- **TicketStatus:** `OPEN` → … → `CLOSED`
- **SlaStatus:** `ON_TRACK` · `WARNING` · `ACHIEVED` · `BREACHED`

---

## 4. Modul ops tambahan (data flow)

```mermaid
flowchart TB
  Mon[Monitoring webhook] -->|IngestEvent| Rule{CRITICAL/MAJOR?}
  Rule -->|yes| Inc[createIntegrationTicket INCIDENT]
  Rule -->|no| Ign[IGNORED log]

  CronPM[cron pm-monthly] -->|hari = PmSettings| PmRun[PmCampaignRun]
  PmSettings[PmSettings RO aktif] --> PmRun
  PmRun --> Req[REQUEST + PM per RO aktif]

  PeakDB[PeakSeasonWindow] --> Eval[evaluate peak]
  CronPeak[cron peak-intensify] --> Eval
  Eval --> PeakRun[PmCampaignRun PEAK]
  PeakRun --> Mail[Notification DIGEST]

  Ticket --> Pause[SlaPauseInterval]
  Pause -->|PENDING| Wait[Supervisor approve]
  Wait -->|APPROVED| Stop[Clock stopped]

  User -->|homeRos standby| Suggest[dispatch-store score]
  Ticket --> Suggest
  Suggest --> Tech[VENDOR_TECH pick]
```

---

## 5. SLA vs OLA vs clock-stop

```mermaid
flowchart LR
  O[openedAt] --> Wall[Wall elapsed]
  Wall --> Pause[− pausedMs efektif]
  Pause --> SLA[SLA badge]
  O --> OLA1[OLA ACK]
  A[acknowledgedAt] --> OLA2[OLA DISP]
```

- **SLA** — kontrak / penalti.  
- **OLA** — jam internal NOC/vendor.  
- **Clock-stop** — hold BRI; sensitif butuh approval sebelum timer berhenti.

---

## 6. Buffer stock

\[
\text{buffer\%} = \frac{\text{count(BUFFER)}}{\text{total units RO}} \times 100
\]

Ambang: **≥ 10%** (`inventory.config`). Peak season guidance bisa 12–15% (per window di `PeakSeasonWindow.bufferFloorPercent`).

---

## 7. Validasi schema

```bash
npm run db:validate
npm run db:generate
npm run db:push
npm run db:seed
```
