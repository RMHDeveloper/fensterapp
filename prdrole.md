# Fencraft — Role-Based Access & Lead-to-Project Flow

## 1. Roles Overview

| Role (Internal) | Display Name | Who Is This |
|---|---|---|
| `owner` | Managing Director (MD) / Executive Director (ED) / Admin | Haroon, senior decision makers |
| `lead_manager` | Lead Owner (LO) / Sales Team | Sales staff who own client relationships |
| `site_engineer` | Site Engineer (SE) | Field engineers who do measurements |
| `production_admin` | Production Incharge | Checks material availability before production starts |
| `production_manager` | Production Manager | Does the actual production work on the floor |
| `technician` / `installation_incharge` | Technician / Installation Incharge | Installs the product at the client site |
| `viewer` | Viewer | Read-only guest access |

> MD, ED, and Admin all map to the **same internal role** (`owner`). They have identical permissions.  
> `production_team` and `installation_incharge` are legacy aliases kept for backward compatibility.

---

## 2. Feature Access Matrix

### Legend: ✅ Full Access · 👁 View Only · 🔒 No Access · ✏️ Own Only

| Feature / Screen | MD / ED / Admin | Lead Owner (LO) | Site Engineer | Prod Admin | Prod Manager | Technician |
|---|---|---|---|---|---|---|
| **Leads screen** | ✅ All leads | ✏️ Own leads only | 🔒 | 🔒 | 🔒 | 🔒 |
| Create lead | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| Edit lead | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| Update lead status | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| Assign site engineer | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| Convert lead to project | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| **Projects screen** | ✅ All projects | ✏️ Own projects | 👁 Assigned only | 👁 Pre-prod stage | 👁 Production stage | 👁 Installation stage |
| Create project | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| Edit project details | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| Edit project dates | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| Edit account / client name | ✅ MD only | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| View project amount (₹) | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| **Site visit** | ✅ | 👁 | ✅ Can update | 🔒 | 🔒 | 🔒 |
| **Quotation** | ✅ Approve/Reject | ✅ Create & Send | 🔒 | 🔒 | 🔒 | 🔒 |
| View profit breakdown | ✅ MD/ED only | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| **Advance payment** | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| **Production check** | ✅ | 👁 | 🔒 | ✅ | 🔒 | 🔒 |
| **Production work** | ✅ | 👁 | 🔒 | ✅ | ✅ | 🔒 |
| **Installation** | ✅ | ✅ Assign | 🔒 | 🔒 | 🔒 | ✅ Do work |
| **Final payment** | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| **Delivery QC** | ✅ | 👁 | 🔒 | 👁 | ✅ | 🔒 |
| **Mistakes** | ✅ Review & Close | ✅ Create | ✅ Create | 🔒 | ✅ Create | ✅ Create |
| **Payments** | ✅ | ✅ Update | 🔒 | 🔒 | 🔒 | 🔒 |
| **Reports** | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| **Manage Users** | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| **Settings** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Files / Upload** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3. Project Filter Visibility by Role

Each role only sees the project filter chips relevant to their job:

| Role | Visible Filter Chips |
|---|---|
| MD / ED / Admin | All, Measurement, Quotation, Negotiation, Pre-Production, Production, Dispatch Ready, Installation, Payment, Completed |
| Lead Owner (LO) | All, Measurement, Quotation, Negotiation, Pre-Production, Production, Dispatch Ready, Installation, Payment, Completed |
| Site Engineer | Measurement, Completed |
| Production Admin | Pre-Production, Completed |
| Production Manager | Production, Dispatch Ready, Completed |
| Technician | Installation, Completed |

---

## 4. The Complete Lead → Project Flow

This is the full journey of a client from first contact to project completion. Each stage shows **who acts**, **what they do**, and **who receives the next task**.

---

### STAGE 0 — Lead Capture
**Actor: LO or MD/ED**

- LO or MD creates a new lead with: Customer Name, Phone, Requirement, Location, Lead From (source), Interest level.
- Lead status starts as **New**.
- MD/ED can see all leads. LO sees only leads assigned to them.
- No project is created yet.

**Status progression:** `new` → `contacted` → `qualified`

- **Contacted**: LO sets a follow-up date. The lead is being worked on.
- **Qualified**: Lead is confirmed to have genuine interest and budget. Now ready for site visit.
- **Lost**: Lead dropped. Reason is recorded.

---

### STAGE 1 — Assign Site Engineer
**Actor: LO or MD/ED**  
**Triggered by:** Lead reaching `qualified` status

After the lead is **Qualified**, the LO or MD sees the **"Assign to Site Engineer"** button (above Convert to Project).

- LO selects a Site Engineer, sets visit date, time, location, and optional notes.
- System creates a **Project** automatically (if one doesn't exist yet) at stage `site_visit_assigned`.
- System creates a **Site Visit Task** assigned to the selected Site Engineer with `flowStage: site_visit`.
- Project stage: `site_visit_assigned` (15% progress)
- Lead status becomes: `won` (linked to project)

**Task flows to → Site Engineer**

---

### STAGE 2 — Site Visit
**Actor: Site Engineer**  
**FlowStage:** `site_visit`

The Site Engineer receives the site visit task in their "My Tasks" view.

Site Engineer does:
- Uploads **site photos**
- Uploads **measurement files / photos**
- Enters measurement details
- Records **voice notes** (for production team and installation team)
- Pins the **Google Maps location**

Two outcomes:
1. **Completed** → Task moves to `site_review`. LM gets "Review Site Visit & Create Quotation" task.
2. **Cannot visit (reschedule)** → Task moves to `reschedule_review`. LM reviews and re-assigns date.

Project stage: `site_visit_completed` (20% progress)

**Task flows to → Lead Owner (LM)**

---

### STAGE 2b — Reschedule Review (if SE couldn't visit)
**Actor: LO**  
**FlowStage:** `reschedule_review`

- LM sees the SE's reschedule reason.
- LM sets a new visit date and sends the task back to SE.
- Flow returns to `site_visit`.

**Task flows back to → Site Engineer**

---

### STAGE 3 — Quotation Preparation
**Actor: LO**  
**FlowStage:** `site_review`

LM reviews the site visit report and creates the quotation:

- Views site photos, measurement details, voice notes from SE.
- Enters **Quotation Amount (₹)**.
- Uploads **Quotation PDF or document**.
- Fills in **Cost Breakdown** (Material, Transport, Total Sq. ft → auto-calculates Production & Installation cost).
- Adds notes / terms.
- Submits for **Owner Approval**.

Project stage: `quotation_sent_owner` (30% progress)

**Task flows to → MD/ED (Owner)**

---

### STAGE 4 — Owner Approval (MD/ED)
**Actor: MD / ED**  
**FlowStage:** `owner_approval`

MD/ED reviews the full quotation:
- Quotation Amount
- Cost Breakdown (Material, Production, Installation, Transport)
- **Profit** (₹ and %) — **visible to MD/ED only**

Two outcomes:
1. **Approved** → LM gets "Send Quotation to Client" task. Project stage: `owner_approved` (40%).
2. **Rejected** → LM gets "Rework Quotation" task with rejection reason. Flow goes back to `site_review`.

**Task flows to → LO (approved) or LO for rework (rejected)**

---

### STAGE 5 — Send Quotation to Client
**Actor: LO**  
**FlowStage:** `send_to_client`

LM sends the approved quotation to the client (via WhatsApp, email, etc.).

Project stage: `sent_to_client` (45% progress)

Client response outcomes:
1. **Client Approved** → Move to advance payment. Stage: `client_approved` (50%).
2. **Client Wants Negotiation** → LM enters negotiation notes. Stage: `negotiation` (48%).
3. **Client Rejected** → Project marked as lost / follow-up noted.

**Task flows to → LO (advance payment or negotiation follow-up)**

---

### STAGE 6 — Advance Payment
**Actor: LO**  
**FlowStage:** `advance_payment`

LM collects the advance payment from the client:
- Records advance amount
- Uploads payment screenshot / proof

Project stage: `advance_payment` (55% progress)

Once advance is confirmed, LM releases to production:
- LM uploads Job Sheet, Cutting Sheet, Glass Sheet documents.
- LM assigns the Production Admin for availability check.

**Task flows to → Production Admin**

---

### STAGE 7 — Production Material Check
**Actor: Production Admin**  
**FlowStage:** `production_check`

Production Admin checks if all materials are available:

Checklist:
- Profile ✓/✗
- Glass ✓/✗
- Hardware ✓/✗

Two outcomes:
1. **All Available** → Production Admin releases to Production Manager. Stage: `production_admin_check` (60%).
2. **Not Available** → LM gets a critical follow-up task to source material. Stage waits.

**Task flows to → Production Manager (if available) or LO (if not available)**

---

### STAGE 8 — Production Work
**Actor: Production Manager**  
**FlowStage:** `production_work`

Production Manager executes production using the 6-step checklist:

| Step | Description |
|---|---|
| Profile Cutting | Cut aluminium/UPVC profiles to size |
| Routing | Route/mill the profiles |
| Steel | Steel reinforcement (if applicable) |
| Welding | Weld corner joints |
| Assembling | Assemble frame and sashes |
| Glazing | Fix glass panels |

- Manager ticks off each step with timestamp.
- Can mark production as **overdue** with a new expected date.
- Can upload production photos.
- Voice notes from site visit (for production) are visible here.

Project stage: `production_manager_work` (65%) → `ready_to_dispatch` (80% when done)

When complete → LM gets "Assign Installation Incharge" task.

**Task flows to → LO**

---

### STAGE 9 — Installation Assignment
**Actor: LO**  
**FlowStage:** `installation_assign`

LM assigns the Installation Incharge (Technician):
- Selects technician from managed users
- Sets installation date
- Sets client location
- Adds notes

Project stage: `installation` (85% progress)

**Task flows to → Technician / Installation Incharge**

---

### STAGE 10 — Installation
**Actor: Technician / Installation Incharge**  
**FlowStage:** `installation_update`

Technician does the installation at the client site:
- Views client location (Google Maps link available)
- Marks **Installation Complete** with:
  - Upload installation photos as proof
  - Notes on what was done

Three outcomes:
1. **Completed** → LM gets "Collect Final Payment" task.
2. **Partial / Not Completed** → Technician adds reason; follow-up task created.
3. **Mistake** → Mistake logged; routed through mistake workflow before continuing.

**Task flows to → LO**

---

### STAGE 11 — Final Payment
**Actor: LO**  
**FlowStage:** `final_payment`

LM collects the remaining balance from the client:
- Advance already paid is shown
- Balance amount calculated automatically
- Records final payment
- Uploads payment proof

Project stage: `final_payment` (90% progress)

Once full payment received → Move to Final Completion.

**Task flows to → LO (final completion step)**

---

### STAGE 12 — Project Completion
**Actor: LO or MD/ED**  
**FlowStage:** `final_completion`

Final wrap-up:
- Record actual cost breakdown (Material, Production, Installation, Transport)
- MD/ED can see final **Profit** (₹ + %)
- Send **Google Review link** to client via WhatsApp
- Mark project as **Completed**

Project stage: `completed` (100% progress)

---

## 5. Role-to-Role Connection Map

```
Lead Created (LO/MD)
        │
        ▼
Lead Qualified (LO/MD)
        │
        ▼
Assign Site Engineer ──────── (LO assigns SE)
        │
        ▼
Site Visit ─────────────────── (SE does visit, uploads photos)
        │
        ▼ (visit done)
Quotation Prep ─────────────── (LO creates quotation from SE data)
        │
        ▼
Owner Approval ─────────────── (MD/ED approves or rejects)
        │                              │
        │ (approved)                   │ (rejected)
        ▼                              ▼
Send to Client ──────────────  Rework Quotation (LO)
        │
        ▼ (client approved)
Advance Payment ────────────── (LO collects, uploads proof)
        │
        ▼
Material Check ─────────────── (Production Admin checks stock)
        │                              │
        │ (available)                  │ (not available)
        ▼                              ▼
Production Work ─────────────  LO follow-up on stock
(Production Manager)
        │
        ▼
Assign Installation ─────────── (LO assigns Technician)
        │
        ▼
Installation ───────────────── (Technician does work, uploads proof)
        │
        ▼
Final Payment ──────────────── (LO collects balance)
        │
        ▼
Project Complete ───────────── (LO / MD marks done, sends Google Review)
```

---

## 6. Who Sees What — Summary by Role

### MD / ED / Admin (`owner`)
- Full access to everything.
- The only role that can **approve or reject quotations**.
- The only role that can **see profit** (₹ amount + %) in the cost breakdown.
- Can navigate forward/backward through any workflow step at any time.
- Can edit **account/client name** on a project.
- Sees all leads, all projects, all reports.

### Lead Owner / LO (`lead_manager`)
- Manages the entire client relationship from lead to final payment.
- **Owns the flow handoffs** — assigns SE, assigns Technician, sends quotation, collects payments.
- Sees only **their own leads** and **their own projects** (those assigned to them via `ownerId`).
- Cannot see profit. Cannot approve quotations.
- Can create and edit leads and projects.
- Can edit project dates (start date, due date).

### Site Engineer (`site_engineer`)
- Only sees projects where they are **assigned to the site visit task**.
- Only sees the **Measurement** filter chip in the projects screen.
- Can **upload site photos, measurements, voice notes, location pin**.
- Can reschedule if they cannot attend (sends request back to LM).
- Cannot see leads, quotation amounts, payments, or production.

### Production Admin (`production_admin`)
- Only sees projects in the **Pre-Production** stage (material check pending).
- Runs the **material availability checklist** (Profile / Glass / Hardware).
- Marks each item available or unavailable.
- If all available, releases to Production Manager.
- If not available, alerts LM via a follow-up task.
- Cannot see leads, quotations, payments, or installation.

### Production Manager (`production_manager`)
- Only sees projects in the **Production** stage.
- Runs the **6-step production checklist** (Cutting → Routing → Steel → Welding → Assembling → Glazing).
- Marks each step done with timestamp.
- Can mark as overdue with a new expected date.
- Can upload production photos.
- Can view voice notes left by the Site Engineer for production team.
- Cannot see leads, quotations, payments, or installation.

### Technician / Installation Incharge (`technician`)
- Only sees projects in the **Installation** stage.
- Receives installation task with client location (Google Maps link shown).
- Marks installation as **Completed** or **Not Completed / Partial**.
- Uploads installation photos as proof.
- Can log a **mistake** if something goes wrong during installation.
- Cannot see leads, quotations, payments, or production.

---

## 7. Key Handoff Summary

| From | Action | To |
|---|---|---|
| LO / MD | Assigns Site Engineer | Site Engineer |
| Site Engineer | Completes site visit | Lead Owner (LM) |
| Lead Owner | Submits quotation | MD / ED (Owner) |
| MD / ED | Approves quotation | Lead Owner (LM) |
| MD / ED | Rejects quotation | Lead Owner (LM) — rework |
| Lead Owner | Sends to client + collects advance | Production Admin |
| Production Admin | Confirms materials available | Production Manager |
| Production Admin | Materials not available | Lead Owner (LM) — stock follow-up |
| Production Manager | Production complete | Lead Owner (LM) |
| Lead Owner | Assigns installation | Technician |
| Technician | Installation complete | Lead Owner (LM) |
| Lead Owner | Final payment collected | MD / ED — project closed |

---

## 8. Progress Milestones

| Stage | Progress |
|---|---|
| New Project Created | 5% |
| Measurement (Site Visit Assigned) | 15% |
| Site Visit Completed | 20% |
| Quotation Prepared | 25% |
| Sent for Owner Approval | 30% |
| Owner Approved | 40% |
| Sent to Client | 45% |
| Client Approved | 50% |
| Advance Payment | 55% |
| Production Check | 60% |
| Production Work | 65% |
| Ready to Dispatch | 80% |
| Installation | 85% |
| Final Payment | 90% |
| Completed | 100% |
