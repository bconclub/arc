# Outreach 10-Cap Fix - Implementation Summary

## Problem Statement
The Arc Outreach UI was limiting the display of active prospects (identified, researched, drafted statuses) to exactly 10 items. With 23+ business leads in Bangalore prospecting, BDRs could not review the full pipeline without searching for each lead individually.

## Solution Implemented

### 1. Preserved Daily Workflow
- **"Today's 10"** section remains unchanged
- Shows first 10 ACTIVE targets (identified, researched, drafted)
- Maintains the 10/day working set motion

### 2. Added "Show All Prospects" Capability
- Button appears when there are >10 active targets
- Toggles to "All prospects" view showing complete unfiltered list
- "Back to Today's 10" button returns to daily view

### 3. Status Filter Chips
Added comprehensive status filtering:
- **"All"** - Shows all targets (default)
- **"Active (prospecting)"** - One-click filter for identified/researched/drafted
- Individual status chips for all 9 statuses with counts:
  - identified, researched, drafted (ACTIVE)
  - sent, replied, meeting, won, lost, no_reply (PIPELINE)

### 4. State Management
New state variables:
```typescript
const [statusFilter, setStatusFilter] = useState<OutreachStatus | "active" | null>(null);
const [showAllProspects, setShowAllProspects] = useState(false);
```

New computed lists:
```typescript
const allProspects = useMemo(
  () => filtered.filter((t) => ACTIVE.includes(t.status)),
  [filtered],
);
```

### 5. Filter Logic
Status filters work in combination with:
- Kind tabs (All, Businesses, Investors, Grants, Citations)
- Search query
- No conflicts or race conditions

## Technical Details

### Files Changed
- `src/app/dashboard/outreach/page.tsx` (+111 lines, -22 lines)

### Key Changes
1. **Filtering Logic** (lines 62-80):
   - Added status filter to the filtered memo
   - "active" filter maps to ACTIVE array
   - Individual status filters match exactly

2. **UI Layout** (lines 253-366):
   - Status filter chip row with counts
   - Conditional rendering of "Today's 10" vs "All prospects"
   - "Show all" button only appears when needed (>10 active)
   - "Back to Today's 10" button in expanded view

3. **No Breaking Changes**:
   - Existing "Today's 10" behavior unchanged
   - Pipeline section still shows non-ACTIVE statuses
   - Modal, forms, actions unchanged

## User Experience

### Default View (≤10 active targets)
- Shows "Today's 10" section
- No "Show all" button needed
- Works exactly as before

### Extended View (>10 active targets)
1. See "Today's 10" with first 10 prospects
2. Click "Show all {count} prospects" button
3. View expands to show ALL active targets
4. Click "Back to Today's 10" to return

### With Status Filters
1. Click "Active (prospecting)" → Shows all identified/researched/drafted
2. Click "identified" → Shows only identified status (e.g., all 23+ Bangalore leads)
3. Click individual status → Filter to that status
4. Works with kind tabs and search

## Testing Scenarios

✅ **Scenario 1: Businesses tab with 23+ identified leads**
- Select "Businesses" tab
- Click "identified" status filter
- Result: All 23+ business leads visible

✅ **Scenario 2: Today's 10 workflow**
- Default view shows first 10 active
- BDR works through daily queue
- No change to existing behavior

✅ **Scenario 3: Full prospecting review**
- Click "Show all prospects" button
- See complete list of active targets
- Review, update status, move forward

✅ **Scenario 4: Combined filters**
- Select "Businesses" kind
- Click "Active (prospecting)" status
- Search for "Bangalore"
- Result: Filtered view of Bangalore business prospects

## Deployment

- **Migration**: None required
- **Breaking Changes**: None
- **Rollback**: Safe (pure UI change)
- **Environment**: Works in all environments

## PR Details
- **Branch**: `cursor/fix-outreach-10-cap-1bd2`
- **PR**: https://github.com/bconclub/arc/pull/2
- **Status**: Draft (ready for review)
