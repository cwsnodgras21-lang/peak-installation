# Database & Workflow Guardrails

## 1. One Current Schedule Version Per Project

**Status:** Enforced at DB level (migration 003).

- Unique partial index: `schedule_versions_one_current_per_project` on `(project_id) WHERE (is_current = true)`
- Only one row per project can have `is_current = true`.

---

## 2. One Change Order Per Exposure (V0.5)

**Status:** Enforced at DB level (migration 006).

- Unique partial index: `change_orders_one_per_exposure` on `(financial_exposure_id) WHERE (financial_exposure_id IS NOT NULL)`
- Manual change orders (no linked exposure) remain allowed via `financial_exposure_id = null`.

---

## 3. Delete Protection

**Status:** Enforced at DB level (migration 006).

| Table               | Delete allowed? | Notes                                      |
|---------------------|-----------------|--------------------------------------------|
| schedule_versions   | No              | Trigger blocks all deletes                 |
| financial_exposures | Only if unlinked| Blocked when linked to any change_order    |
| change_orders       | No              | Use `status = cancelled` instead           |
| schedule_labor_weeks| Yes             | Editing current version; no history impact |

---

## 4. Client-Driven Exposure Creation (Workflow Rule)

**Status:** App-level only. Not enforced at DB.

**Current flow:**
1. App calls `create_schedule_version` RPC with `p_client_driven: true` for client_driven or scope_change.
2. RPC creates the schedule version.
3. App separately inserts a `financial_exposures` row.

**Gap:** If step 3 fails (network, error), the schedule version exists without the exposure. The rule "client-driven or scope-change revision must create an exposure" is only enforced in the app.

**Mitigation:** The app logic is in one function (`handleCreateVersion`); exposure creation runs immediately after RPC success. No DB trigger exists because `schedule_versions` has no `client_driven` flag—that is passed only to the RPC. Full DB enforcement would require either:
- RPC to create the exposure (recommended for a future slice), or
- A `client_driven` column on `schedule_versions` plus an INSERT trigger.

---

## 5. Tenant Safety Audit

**RLS:** All key tables use `current_tenant_id()` in RLS policies. Users can only read/write rows where `tenant_id = current_tenant_id()`.

**App writes (tenant_id usage):**

| Table               | Insert                    | Update                         | Delete                         |
|---------------------|---------------------------|--------------------------------|--------------------------------|
| schedule_versions   | Via RPC (tenant from project) | N/A (version immutable)        | Blocked                        |
| schedule_labor_weeks| `tenant_id` in payload     | Filter: id, schedule_version_id| Filter: id, schedule_version_id, tenant_id |
| financial_exposures | `tenant_id` in payload     | Filter: id, tenant_id          | Blocked when linked            |
| change_orders       | `tenant_id` in payload     | Filter: id, tenant_id          | Blocked                        |

**Note:** `schedule_labor_weeks` update uses `id` and `schedule_version_id`; RLS ensures the row is in the user's tenant. Adding `.eq("tenant_id", ...)` would be defense-in-depth but is redundant with RLS.

---

## 6. Migration Order

Run migrations in order: 001 → 002 → 003 → 004 → 005 → 006.
