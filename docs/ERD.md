# EDC Manager — Entity Relationship Diagram (ERD)

Diagram berbasis `prisma/schema.prisma` (sumber kebenaran untuk PostgreSQL produksi), ditambah catatan entitas runtime demo yang belum sepenuhnya di-persist.

Dokumentasi terkait: [Manual Guide](./MANUAL.md) · [README](../README.md)

---

## 1. Ringkasan domain

```text
User / RBAC ──► Ticket lifecycle + Activity
     │                │
     ├── NocShift     ├── Vendor ◄── MetricLog
     │                └── EdcUnit ◄── MutationHistory
     │
NotificationLog / AiInsight (advisory)
```

**SLA** dihitung dari Ticket (`location`, `category`, `openedAt`, `closedAt`, `itsmType`).  
**OLA** (runtime) memakai `acknowledgedAt` / `dispatchedAt` + policy match (lihat §4).

---

## 2. ERD inti (Prisma)

```mermaid
erDiagram
  User ||--o{ NocShift : "has roster"
  User ||--o{ Ticket : "nocOwner"
  User ||--o{ Ticket : "createdBy"
  User ||--o{ TicketActivity : "actor"
  User ||--o{ AuditLog : "actor"

  Permission ||--o{ RolePermission : "grants"
  RolePermission }o--|| Permission : "permissionId"

  Vendor ||--o{ EdcUnit : "owns"
  Vendor ||--o{ Ticket : "handles"
  Vendor ||--o{ MetricLog : "daily metrics"

  EdcUnit ||--o{ EdcMutationHistory : "mutations"
  EdcUnit ||--o{ Ticket : "optional unit"

  Ticket ||--o{ TicketActivity : "timeline"
  Ticket ||--o{ Ticket : "problemId (incidents)"
  Ticket ||--o{ Ticket : "relatedChangeId"

  User {
    string id PK
    string name
    string email UK
    string phone
    enum role
    string passwordHash
    boolean isActive
    datetime deletedAt
  }

  Permission {
    string id PK
    string key UK
    string description
  }

  RolePermission {
    string id PK
    enum role
    string permissionId FK
  }

  AuditLog {
    string id PK
    string actorId FK
    string action
    string entityType
    string entityId
    json metadata
  }

  NocShift {
    string id PK
    string userId FK
    date shiftDate
    enum shiftType
    enum status
    datetime startedAt
    datetime endedAt
    string notes
  }

  Vendor {
    string id PK
    string name
    enum type
    int allocationQuota
    boolean isActive
  }

  EdcUnit {
    string id PK
    string serialNumber UK
    string brand
    string regionalOffice
    enum status
    string merchantId
    string vendorId FK
  }

  EdcMutationHistory {
    string id PK
    string edcUnitId FK
    enum mutationType
    enum fromStatus
    enum toStatus
    string fromRegionalOffice
    string toRegionalOffice
    string mutatedBy
  }

  Ticket {
    string id PK
    string ticketNumber UK
    enum itsmType
    enum process
    string merchantId
    enum location
    enum category
    enum status
    enum slaStatus
    datetime openedAt
    datetime closedAt
    datetime acknowledgedAt
    datetime dispatchedAt
    datetime slaDeadlineAt
    string vendorId FK
    string edcUnitId FK
    string nocOwnerId FK
    string createdById FK
    string problemId FK
    string relatedChangeId FK
    string externalSystem
    string externalTicketId
  }

  TicketActivity {
    string id PK
    string ticketId FK
    string actorId FK
    enum activityType
    enum fromStatus
    enum toStatus
    string note
  }

  MetricLog {
    string id PK
    string vendorId FK
    date date
    decimal uptimePercent
    decimal targetPercent
    boolean metTarget
    int totalTickets
    int breachedTickets
  }

  NotificationLog {
    string id PK
    enum event
    enum channel
    enum status
    string toAddress
    string subject
    string ticketId
  }

  AiInsight {
    string id PK
    enum kind
    string ticketId
    string title
    string content
    int riskScore
    string provider
  }
```

---

## 3. Relasi kunci

| Dari | Ke | Kardinalitas | Catatan |
|------|-----|--------------|---------|
| `User` | `NocShift` | 1:N | Unique `(userId, shiftDate, shiftType)` |
| `User` | `Ticket` | 1:N | Sebagai `nocOwner` atau `createdBy` |
| `Vendor` | `EdcUnit` | 1:N | Unit EDC milik vendor |
| `Vendor` | `Ticket` | 1:N | Vendor penangan tiket |
| `Vendor` | `MetricLog` | 1:N | Unique `(vendorId, date)` — target uptime 99.9% |
| `EdcUnit` | `EdcMutationHistory` | 1:N | Deploy / recall / transfer / pooling |
| `Ticket` | `TicketActivity` | 1:N | Timeline immutable |
| `Ticket` | `Ticket` | 1:N | Incident → Problem (`problemId`) |
| `Ticket` | `Ticket` | 1:N | Link ke Change (`relatedChangeId`) |
| `Permission` | `RolePermission` | 1:N | RBAC role ↔ permission key |

### Enum penting

- **TicketLocation:** `DALAM_KOTA` · `LUAR_KOTA` · `LUAR_PULAU`
- **TicketCategory:** `VIP` · `NON_VIP`
- **ItsmType:** `INCIDENT` · `REQUEST` · `PROBLEM` · `CHANGE`
- **TicketStatus:** `OPEN` → `ACKNOWLEDGED` → `DISPATCHED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`
- **SlaStatus:** `ON_TRACK` · `WARNING` · `ACHIEVED` · `BREACHED`
- **EdcUnitStatus:** `BUFFER` · `DEPLOYED` · `IDLE`
- **UserRole:** `ADMIN` · `NOC` · `SUPERVISOR` · `VENDOR_TECH` · `OPS_MANAGER`

---

## 4. Entitas runtime / rencana (belum penuh di Prisma)

Digunakan di UI/API demo (in-memory). Direkomendasikan dipromosikan ke Prisma pada fase DB production.

```mermaid
erDiagram
  User ||--o{ AttendanceLog : "login punch"
  User ||--o{ ShiftSwapRequest : "requester"
  User ||--o{ ShiftSwapRequest : "target"
  NocShift ||--o{ ShiftSwapRequest : "shift slots"
  OlaPolicy ||--o{ Ticket : "evaluates stages"
  IntegrationClient ||--o{ Ticket : "external create/update"

  OlaPolicy {
    string id PK
    string name
    enum stage "ACKNOWLEDGE|DISPATCH"
    int limitMinutes
    float warningThreshold
    string itsmType "or *"
    string location "or *"
    string category "or *"
    string process "or *"
    int priority
    boolean isActive
  }

  AttendanceLog {
    string id PK
    string userId FK
    date shiftDate
    enum shiftType
    enum status "PRESENT|LATE|NO_ROSTER|OUT_OF_WINDOW"
    datetime loggedAt
    string source "LOGIN|MANUAL"
  }

  ShiftSwapRequest {
    string id PK
    string requesterId FK
    string targetUserId FK
    string requesterShiftId FK
    string targetShiftId FK
    enum status "PENDING|APPROVED|REJECTED|CANCELLED"
  }

  IntegrationClient {
    string id PK
    string name
    string apiKeyHash
    string scopes
    boolean isActive
  }
```

| Entitas | Store demo | Kegunaan |
|---------|------------|----------|
| `OlaPolicy` | `ola-store` | Jam internal Ack/Dispatch |
| `AttendanceLog` | `wfm-store` | Absensi login L1 |
| `ShiftSwapRequest` | `wfm-store` | Tukar shift + approval |
| `IntegrationClient` | `integration-clients-store` | API key eksternal |
| Connector settings | `connector-settings-store` | SMTP / AI runtime override |

---

## 5. Alur data SLA vs OLA

```mermaid
flowchart LR
  subgraph TicketClocks
    O[openedAt]
    A[acknowledgedAt]
    D[dispatchedAt]
    C[closedAt]
  end

  O --> SLA["SLA Engine<br/>location × VIP × peak × ITSM"]
  O --> OLA_ACK["OLA ACKNOWLEDGE<br/>policy match"]
  A --> OLA_DISP["OLA DISPATCH<br/>policy match"]
  C --> SLA

  SLA --> BadgeS["Badge SLA"]
  OLA_ACK --> BadgeA["Badge OLA Ack"]
  OLA_DISP --> BadgeD["Badge OLA Disp"]
```

- **SLA** = kewajiban kontrak ke bank/merchant (penalty-critical).  
- **OLA** = jam kerja internal tim (NOC ack, vendor dispatch) — terpisah dari SLA.

---

## 6. Buffer stock (logika agregat)

Buffer dihitung dari agregasi `EdcUnit` per `regionalOffice`:

\[
\text{buffer\%} = \frac{\text{count(status=BUFFER)}}{\text{total units di RO}} \times 100
\]

Ambang aman: **≥ 10%** (`BUFFER_STOCK_MIN_PERCENT`). Mutasi tercatat di `EdcMutationHistory`.

---

## 7. Cara regenerate / validasi schema

```bash
npm run db:validate
npm run db:generate
npm run db:push      # dev — sinkron schema ke Postgres
```

Sumber: `prisma/schema.prisma`.
