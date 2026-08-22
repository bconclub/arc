# Testing Guide - Outreach 10-Cap Fix

## Prerequisites

1. Arc instance running at `https://arc.bconclub.com`
2. User with access to Outreach dashboard
3. Test data: 23+ business leads with status=identified

## Test Scenarios

### Scenario 1: Verify Default View (≤10 Active Targets)

**Setup**: Ensure there are 10 or fewer active targets

**Steps**:
1. Navigate to `/dashboard/outreach`
2. Observe "Today — research, draft, send (X/10)" section

**Expected**:
- ✅ Shows up to 10 active targets
- ✅ NO "Show all prospects" button appears
- ✅ Pipeline section shows non-active targets
- ✅ Layout matches original design

---

### Scenario 2: Verify "Show All" Button Appears (>10 Active)

**Setup**: Ensure there are more than 10 active targets (identified/researched/drafted)

**Steps**:
1. Navigate to `/dashboard/outreach`
2. Scroll to "Today's 10" section
3. Look for button below the 10th target

**Expected**:
- ✅ Button appears: "Show all {count} prospects (identified, researched, drafted)"
- ✅ Count matches actual number of active targets
- ✅ Button has full width with clear styling

---

### Scenario 3: Toggle to "All Prospects" View

**Setup**: More than 10 active targets exist

**Steps**:
1. Navigate to `/dashboard/outreach`
2. Click "Show all {count} prospects" button
3. Observe layout change

**Expected**:
- ✅ "Today's 10" section disappears
- ✅ "ALL PROSPECTS — {count} ACTIVE" header appears
- ✅ All active targets visible (not just 10)
- ✅ "Back to Today's 10" button visible in header
- ✅ Pipeline section is hidden
- ✅ Can scroll through all targets

---

### Scenario 4: Toggle Back to "Today's 10"

**Setup**: "All Prospects" view is active

**Steps**:
1. Click "Back to Today's 10" button
2. Observe layout change

**Expected**:
- ✅ Returns to default view
- ✅ "Today's 10" section shows first 10 targets
- ✅ "Show all" button reappears
- ✅ Pipeline section reappears
- ✅ Scroll position resets to top

---

### Scenario 5: Status Filter - "All" (Default)

**Steps**:
1. Navigate to `/dashboard/outreach`
2. Observe status filter row below kind tabs
3. Verify "All" chip is active (bold, strong border)

**Expected**:
- ✅ Status filter row visible
- ✅ "All" button has active styling
- ✅ Shows all targets regardless of status
- ✅ Counts on other chips are accurate

---

### Scenario 6: Status Filter - "Active (prospecting)"

**Steps**:
1. Click "Active (prospecting)" status chip
2. Observe filtered results

**Expected**:
- ✅ "Active (prospecting)" chip becomes active (bold, strong border)
- ✅ Only shows targets with identified/researched/drafted status
- ✅ "All" chip returns to inactive state
- ✅ "Today's 10" section updates with filtered results
- ✅ Count in header updates: "Today — research, draft, send (X/10)"

---

### Scenario 7: Status Filter - "identified" (Bangalore Business Leads)

**Setup**: Businesses tab, 23+ business leads with status=identified

**Steps**:
1. Click "Businesses" kind tab
2. Click "identified" status chip
3. Observe filtered results

**Expected**:
- ✅ "identified" chip becomes active
- ✅ Shows all 23+ identified business leads
- ✅ If >10, "Show all {count} prospects" button appears
- ✅ Clicking "Show all" displays complete list of identified leads
- ✅ Each lead shows gray status dot (identified color)

---

### Scenario 8: Status Filter - Individual Status

**Steps**:
1. Click any status chip (researched, drafted, sent, replied, etc.)
2. Observe filtered results

**Expected**:
- ✅ Selected status chip becomes active
- ✅ Only targets with that status are shown
- ✅ Count in chip matches displayed targets
- ✅ Colored dot matches status (blue, orange, green, red)

---

### Scenario 9: Combined Filter - Kind + Status

**Steps**:
1. Click "Businesses" kind tab
2. Click "identified" status chip
3. Verify only business leads with identified status appear

**Expected**:
- ✅ Both filters applied correctly
- ✅ Results are intersection of kind AND status
- ✅ Can click "Show all" if >10 results
- ✅ Pipeline section shows only non-active businesses (if statusFilter="identified", Pipeline would be empty)

---

### Scenario 10: Combined Filter - Kind + Status + Search

**Steps**:
1. Click "Businesses" kind tab
2. Click "identified" status chip
3. Type "Bangalore" in search box
4. Verify results

**Expected**:
- ✅ All three filters applied
- ✅ Results match: business + identified + "Bangalore" in any field
- ✅ Search highlights work across filtered results
- ✅ Clear search shows all business+identified results

---

### Scenario 11: Search + Status Filter

**Steps**:
1. Type a name/org/city in search box
2. Click "identified" status chip
3. Observe filtered results

**Expected**:
- ✅ Results match both search query AND status
- ✅ Filters combine correctly
- ✅ Clear search to see all identified targets

---

### Scenario 12: Clear Status Filter

**Steps**:
1. Select any status filter
2. Click "All" status chip
3. Observe results

**Expected**:
- ✅ Status filter is cleared
- ✅ "All" chip becomes active
- ✅ Shows all targets (respecting kind/search filters)
- ✅ "Today's 10" and Pipeline sections return to default behavior

---

### Scenario 13: Status Filter with "Show All" Toggled

**Setup**: More than 10 active targets, "All Prospects" view active

**Steps**:
1. Click "Show all prospects" to expand
2. Click "identified" status chip
3. Observe filtered results in expanded view

**Expected**:
- ✅ Filtered results show in "All Prospects" view
- ✅ Count updates: "ALL PROSPECTS — {filtered count} ACTIVE"
- ✅ Only identified targets visible
- ✅ No unexpected re-rendering or flashing

---

### Scenario 14: Empty State - No Active Targets

**Setup**: Move all targets to sent/replied/etc (non-ACTIVE statuses)

**Steps**:
1. Navigate to `/dashboard/outreach`
2. Observe "Today's 10" section

**Expected**:
- ✅ "Today's 10" section shows empty state message
- ✅ Message: "No active targets. Add one or use Suggest."
- ✅ NO "Show all prospects" button
- ✅ Pipeline section shows sent/replied/etc targets

---

### Scenario 15: Empty State - Status Filter with No Results

**Steps**:
1. Click a status chip that has 0 targets
2. Observe results

**Expected**:
- ✅ "Today's 10" section shows empty state
- ✅ Message: "No active targets. Add one or use Suggest."
- ✅ NO "Show all prospects" button
- ✅ Pipeline section empty (if filtering to active status) or shows non-active

---

### Scenario 16: Click Target in Default View

**Steps**:
1. Default view with "Today's 10"
2. Click any target row
3. Observe modal opens

**Expected**:
- ✅ Target modal opens with full details
- ✅ Can edit fields, run research, draft, etc.
- ✅ Save updates the target
- ✅ Modal closes, list refreshes
- ✅ Target remains in correct position/section

---

### Scenario 17: Click Target in "All Prospects" View

**Steps**:
1. Expand to "All Prospects" view
2. Scroll to a target beyond 10th position
3. Click the target
4. Edit and save

**Expected**:
- ✅ Modal opens for the correct target
- ✅ Can edit and save normally
- ✅ After save, view remains in "All Prospects" mode
- ✅ Target updates in place

---

### Scenario 18: Change Target Status from Identified to Researched

**Setup**: "All Prospects" view with 23 identified targets

**Steps**:
1. Click an identified target
2. Change status to "researched"
3. Save and close modal

**Expected**:
- ✅ Target remains in "All Prospects" view (still ACTIVE)
- ✅ Status dot changes to blue (researched color)
- ✅ Status chip counts update: identified -1, researched +1
- ✅ If filtering by "identified", target disappears from view

---

### Scenario 19: Change Target Status from Drafted to Sent

**Setup**: "All Prospects" view active

**Steps**:
1. Click a drafted target
2. Change status to "sent"
3. Save and close modal

**Expected**:
- ✅ Target moves from "All Prospects" to Pipeline section
- ✅ If "All Prospects" view, target disappears
- ✅ Toggle back to "Today's 10", target in Pipeline
- ✅ Status chip counts update: drafted -1, sent +1

---

### Scenario 20: Add New Target While in "All Prospects" View

**Steps**:
1. Expand to "All Prospects" view
2. Click "+ Target" button
3. Create new business with status=identified
4. Save

**Expected**:
- ✅ New target appears in "All Prospects" view
- ✅ Count updates: "ALL PROSPECTS — {count+1} ACTIVE"
- ✅ Toggle back to "Today's 10" to verify it's included

---

### Scenario 21: Responsive - Mobile/Small Screen

**Steps**:
1. Resize browser to mobile width (375px)
2. Observe layout

**Expected**:
- ✅ Status filter chips wrap to multiple lines
- ✅ "Show all prospects" button remains full-width
- ✅ Target rows remain readable and tappable
- ✅ No horizontal scroll

---

### Scenario 22: Performance - 100+ Active Targets

**Setup**: Create test data with 100+ active targets

**Steps**:
1. Navigate to `/dashboard/outreach`
2. Click "Show all prospects"
3. Scroll through list

**Expected**:
- ✅ Page loads without lag
- ✅ Scrolling is smooth
- ✅ Count displays correctly: "ALL PROSPECTS — 100+ ACTIVE"
- ✅ Filters apply without noticeable delay

---

### Scenario 23: Browser Back/Forward

**Steps**:
1. Start in default view
2. Click "Show all prospects"
3. Click browser back button
4. Click browser forward button

**Expected**:
- ✅ View state resets (no URL state management in this implementation)
- ✅ Returns to default "Today's 10" view
- ✅ No errors or broken state

---

### Scenario 24: Refresh Page in "All Prospects" View

**Steps**:
1. Expand to "All Prospects" view
2. Press F5 or Cmd+R to refresh

**Expected**:
- ✅ Page reloads to default "Today's 10" view
- ✅ showAllProspects state resets to false
- ✅ All data reloads correctly

---

## Regression Testing

### Existing Features to Verify (Should Be Unchanged)

1. **Search Functionality**
   - ✅ Search by name, org, segment, city, email, status works
   - ✅ Search results update in real-time
   - ✅ Search works with kind tabs

2. **Kind Tabs**
   - ✅ All, Businesses, Investors, Grants, Citations tabs work
   - ✅ Switching tabs filters correctly
   - ✅ Counts remain accurate

3. **Suggest Feature**
   - ✅ "Suggest" button opens modal
   - ✅ Can search for candidates by segment/city
   - ✅ "Add" button creates new targets
   - ✅ New targets appear in list

4. **Target Modal**
   - ✅ Opens on target click
   - ✅ All fields editable
   - ✅ Research button works
   - ✅ Draft email button works
   - ✅ Save/Delete work correctly

5. **Messages/Replies**
   - ✅ Messages display in modal
   - ✅ Log reply feature works
   - ✅ Status changes to "replied" on log

6. **Pipeline Section**
   - ✅ Shows sent/replied/meeting/won/lost/no_reply targets
   - ✅ Counts match
   - ✅ Clicking targets opens modal

---

## Edge Cases

### Edge Case 1: Exactly 10 Active Targets
- ✅ "Show all" button should NOT appear
- ✅ "Today's 10" shows all 10
- ✅ Count: (10/10)

### Edge Case 2: 11 Active Targets
- ✅ "Show all" button appears: "Show all 11 prospects..."
- ✅ "Today's 10" shows first 10
- ✅ "All Prospects" shows all 11

### Edge Case 3: 0 Active Targets, 20 Pipeline Targets
- ✅ Empty state in "Today's 10"
- ✅ NO "Show all" button
- ✅ Pipeline shows all 20 targets

### Edge Case 4: Status Filter Results in Exactly 10
- ✅ NO "Show all" button
- ✅ Shows all 10 in "Today's 10"

### Edge Case 5: All Targets Filtered Out
- ✅ Empty state message
- ✅ NO "Show all" button
- ✅ Clear instructions to add/suggest

---

## Accessibility

### Keyboard Navigation
1. Tab through status filter chips
2. Press Enter/Space to activate filter
3. Tab to "Show all" button, press Enter
4. Verify focus management

### Screen Reader
1. Status chips announce state changes
2. Button announces count correctly
3. Headers announce section changes

---

## Browser Compatibility

Test in:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

---

## Sign-Off Checklist

- [ ] All 24 scenarios pass
- [ ] Regression tests pass
- [ ] Edge cases handled
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Accessibility verified
- [ ] Responsive design works
- [ ] Browser compatibility confirmed

---

## Critical Path for Bangalore Prospecting

**User Story**: BDR needs to review all 23+ business leads in identified status

**Test Steps**:
1. Navigate to `/dashboard/outreach`
2. Click "Businesses" kind tab
3. Click "identified" status chip
4. Verify all 23+ business leads are visible
5. If >10, click "Show all prospects"
6. Review complete list
7. Click targets to update status/fields
8. Verify changes persist

**Success Criteria**:
- ✅ All 23+ leads accessible without individual search
- ✅ Can review and update leads efficiently
- ✅ Status chips provide quick filtering
- ✅ "Show all" enables full pipeline review
