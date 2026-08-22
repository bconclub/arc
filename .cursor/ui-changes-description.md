# UI Changes Description - Outreach 10-Cap Fix

## Visual Layout Changes

### 1. Status Filter Row (NEW)
**Location**: Below the kind tabs (All, Businesses, Investors, Grants, Citations)

**Components**:
```
Status: [All] [Active (prospecting)] [• identified (23)] [• researched (5)] [• drafted (3)] [• sent (12)] ...
```

**Behavior**:
- Clicking "All" removes status filter (default state)
- Clicking "Active (prospecting)" filters to identified + researched + drafted
- Clicking individual status filters to only that status
- Each status chip shows colored dot + label + count
- Active filter has stronger border and bold text

### 2. Today's 10 Section (MODIFIED)
**Before**:
```
TODAY — RESEARCH, DRAFT, SEND (10/10)
[Target 1]
[Target 2]
...
[Target 10]
```

**After** (when >10 active targets exist):
```
TODAY — RESEARCH, DRAFT, SEND (10/10)
[Target 1]
[Target 2]
...
[Target 10]

[Show all 23 prospects (identified, researched, drafted)] ← NEW BUTTON
```

**Behavior**:
- Button only appears when `allProspects.length > 10`
- Button shows exact count of active prospects
- Clicking toggles to "All prospects" view

### 3. All Prospects View (NEW)
**Layout** (replaces Today's 10 when toggled):
```
ALL PROSPECTS — 23 ACTIVE        [Back to Today's 10] ← NEW BUTTON
[Target 1]
[Target 2]
...
[Target 23]
↓ (no 10-cap, shows all)
```

**Behavior**:
- Shows complete list of ACTIVE targets without slice(0, 10)
- Header shows total count
- "Back to Today's 10" button returns to default view
- Pipeline section is hidden in this view

### 4. Pipeline Section (UNCHANGED, but conditional)
**Visibility**:
- Shows when `!showAllProspects && rest.length > 0`
- Hidden when viewing "All prospects"

```
PIPELINE (15)
[Sent target 1]
[Replied target 2]
...
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ DEFAULT VIEW                                             │
│                                                          │
│ Kind Tabs: [All] [Businesses] [Investors] ...          │
│ Status: [All*] [Active] [• identified (23)] ...        │
│                                                          │
│ TODAY'S 10 (10/10)                                      │
│ [Target 1-10]                                           │
│ [Show all 23 prospects] ← Click                         │
│                                                          │
│ PIPELINE (15)                                           │
│ [Sent/Replied/etc targets]                              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ ALL PROSPECTS VIEW                                       │
│                                                          │
│ Kind Tabs: [All] [Businesses] [Investors] ...          │
│ Status: [All*] [Active] [• identified (23)] ...        │
│                                                          │
│ ALL PROSPECTS — 23 ACTIVE    [Back to Today's 10] ← Click
│ [Target 1]                                              │
│ [Target 2]                                              │
│ ...                                                     │
│ [Target 23]                                             │
│                                                          │
│ (Pipeline section hidden)                               │
└─────────────────────────────────────────────────────────┘
                        ↓
                   (back to top)
```

## Filter Combinations

### Example 1: View All Identified Businesses
1. Click "Businesses" tab
2. Click "identified" status filter
3. Result: All 23+ identified business leads visible
4. Can click "Show all prospects" if needed

### Example 2: View Active Prospecting Only
1. Keep "All" tab selected
2. Click "Active (prospecting)" status filter
3. Result: Shows first 10 in Today's section
4. Click "Show all prospects" to see all 23+

### Example 3: Search + Filter
1. Type "Bangalore" in search
2. Click "Businesses" tab
3. Click "identified" status
4. Result: Filtered to Bangalore businesses in identified status

## Responsive Behavior

All filter chips wrap on smaller screens:
```
Status: [All] [Active]
[• identified (23)]
[• researched (5)]
...
```

"Show all" button is full-width:
```
┌────────────────────────────────────────┐
│ Show all 23 prospects (...)            │
└────────────────────────────────────────┘
```

## Color Scheme (Preserved)

Status dot colors match existing:
- identified: `bg-text-muted` (gray)
- researched: `bg-accent-blue` (blue)
- drafted: `bg-accent-orange` (orange)
- sent: `bg-accent-blue` (blue)
- replied: `bg-accent-green` (green)
- meeting: `bg-accent-green` (green)
- won: `bg-accent-green` (green)
- lost: `bg-accent-red` (red)
- no_reply: `bg-accent-red` (red)

## Interaction States

### Filter Chips
- **Default**: Light border, muted text
- **Hover**: Same border, normal text
- **Active**: Strong border, bold text, surface-hover background

### Show All Button
- **Default**: Light border, muted text
- **Hover**: Strong border, normal text, surface-hover background

### Back Button
- **Default**: Muted text
- **Hover**: Normal text
