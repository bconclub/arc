# Dig Report: Scheduled Callback Blocking

**Agent:** Cloud Agent cursor/scheduled-callback-exception-e490  
**Date:** 2026-09-10  
**Issue:** Scheduled evening callbacks blocked by 24h dial cooldown  
**Status:** ✅ Draft PR ready for review

---

## Executive Summary

Scheduled callbacks with CEO-approved `next_at` times were being blocked by the 24-hour dial reservation cooldown designed to prevent accidental cold redials. The fix adds a safe exception that allows callbacks only when `next_at` is due (`<= now()`), preserving all existing safety guards for regular outreach.

---

## Incident Details

**Real Case (2026-09-09):**
- **Target:** Aadya Whitefield
- **Record ID:** `c53676b1-f399-413e-b240-9206e90ac503`
- **Phone:** `6366360115`
- **Timeline:**
  - Morning: Initial dial succeeded, created reservation
  - Evening: Scheduled callback (CEO-approved `next_at`) attempted
  - **Blocked:** HTTP 409 `{reason:"recently_called"}`
  - **Workaround:** Manual aging of `reserved_at` to -25h

---

## Root Cause Analysis

### System Design
The dial reservation system has two layers of 24-hour cooldown protection:

1. **TypeScript API** (`route.ts` line 24):
   ```typescript
   if (data && Date.now()-Date.parse(data.reserved_at)<86400000)
     return Response.json({ reason: 'recently_called' }, { status: 409 });
   ```

2. **Postgres RPC** (`reserve_outreach_dial`):
   ```sql
   on conflict(phone) do update set ...
   where outreach_dial_reservations.reserved_at <= now() - interval '24 hours'
   ```

### The Gap
The cooldown is **correct for cold outreach** but doesn't distinguish between:
- ❌ Accidental same-day redial (should block)
- ✅ Scheduled callback with due `next_at` (should allow)

**Missing context:** The system didn't check `outreach_targets.next_at` when evaluating cooldown.

---

## Solution Design

### Hypothesis Validation ✅

**Initial hypothesis:** Allow reserve when `next_at <= now()`

**Validation:** Confirmed safe by verifying:
1. `next_at` is explicitly set by CEO for approved callbacks
2. `next_at` exists in schema (created 20260821000000)
3. `next_at` is used throughout system for callback scheduling
4. Status checks (`lost`/`won`) already in place

### Implementation

#### 1. Database Migration
**File:** `supabase/migrations/20260910000000_callback_reserve_exception.sql`

```sql
create or replace function public.reserve_outreach_dial(
  dial_phone text,
  worker_name text,
  target_id uuid default null  -- NEW: optional for callback check
) returns uuid ...
```

**Logic:**
1. Check if `target_id` provided AND has due `next_at`
2. Set `is_callback` flag if conditions met
3. Allow reservation update if `is_callback` OR normal 24h window passed

#### 2. API Route Update
**File:** `src/app/api/agent/outreach/reserve/route.ts`

**Changes:**
1. Query `next_at` for matched target
2. Calculate `isScheduledCallback = next_at && next_at <= now()`
3. **Dry run:** Apply cooldown only if NOT scheduled callback
4. **Live:** Pass `target_id` to RPC for callback check
5. Return `callback: true` flag for telemetry

---

## Safety Analysis

| Scenario | `next_at` | Status | Cooldown | Result | Rationale |
|----------|-----------|--------|----------|--------|-----------|
| Cold redial | `null` or future | Any | Active | ❌ Blocked | Prevents accidents |
| Scheduled callback | `<= now()` | `replied` | Active | ✅ Allowed | **Fix target** |
| Scheduled callback | `<= now()` | `lost`/`won` | Active | ❌ Blocked | Closed target guard |
| Fresh dial | N/A | Any | None | ✅ Allowed | Normal path |

**Key Safety Properties:**
- ✅ Never weakens 24h guard for cold outreach
- ✅ Exception requires explicit `next_at` set by CEO
- ✅ Exception requires `next_at` to be due (not future)
- ✅ Closed targets (`lost`/`won`) still blocked
- ✅ Backward compatible (optional parameter)

---

## Test Plan

### Unit Tests
1. **Cold redial blocked** (existing behavior):
   - No `next_at` → 409 within 24h
   
2. **Scheduled callback allowed** (new behavior):
   - `next_at = 2026-09-10T14:00:00Z` (past)
   - Status = `replied`
   - Morning dial + evening dial → both succeed

3. **Future callback blocked**:
   - `next_at = tomorrow` → 409 within 24h

4. **Closed target blocked**:
   - `next_at = past`, status = `won` → 409

### Integration Tests
- Reproduce Aadya Whitefield scenario with test target
- Verify dual-dial (morning + evening) works
- Confirm no impact on regular outreach

---

## Deliverables

### Pull Request
**URL:** https://github.com/bconclub/arc/pull/16  
**Status:** Draft (ready for review)  
**Title:** Fix: Allow scheduled callbacks to bypass 24h dial cooldown

**Files Changed:**
1. `supabase/migrations/20260910000000_callback_reserve_exception.sql` (new)
2. `src/app/api/agent/outreach/reserve/route.ts` (modified)

### Migration Status
⚠️ **Not applied live** — awaiting CEO approval for schema change

**Safety:** Migration is backward compatible (optional parameter, no data changes)

---

## Conclusion

**Root Cause:** 24h cooldown didn't account for scheduled callbacks with due `next_at`

**Fix:** Safe exception that checks `next_at <= now()` before enforcing cooldown

**Impact:**
- ✅ Unblocks scheduled callbacks
- ✅ Preserves all safety guards for cold outreach
- ✅ No behavior change for existing workflows
- ✅ Backward compatible

**Next Steps:**
1. Review draft PR #16
2. CEO approval for migration
3. Apply migration to Supabase
4. Verify with test target
5. Mark PR ready for merge

---

**Attribution:** DEV Cloud Agent (BCON/PROXe)
