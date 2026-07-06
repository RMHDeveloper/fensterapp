# Operations OS Platform (OpsOS) — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-07-04  
**Status:** Draft

---

## 1. Executive Summary

**OpsOS** is a SaaS platform that enables agencies to configure and deploy a fully custom **Operations OS** for any field-service or operations-heavy business — without writing code. The deployed product for each client is a polished, installable mobile PWA with a lead pipeline, configurable workflow stages, role-based access, real-time sync, and file/voice/GPS capture — branded, worded, and structured to that client's exact process.

The platform is sold to agencies. Agencies use a visual Builder to configure client workspaces. Clients use the configured OS as their daily operations tool. The platform ships with a UPVC window installation template as the reference implementation that proves the system end-to-end.

---

## 2. Problem Statement

Operations-heavy SMBs (construction, solar, interiors, HVAC, pest control, printing, logistics, fabrication) run their entire business on WhatsApp groups and Excel sheets. They need a structured, mobile-first operations tool — but off-the-shelf software is either too generic, too complex, or too expensive to customize.

Custom software development takes months and costs significantly — and by the time it is delivered, the process has often already changed.

Agencies and consultants who serve these businesses understand their clients' workflows but cannot build and maintain software. They need a tool to build the tool.

---

## 3. Product Vision

> Any agency should be able to configure and deploy a production-grade Operations OS for any client — in under 30 minutes, with zero code.

**What the deployed product looks like:**  
A production-quality mobile PWA. Installable on Android and iOS. Fast, clean, role-aware. The field worker sees only their tasks. The manager sees the pipeline. The owner sees financials and progress. Every word, every stage, every form field matches the client's actual process — not a generic template they have to work around.

**What the Builder looks like:**  
A visual configurator — like Webflow but for operations workflows. The agency configures branding, roles, lead pipeline, workflow stages, form fields, and modules. One click publishes it live. The client never knows a builder exists.

---

## 4. Product Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  PLATFORM LAYER — Super Admin                                    │
│  Agency management · Global templates · Platform health         │
│  /platform/* routes — platform owner only                        │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  BUILDER LAYER — Agency                                          │
│  Configure tenants visually · Publish config · Export            │
│  /builder/* routes — agency staff only                           │
└──────────────────────────┬───────────────────────────────────────┘
                           │  publishes TenantConfig JSON
┌──────────────────────────▼───────────────────────────────────────┐
│  TENANT RUNTIME — Client Company                                 │
│  The deployed Operations OS                                      │
│  {slug}.opsOS.app or os.clientcompany.com                        │
│  Driven entirely by TenantConfig — zero hardcoded business logic │
└──────────────────────────┬───────────────────────────────────────┘
                           │  all infra through adapters
┌──────────────────────────▼───────────────────────────────────────┐
│  INFRASTRUCTURE ADAPTER LAYER                                    │
│  Database · Auth · Storage · Realtime · Email · Webhooks        │
│  Supabase (Phase A) → any Postgres + providers (Phase B/VPS)     │
└──────────────────────────────────────────────────────────────────┘
```

**Design principle:** The runtime never calls a vendor SDK directly. Every infrastructure concern goes through an adapter interface. Swapping providers means changing an adapter — not touching business logic.

---

## 5. User Personas

### 5.1 Super Admin (Platform Owner)
- Creates and manages agency accounts
- Sets global module availability
- Monitors platform health and usage
- Creates and publishes global starter templates
- Has access to all tenant configs (not tenant data)

### 5.2 Agency Admin
- Creates and manages client tenant workspaces
- Uses the full Builder to configure each tenant
- Manages agency team members
- Publishes configurations and deploys tenants to go-live
- Exports tenant configs for self-hosted deployments (Phase B)

### 5.3 Agency Staff
- Supports client configuration and onboarding
- Can edit tenant configs within the agency's scope
- Cannot access agency billing or agency management

### 5.4 Tenant Owner / MD
- Uses the Operations OS daily
- Sees financial overview, profit, full pipeline
- Approves decisions in the workflow
- Manages tenant users (invite, assign roles)
- Cannot access the Builder

### 5.5 Tenant Manager
- Manages leads or projects assigned to their team
- Can see the pipeline within their scope
- Assigns tasks to field workers

### 5.6 Tenant Field Worker
- Uses the app on mobile to update assigned tasks
- Fills stage forms: upload photos, record voice notes, mark GPS location, complete checklists
- Cannot see financials or other workers' tasks

### 5.7 Tenant Viewer
- Read-only access to specified data
- Cannot modify anything

---

## 6. Tenant Runtime Requirements

This is the core product — what clients use every day. Quality bar: fast, mobile-first, installable, role-aware, works on low-bandwidth connections.

### 6.1 App Shell

**PWA requirements:**
- Installable on Android (Add to Home Screen) and iOS (Safari Share → Add to Home Screen)
- App icon from `config.branding.logoUrl`
- Splash screen with `config.branding.primaryColor` and logo
- Offline: show cached data, queue writes, sync on reconnect
- Service worker with `skipWaiting + clientsClaim` for immediate activation on updates

**Navigation:**
- Bottom tab bar (mobile) / side rail (tablet/desktop)
- Tabs driven by `config.roles[user.role].navItems` — each role sees only their permitted tabs
- Default tabs: Home · Leads · Projects · Settings
- Optional module tabs added when modules are enabled (Calendar, Analytics, Attendance, Vendors)
- Tab labels driven by `config.labels.nav.*` — fully renameable per client

**Branding:**
- Company name and logo in app header
- Primary color on buttons, active states, highlights
- Company name replaces "OpsOS" everywhere — client never sees the platform name

### 6.2 Auth Screen
- Company logo + tagline
- Email + password login
- "Forgot password" → magic link email
- SSO button if `config.sso` is configured ("Continue with Google / Microsoft / SAML")
- Session validated against `tenant_id` — prevents cross-tenant login
- Session persists across browser restarts (refresh token based)

### 6.3 Home Screen

Role-appropriate dashboard:

**Owner / MD view:**
- Today's stats: New leads · Active projects · Revenue received · Pending amount
- Overdue tasks (past `stage.slaHours`)
- Quick actions: Add Lead · Add Project
- Module widgets if enabled (analytics chart, attendance summary)

**Manager view:**
- Team's active tasks
- Leads assigned to team
- Overdue alerts

**Field worker view:**
- My assigned tasks only
- Today's schedule
- Quick action: Update my task

### 6.4 Leads Screen

**List view:**
- Filter chips: Active (default, hides Lost) · Contacted · Qualified · All · Lost
- Search (name, phone, city)
- Lead card: `Name | City / Requirement / Source`
- Interest badge: color-coded per `config.lead.interestLevels`
- Assignee shown for managers/owners

**Lead status actions:**
- Contacted → popup: select follow-up date (optional)
- Qualified → sheet stays open, enables "Convert to Project" button
- Lost → popup: reason for loss (text input, stored for owner review)

**Add Lead sheet:**
- Name, Phone, City, Requirement
- Source chips (from `config.lead.sources`)
- Interest buttons (from `config.lead.interestLevels`)
- Assign To dropdown (role-gated, compulsory for owner/MD)
- Custom fields (from `config.lead.customFields`)

**Convert to Project:**
- Project name (pre-filled)
- Assign To (role-gated, compulsory)

**Edit Lead:** All fields editable per role permission. Status history shown.

All labels ("Lead", "Enquiry", etc.) driven by `config.labels.lead`.

### 6.5 Projects Screen

**List view:**
- Filter: All · Active · Completed · On Hold
- Search by project name, client, location
- Project card: Name · Client · Stage badge · Assignee · Last updated

**Project Detail:**
- Project header: name, client, location
- Current stage progress indicator
- Stage form (rendered by WorkflowEngine)
- Activity log: notes, uploads, status changes with timestamp + actor
- Payments section (if configured)

### 6.6 Workflow Engine

Every stage is a form defined in `config.workflow.stages`. No stage logic is hardcoded anywhere.

**Stage header:**
- Stage name, assigned role
- Color accent (`stage.color`)
- Icon (`stage.icon`)
- SLA overdue indicator if `stage.slaHours` elapsed

**Field types supported:**

| FieldType | UI Component |
|---|---|
| `text` | Single-line input |
| `textarea` | Multi-line, expandable |
| `number` | Numeric keypad on mobile |
| `currency` | Formatted with locale currency symbol |
| `date` | Native mobile date picker |
| `time` | Native mobile time picker |
| `select` | Dropdown, single select |
| `multiselect` | Multi-select chips |
| `radio` | Mutually exclusive option buttons |
| `checklist` | Multiple checkboxes |
| `file` | Camera / gallery / file picker, preview |
| `files` | Multi-file, preview grid, up to `maxFiles` |
| `voice` | Record, playback, upload audio |
| `location` | Auto-detect GPS or manual map tap |
| `calculation` | Formula display: `"{{sqft}} * {{rate}}"`, read-only |

**Conditional fields:** `showWhen` rule hides/shows any field based on another field's value.  
**Required validation:** `stage.requiredFieldIds` — submit blocked until all required fields filled.

**Outcome buttons:**
- From `stage.outcomes[]` — label, style, next stage all configurable
- `confirmationPrompt`: shows confirmation dialog before executing
- `requiresNote`: forces a text note before the transition
- On submit: saves form data, sets `task.flowStage = outcome.nextStage`, fires workflow hooks

### 6.7 Settings Screen

- **My Profile** (all roles): name, email, change password
- **User Management** (owner only): invite, assign roles, deactivate users
- **Company** (owner only): read-only view of branding config
- **Storage** (owner only): usage vs quota
- **Module Settings**: settings registered by enabled modules
- **About**: app version

### 6.8 Real-Time Sync

All data changes propagate instantly via WebSocket. A `SyncStatusIndicator` shows: Synced · Syncing · Offline (queued).

---

## 7. Builder Layer Requirements

The agency-facing configurator. At `/builder` — completely separate from the tenant runtime. Target: agency staff can go from blank config to a published tenant in 30 minutes.

### 7.1 Builder Login
- Separate auth from tenant auth (platform users table)
- Email + password

### 7.2 Agency Portal Home
- All tenants: name · slug · status (Draft / Active / Suspended) · last published · user count
- New Tenant button → TenantSetupWizard
- Usage stats per tenant: storage used · users · last active

### 7.3 Tenant Setup Wizard
Step 1: **Pick Template** — cards for each available template. Shows industry, stage count, modules included.  
Step 2: **Company Details** — company name, slug (auto-generated), industry, region, optional custom domain.  
Step 3: **Quick Branding** — logo upload, primary color, live preview of login screen.

Creates the tenant record and opens the full Builder.

### 7.4 Tenant Dashboard
- Status banner
- Last published timestamp
- Go-Live Checklist: Branding ✓ · Roles ✓ · Workflow ✓ · Users ✓ · Storage ✓
- **Publish Changes** button (sticky, shown when draft has unpublished changes)
- **Export for Self-Hosting** button (Phase B)

### 7.5 Branding Builder
- Company name · Tagline · Logo upload · Favicon upload · Primary color · Accent color
- Live preview: login screen + home screen with current branding

### 7.6 Terminology Builder
Renames entity labels across the entire deployed app:
- What do you call a "Lead"? → `Enquiry` / `Prospect` / `Contact`
- What do you call a "Project"? → `Job` / `Work Order` / `Contract`
- Nav tab labels override
- CTA button text override: Add Lead · Add Project · Convert to Project · Mark as Lost
- Empty state messages

Real-time preview updates as you type.

### 7.7 Storage Builder
- Provider dropdown: Supabase Storage · AWS S3 · Cloudflare R2 · MinIO · Hostinger
- Credential fields adapt to provider
- "Test Connection" — calls API to verify credentials before saving
- Current usage bar

### 7.8 Roles Builder
Each role:
- Role name (label) · Role ID (auto-slug)
- "Owner Role" toggle (access to financials, approval actions)
- **Nav items** checklist (which tabs visible for this role)
- **Permissions** checklist (grouped by feature):
  - Leads: view · add · edit · change status · convert
  - Projects: view · add · edit · view profit
  - Workflow: complete stage · skip stage · edit stage data
  - Users: manage · view all
  - Reports: view analytics · export data
  - Settings: edit company · manage modules

### 7.9 Lead Configuration Builder
- **Statuses**: draggable chip list — label, color, value slug. Cannot remove Lost.
- **Sources**: draggable chip list — label, value slug
- **Interest Levels**: up to 3 — label, color, value slug
- **Custom Lead Fields**: list of FieldDefinition items, "Add Field" → FieldDefinitionEditor sheet

### 7.10 Workflow Builder

Layout:
- Left: vertical draggable stage list
- Right: StageEditorPanel for selected stage
- Bottom toggle: Flow Diagram view

**StageEditorPanel:**
- Stage name · Description · Color picker · Icon picker (lucide icon set)
- Assigned Role (dropdown)
- SLA Hours (optional — enables overdue alerts)
- **Fields** section: field cards + Add Field
- **Outcomes** section: outcome cards + Add Outcome

**FieldDefinitionEditor sheet (shared with Lead Config):**
- Label · Field ID (auto-slug) · Type dropdown (14 types)
- Required toggle
- Type-specific config:
  - Select / Radio / Checklist: option list (add / remove / reorder)
  - File / Files: accepted types · max files
  - Calculation: formula input with `{{fieldId}}` autocomplete
  - Any type: `showWhen` rule builder (field selector · operator · value)

**OutcomeEditor:**
- Label · Next Stage (dropdown: all stages + "End / Complete")
- Button style: Primary / Success / Danger / Warning
- Confirmation prompt (optional)
- "Require note before proceeding" toggle

**Flow Diagram view:**
- Visual DAG: stages as nodes, outcomes as directed edges
- Click a node to jump to that stage's editor
- Dead-end stages (no outcomes) shown with warning indicator

### 7.11 Module Store
Grid of module cards:
- Icon · Name · Description · Category badge
- Toggle on/off
- "Configure" button (if module has settings)

### 7.12 User Management (Builder-side)
- List: name · email · role · status
- Invite User: name, email, role, send invite email
- Invitee receives magic link or temp password
- Deactivate user (blocks login, preserves data)

### 7.13 Template Gallery
Pick a starting point when creating a new tenant or resetting:
- **UPVC Windows** — 15 stages, full installation workflow
- **Solar Installation** — survey, design, approval, installation, commissioning
- **Interior Design** — client brief, design, BOQ, procurement, execution
- **General Contractor** — estimate, award, mobilization, construction
- **Blank** — zero stages, zero roles — full custom build

Each template is a `TenantConfig` JSON in `src/templates/`.

---

## 8. Platform Layer Requirements (Super Admin)

Accessed at `/platform` — platform owner only.

### 8.1 Dashboard
- Total agencies · Total tenants · Total active users
- Storage usage across platform · Realtime connection chart

### 8.2 Agency Management
- List: name · plan · tenant count · status
- Create agency (manual onboarding)
- Edit: plan · max_tenants · status (suspend / activate)
- View all tenants under an agency

### 8.3 Tenant Management
- View any tenant's config (read-only)
- Force-publish (override agency draft)
- Suspend tenant
- View storage usage, user count, last activity

### 8.4 Template Management
- Create and edit global starter templates
- Publish / unpublish templates
- Clone an existing tenant's config as a template

### 8.5 Module Management
- Enable / disable modules globally
- Set module availability per agency plan
- View per-module adoption across tenants

---

## 9. Module Specifications

### Core Modules (Always enabled)

| Module | Provides |
|---|---|
| `leads` | Leads screen, pipeline, detail, convert flow |
| `projects` | Projects screen, project detail, creation |
| `workflow` | WorkflowEngine, all field renderers, outcomes |
| `users` | Settings → User Management, role visibility |
| `files` | StorageAdapter, file preview components |
| `activity` | Activity log per project, note creation |

### Optional Modules

**`expenses` — Expense Tracker**  
Log expenses per project (description, amount, category, receipt photo). Expense summary in project detail. Expenses by category in analytics.

**`inventory` — Inventory Management**  
Material catalog with stock levels. Allocate materials to a project. Stock deduction on stage completion. Low stock alerts.

**`invoices` — Invoice Generator**  
Generate PDF invoice from project data. Custom invoice template (logo, payment terms, bank details). Send to client email. Track status: Sent · Paid · Overdue.

**`calendar` — Calendar View**  
New nav tab. Events: stage due dates, lead follow-ups, appointments. Day / Week / Month views. Tap event → goes to project or lead.

**`customer_portal` — Customer Portal**  
Separate read-only login for the end client. Client sees: current stage, shared uploads, payment status. No access to internal notes or financials.

**`analytics` — Analytics Dashboard**  
New nav tab (owner / manager only). Charts: leads by source · conversion rate · revenue by month · stage time analysis. Date range filter · CSV export.

**`whatsapp` — WhatsApp Notifications**  
Configure WhatsApp Business API credentials. Trigger messages on stage outcome. Message templates configurable per outcome.

**`attendance` — Attendance Tracking**  
Field staff check-in (GPS + photo) and check-out. Manager: daily attendance log, late / absent alerts. Monthly report.

**`vendors` — Vendor Management**  
Vendor catalog: name, contact, material category, rating. Purchase orders linked to projects. Delivery tracking.

**`sms` — SMS Notifications**  
Stage-triggered SMS to client or staff. Template per outcome. Supports Twilio, MSG91, Fast2SMS.

**`qr_handover` — QR Client Sign-Off**  
Generate QR code per project. Client scans on-site → sign-off page (no login). Client views completion photos, digitally signs. Sign-off recorded in activity log.

**`webhooks` — Outbound Webhooks**  
Agency configures URL + secret + event list. Events: `project.stage_completed` · `lead.converted` · `lead.status_changed` · `payment.received`. Signed payloads (HMAC-SHA256). Retry with exponential backoff. Delivery log in settings.

**`sso` — Enterprise SSO**  
Adds SSO button to login screen. Supports Google OAuth · Microsoft OAuth · SAML 2.0. `enforced: true` disables password login. User auto-created on first SSO login.

---

## 10. TenantConfig Schema

The complete specification of a tenant's OS, stored as a JSONB blob.

```typescript
export type FieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'time'
  | 'select' | 'multiselect' | 'radio' | 'checklist'
  | 'file' | 'files' | 'voice' | 'location' | 'calculation'

export interface FieldDefinition {
  id: string; label: string; type: FieldType; required: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  accept?: string; maxFiles?: number
  calculation?: string                         // "{{sqft}} * {{rate}}"
  showWhen?: { fieldId: string; operator: 'equals'|'not_equals'|'not_empty'; value?: string }
  readonly?: boolean
}

export interface StageDefinition {
  id: string; name: string; description?: string
  assignedRole: string
  color?: string; icon?: string                // lucide icon name
  fields: FieldDefinition[]
  outcomes: {
    id: string; label: string; nextStage: string | null
    style?: 'primary'|'danger'|'success'|'warning'
    confirmationPrompt?: string
    requiresNote?: boolean
  }[]
  requiredFieldIds?: string[]
  slaHours?: number
}

export interface RoleDefinition {
  id: string; label: string
  permissions: string[]
  navItems: string[]
  isOwnerRole?: boolean
}

export interface TenantConfig {
  schemaVersion: number

  branding: {
    companyName: string; tagline?: string
    logoUrl?: string; faviconUrl?: string; splashUrl?: string
    primaryColor: string; accentColor?: string
  }

  labels: {
    lead: string; leadPlural: string
    project: string; projectPlural: string
    stage: string
    nav?: { home?: string; leads?: string; projects?: string; settings?: string }
    cta?: { addLead?: string; addProject?: string; convertToProject?: string; markAsLost?: string }
    emptyStates?: { leads?: string; projects?: string; tasks?: string }
  }

  storage: {
    provider: 'supabase' | 's3' | 'minio' | 'hostinger'
    bucket?: string; region?: string; endpoint?: string
    accessKey?: string; secretKey?: string
    uploadUrl?: string; uploadKey?: string     // hostinger
  }

  email?: {
    fromName: string; fromAddress: string
    provider: 'resend' | 'sendgrid' | 'smtp'
    apiKey?: string; smtpHost?: string; smtpPort?: number
  }

  sso?: {
    provider: 'google' | 'microsoft' | 'saml'
    clientId?: string; tenantId?: string; samlMetadataUrl?: string
    enforced: boolean
  }

  lead: {
    statuses: { value: string; label: string; color?: string }[]
    sources:  { value: string; label: string }[]
    interestLevels: { value: string; label: string; color: string }[]
    customFields: FieldDefinition[]
  }

  roles: RoleDefinition[]

  workflow: {
    stages: StageDefinition[]
    initialStageId: string
  }

  webhooks?: {
    id: string; url: string; secret: string
    events: string[]
    active: boolean
  }[]

  enabledModules: string[]
  moduleConfig: Record<string, Record<string, unknown>>
}
```

---

## 11. Tech Stack

### What to use and why

| Layer | Choice | Reason |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Battle-tested, large ecosystem, strong PWA support |
| Build tool | Vite 5 | Fast HMR, excellent PWA plugin, standard for React |
| Styling | Tailwind CSS v4 | Utility-first, no CSS bloat, consistent with mobile-first approach |
| Routing | React Router v6 | SPA routing, nested routes for builder |
| PWA | Vite PWA Plugin | Service worker, offline support, manifest generation |
| Icons | Lucide React | Clean, consistent, tree-shakeable |
| API server | Hono (Node.js) | Lightweight, runs on Node / Bun / Cloudflare Workers / Docker — provider agnostic |
| Database | PostgreSQL 16 | JSONB for flexible tenant data, mature, widely supported |
| Managed DB | Supabase (Phase A) | Managed Postgres + Auth + Realtime + Storage in one — swap via adapter |
| Auth | Supabase Auth / GoTrue | Open-source (self-hostable), SSO-ready, refresh tokens |
| Realtime | Supabase Realtime (Phase A) / Soketi (VPS) | WebSocket, swappable via adapter |
| File storage | Supabase Storage (Phase A) / MinIO or S3 (VPS) | Swappable via StorageAdapter |
| Email | Resend (Phase A) / SMTP (VPS) | SMTP-compatible, swappable |
| Error tracking | Sentry | Per-tenant error context tagging |
| Connection pooling | Supavisor (Supabase) / PgBouncer (VPS) | Required at scale |
| Custom domains | Cloudflare for SaaS | Automated SSL + custom hostname via API |

### Infrastructure Adapter Layer

The runtime never imports a vendor SDK directly. All external calls go through adapter interfaces:

```
src/adapters/
  database/    DatabaseAdapter.ts  +  SupabaseAdapter.ts  +  PostgresDirectAdapter.ts
  auth/        AuthAdapter.ts      +  SupabaseAuthAdapter.ts  +  SAMLAdapter.ts
  storage/     StorageAdapter.ts   +  SupabaseStorageAdapter.ts  +  S3Adapter.ts  +  MinIOAdapter.ts
  realtime/    RealtimeAdapter.ts  +  SupabaseRealtimeAdapter.ts  +  SoketiAdapter.ts  +  PollingAdapter.ts
  email/       EmailAdapter.ts     +  ResendAdapter.ts  +  SMTPAdapter.ts
  domain/      DomainAdapter.ts    +  CloudflareAdapter.ts  +  ManualDomainAdapter.ts
```

Adapters resolved at boot from env vars. Swapping providers = change env var and/or swap one adapter file. Business logic is untouched.

---

## 12. Database Design

### Design philosophy
- `ops_*` tables store the entity object as `data JSONB` — no schema migrations when a tenant adds custom fields in the Builder
- Queryable fields (status, flowStage) indexed as generated columns or JSON path indexes
- All `ops_*` tables have `tenant_id` for RLS isolation
- `saas_*` tables for platform metadata, separate from tenant data

### Platform Tables

```sql
CREATE TABLE saas_agencies (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter',
  max_tenants INT NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE saas_tenants (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES saas_agencies(id),
  slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT UNIQUE,
  display_name TEXT NOT NULL,
  industry TEXT,
  region TEXT NOT NULL DEFAULT 'ap-south-1',
  db_project_id TEXT,             -- non-null = dedicated DB project (enterprise)
  status TEXT NOT NULL DEFAULT 'draft',
  config JSONB NOT NULL DEFAULT '{}',
  quotas JSONB NOT NULL DEFAULT '{"maxUsers":20,"maxProjects":500,"maxStorageMB":5000}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE saas_platform_users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  platform_role TEXT NOT NULL DEFAULT 'agency_admin',
  agency_id TEXT REFERENCES saas_agencies(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE saas_config_versions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES saas_tenants(id),
  version INT NOT NULL, config JSONB NOT NULL,
  changed_by TEXT NOT NULL, changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tenant Data Tables

```sql
CREATE TABLE ops_projects ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW() );
CREATE TABLE ops_tasks    ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW() );
CREATE TABLE ops_leads    ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW() );
CREATE TABLE ops_payments ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW() );
CREATE TABLE ops_users    ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW() );
CREATE TABLE ops_activity ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() );

-- Append-only audit log — no UPDATE/DELETE in RLS
CREATE TABLE ops_audit_log (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  user_id TEXT, action TEXT NOT NULL,
  entity_type TEXT, entity_id TEXT,
  diff JSONB, ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**RLS on every ops_* table:**
```sql
ALTER TABLE ops_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ops_projects
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
```

**Indexes:**
```sql
CREATE INDEX ON ops_projects (tenant_id, created_at DESC);
CREATE INDEX ON ops_tasks    (tenant_id, (data->>'flowStage'));
CREATE INDEX ON ops_leads    (tenant_id, (data->>'status'), created_at DESC);
CREATE INDEX ON ops_leads    (tenant_id, (data->>'assignee'));
CREATE INDEX ON ops_activity (tenant_id, created_at DESC);
```

---

## 13. API Design (Hono Server)

Handles operations the frontend cannot do safely client-side.

```
POST   /api/tenants/:id/export           — export TenantConfig as deployment bundle
DELETE /api/tenants/:id/data             — GDPR: erase all tenant data
GET    /api/tenants/:id/data/export      — GDPR: export all tenant data as JSON/CSV zip
POST   /api/domains/provision            — Cloudflare for SaaS: add custom hostname
DELETE /api/domains/:hostname            — remove custom hostname
POST   /api/webhooks/deliver             — deliver signed webhook, with retry
GET    /api/tenants/:id/usage            — storage, user count, activity stats
POST   /api/storage/signed-url           — generate signed upload URL
POST   /api/email/send                   — send via tenant's configured email provider
POST   /api/tenants/:id/audit            — write audit log entry
```

All endpoints require a platform API key in `Authorization` header.

---

## 14. Security Requirements

**Authentication**
- JWT issuance, refresh, and revocation handled by auth adapter (Supabase Auth / GoTrue)
- `tenant_id` embedded in JWT user metadata — verified on every request
- Password minimum: 8 chars, 1 uppercase, 1 number
- Session timeout: 8 hours idle, 30-day maximum with refresh

**Data Isolation**
- RLS enforces row-level tenant isolation at the database level — even a compromised query cannot read another tenant's rows
- `current_setting('app.tenant_id')` set per transaction via `SET LOCAL`
- Builder layer only reads `saas_tenants.config` — never reads `ops_*` data

**Storage**
- RLS policies on storage bucket paths (tenant_id prefix)
- Signed URLs for all file access — no public buckets
- File type validation server-side before storage
- Max file size: 20 MB (configurable per tenant via quotas)

**API**
- Hono API: rate-limited per IP (100 req/min)
- Webhook deliveries: HMAC-SHA256 signed payloads (`X-Signature` header)
- Credentials (storage keys, SSO secrets) never sent to frontend — proxied through Hono API

**Audit**
- All write operations logged to `ops_audit_log` (insert-only RLS)
- Includes: user, action, entity, diff, IP, timestamp
- Retained minimum 1 year

---

## 15. Non-Functional Requirements

**Performance**
- Initial app load (PWA, cached): < 1 second
- First load (uncached, 4G): < 3 seconds
- Stage form render (any config): < 100 ms
- Realtime event → UI update: < 500 ms
- File upload (5 MB on 4G): < 10 seconds

**Scalability**
- 50 concurrent active tenants: Supabase Pro + Supavisor
- 200 concurrent active tenants: Supabase Team (HA + read replica)
- 1000+ tenants: migrate to self-hosted Postgres cluster (adapter swap, no app code changes)
- Per-tenant resource quotas enforced at application layer

**Availability**
- Target: 99.9% uptime
- Graceful degradation: app shows cached data if realtime disconnects

**Offline**
- All list screens load from local cache when offline
- Write operations queued, synced on reconnect
- Clear offline indicator shown

---

## 16. Compliance

**GDPR**
- Data deletion: `eraseTenantData()` deletes all `ops_*` rows + storage files for a tenant
- Data export: `exportTenantData()` returns all tenant data as downloadable ZIP
- Requests logged to `saas_gdpr_requests` table

**Data Retention**
- Tenant data: retained while active + 90 days after suspension
- Audit logs: 1 year minimum
- Config versions: indefinitely

**Self-Hosted Compliance**
- For enterprise clients requiring full data sovereignty: VPS export (Phase B)
- Platform has zero access to standalone deployed instances — client's VPS is client's responsibility

---

## 17. Deployment Architecture

### Phase A — Centralized SaaS

```
Internet → Cloudflare (DNS + CDN + DDoS protection)
            ├── *.opsOS.app  →  Vercel or Cloudflare Pages (React PWA)
            ├── api.opsOS.app  →  Railway or Fly.io (Hono API)
            └── Custom domains  →  Cloudflare for SaaS  →  same Vercel deployment

Frontend → Supabase (PostgreSQL + Auth + Realtime + Storage)
         → Hono API (webhooks, GDPR, domains, signed uploads)

Supabase:
  - Supavisor enabled for connection pooling
  - Read replica at scale (Team plan)
  - Point-in-time recovery backups

Monitoring: Sentry (tenant-tagged) + Supabase Dashboard
```

**Tenant identification:** Parse subdomain from `window.location.hostname` → load config from `saas_tenants` by slug. Custom domains looked up by `saas_tenants.custom_domain`. Dev mode: `VITE_TENANT_SLUG` env var.

### Phase B — VPS Self-Hosted

```yaml
# docker-compose.yml — ships in the export bundle
services:
  postgres:
    image: postgres:16-alpine
    volumes: [db_data:/var/lib/postgresql/data]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes: [storage_data:/data]

  soketi:
    image: quay.io/soketi/soketi:latest   # OSS WebSocket server

  gotrue:
    image: supabase/gotrue:latest         # open-source auth

  api:
    build: ./api                          # Hono server

  app:
    build: .                              # nginx serving /dist (React PWA)
    ports: ["80:80", "443:443"]

volumes: { db_data: {}, storage_data: {} }
```

Minimum VPS spec: 2 vCPU / 4 GB RAM / 80 GB SSD — handles up to 100 concurrent users.  
SSL: Let's Encrypt via Certbot.  
Deploy: `docker compose up -d && certbot --nginx -d os.client.com`

---

## 18. Known Limitations (Centralized SaaS) and Mitigations

| Limitation | Impact | Mitigation |
|---|---|---|
| Shared Supabase connection pool | At high concurrent users, connections exhaust | Enable Supavisor (built-in pooler, no code change) |
| Supabase Realtime connection limit | Pro: 500 concurrent WS connections | Upgrade to Team plan; long-term: swap to self-hosted Soketi via adapter |
| RLS overhead at large table sizes | >1M rows per table adds query latency | Composite indexes on tenant_id + status + created_at; read replica on Team plan |
| Single deployment = shared outages | A bad release affects all tenants | Feature flag new functionality via modules; Vercel preview environments for QA |
| All data in one region | Enterprise / EU clients may need local region | `saas_tenants.region` + `db_project_id` for dedicated per-tenant Supabase project |
| Supabase Auth is project-wide | Cross-tenant login attempt possible without mitigation | `tenant_id` in JWT metadata; AuthContext validates slug matches session tenant |
| Manual custom domain setup | Does not scale past ~20 tenants | Cloudflare for SaaS API — automated custom hostname provisioning via Hono endpoint |
| Storage cost grows with uploads | Large file use can exceed plan limits | Per-tenant storage quota enforced at upload time; quota visible to tenant owner |

---

## 19. Phased Build Roadmap

### Phase 0 — Infrastructure (1 week)
- New repo `ops-os-platform`
- All adapter interfaces written + Supabase implementations
- Supabase project: `saas_*` + `ops_*` tables, RLS, indexes
- Hono API skeleton with auth middleware
- `VITE_DEPLOY_MODE=saas` + `tenantConfigLoader.ts`
- CI/CD: GitHub → Vercel (frontend) + Railway (Hono API)
- **Done when:** App loads and renders the company name from a tenant's config in the DB

### Phase 1 — Workflow Engine (2 weeks)
- `src/engine/`: WorkflowEngine, StageFormRenderer, FieldRenderer (all 14 types), OutcomeRenderer
- Conditional field visibility (`showWhen`), required field validation
- Calculation field formula evaluator
- UPVC template config JSON (the reference 15-stage workflow as StageDefinition array)
- **Done when:** All 15 UPVC stages work via the engine using the config JSON — no hardcoded stage logic

### Phase 2 — Core Tenant Screens (2 weeks)
- Auth screen (Supabase Auth)
- Home screen (role-aware dashboard, module widgets)
- Leads screen (add, status change, convert, edit, filter)
- Projects screen (list, detail, activity log)
- Settings screen (profile, user management)
- NavigationBar driven by `config.roles[user.role].navItems`
- `useLabels()` hook — all entity names from config throughout
- **Done when:** A complete tenant works end-to-end — login, manage leads, run the full UPVC workflow

### Phase 3 — Module System (1 week)
- `src/modules/types.ts` + `src/modules/registry.ts`
- Core modules wired: leads, projects, workflow, users, files, activity
- First optional module: `analytics`
- Module gating in nav + screens + settings
- **Done when:** Analytics module toggles on/off via config without any code change

### Phase 4 — Builder Foundation (2 weeks)
- `/builder/*` routes, `PlatformAuthGuard`
- Builder login, Agency Portal, Tenant Setup Wizard + template selection
- `useTenantEditor` hook + `PublishBar` (atomic publish to Supabase)
- BrandingBuilderScreen + TerminologyBuilderScreen
- RoleBuilderScreen + LeadBuilderScreen
- **Done when:** Agency can create a tenant from a template, configure branding and terminology, publish, and see live changes

### Phase 5 — Workflow Builder (2 weeks)
- WorkflowBuilderScreen: stage list + StageEditorPanel
- FieldDefinitionEditor (all 14 types, showWhen builder)
- OutcomeEditor, Flow Diagram view
- StorageBuilderScreen (provider picker + connection test)
- **Done when:** Agency builds a 5-stage custom workflow from scratch and it runs correctly in the tenant app

### Phase 6 — Builder Completion + Platform Admin (1 week)
- ModuleStoreScreen
- TenantUserManagementScreen
- TemplateGalleryScreen (all 5 templates)
- Platform admin panel (agency list, tenant list, module management, usage stats)
- **Done when:** Agency self-serves from template to published tenant in < 30 minutes unassisted

### Phase 7 — Enterprise Features (2 weeks)
- GDPR: export + erase APIs in Hono
- Immutable audit log (`ops_audit_log` fired from all write functions)
- Per-tenant resource quotas (enforced in adapter + write functions)
- Cloudflare for SaaS: custom domain provisioning via Hono
- Supavisor enabled
- Sentry with tenant context
- Webhooks module (outbound delivery with retry)
- **Done when:** Platform handles 50+ concurrent tenants safely and passes compliance checks

### Phase 8 — VPS Self-Hosted Export (1 week)
- `StandaloneExporter.ts` in Hono API
- Docker Compose stack (postgres + minio + soketi + gotrue + api + nginx)
- `VITE_DEPLOY_MODE=standalone` — loads config from bundled `tenant.config.json`
- Export bundle: config.json + .env.template + docker-compose.yml + setup.sql
- Builder UI: "Export for Self-Hosting" in TenantDashboardScreen
- **Done when:** Agency deploys a fully isolated instance from the export bundle on a clean VPS in < 30 minutes

### Phase 9 — Additional Modules (Ongoing)
Build modules one at a time: `expenses` → `calendar` → `customer_portal` → `invoices` → `attendance` → `whatsapp` → `sms` → `vendors` → `qr_handover` → `sso` → `inventory`

### Initial Client Migration (After Phase 2)
- Create the first tenant in the platform with the UPVC template
- Migrate existing data from old tables to `ops_*` tables with `tenant_id = 'client_slug'`
- Point existing domain to new platform (CNAME or custom domain setup)
- Validate all existing users can log in and the full workflow is intact
- Old codebase archived after validation

---

## 20. Verification Criteria

1. **Workflow completeness** — all stages in the UPVC template work via WorkflowEngine with no hardcoded logic
2. **Tenant isolation** — two tenants logged in simultaneously cannot see each other's data (verify at network tab + DB level)
3. **Config round-trip** — agency edits a stage label in Builder, publishes, tenant sees the new label within 5 seconds
4. **Module toggle** — enable / disable `analytics` module, nav tab appears / disappears without page reload
5. **Label override** — set `labels.lead = "Enquiry"`, every screen and button shows "Enquiry" not "Lead"
6. **Storage adapter swap** — configure S3 on one tenant, upload a file, confirm URL is S3 not Supabase
7. **VPS deploy** — run `docker compose up` on a fresh Ubuntu 22.04 VPS, full app functional in < 5 minutes
8. **Connection pooling** — 200 concurrent simulated users, Supabase connections stay under 100 (Supavisor working)
9. **Offline mode** — disable network, list screens show cached data, writes queue and sync on reconnect
10. **GDPR erase** — call `eraseTenantData()`, confirm all `ops_*` rows + storage files removed for that tenant

---

## 21. Open Questions

1. **Platform domain** — What is the production domain? (e.g. `opsOS.app`, `opsOS.in`, or other)
2. **Supabase region** — Which region for the primary Supabase project? (`ap-south-1` Mumbai for India-primary)
3. **Agency onboarding** — Manual onboarding by platform owner, or self-signup flow?
4. **App stores** — PWA only, or plan for a React Native wrapper for Google Play / App Store later?
