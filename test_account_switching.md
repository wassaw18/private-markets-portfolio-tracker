# Account Switching Test Plan

## Test Date: 2025-10-20
## Objective: Verify LP data isolation and role-based access control

---

## Test Accounts

### 1. Fund Manager Account (testfm)
- **Username:** testfm
- **Password:** admin123
- **Account Type:** FUND_MANAGER
- **Expected Behavior:**
  - Full access to all investments
  - Can see Fund Dashboard
  - Can generate all report types
  - Can see all entities' data

### 2. LP Client Account (lp_demo)
- **Username:** lp_demo
- **Password:** admin123
- **Account Type:** LP_CLIENT
- **Entity:** Baum Family Trust (id: 3)
- **Expected Behavior:**
  - Only see Baum Family Trust investments
  - See LP Portal Dashboard (not Fund Dashboard)
  - Limited report access (Holdings only)
  - Cannot see other LPs' data

---

## Test Scenarios

### Scenario 1: Fund Manager Login (testfm)
**Steps:**
1. Navigate to http://172.23.5.82:3000
2. Login with username: `testfm`, password: `admin123`
3. Verify redirect to `/fund-dashboard`
4. Check Analytics section for total commitments
5. Navigate to Holdings page
6. Generate Holdings Report
7. Verify report shows ALL investments across all entities
8. Logout

**Expected Results:**
- ✓ Redirect to Fund Dashboard
- ✓ Analytics shows aggregate data across all entities
- ✓ Holdings page shows all investments
- ✓ Holdings report includes investments from multiple entities
- ✓ Total commitments > $96k (includes multiple entities)

### Scenario 2: LP Client Login (lp_demo)
**Steps:**
1. Navigate to http://172.23.5.82:3000
2. Login with username: `lp_demo`, password: `admin123`
3. Verify redirect to `/lp-portal`
4. Check Capital Account Summary section
5. Check "Your Fund Investments" section
6. Attempt to navigate to `/fund-dashboard` (should redirect back)
7. Generate Holdings Report
8. Verify report shows ONLY Baum Family Trust investments
9. Logout

**Expected Results:**
- ✓ Redirect to LP Portal Dashboard
- ✓ Capital Account Summary shows only Baum Family Trust data
- ✓ Investment holdings show only investments with entity_id = 3
- ✓ Cannot access Fund Dashboard
- ✓ Holdings report filtered to entity_id = 3
- ✓ Total commitment matches only Baum Family Trust investments

### Scenario 3: Data Isolation Verification
**Steps:**
1. Login as testfm
2. Note total commitment amount (should be ~$96k+)
3. Note investment count
4. Logout
5. Login as lp_demo
6. Note total commitment amount (should be less than testfm's view)
7. Note investment count (should be less than testfm's view)
8. Compare the two - verify lp_demo sees subset of testfm's data

**Expected Results:**
- ✓ testfm total commitment > lp_demo total commitment
- ✓ testfm investment count > lp_demo investment count
- ✓ lp_demo data is proper subset of testfm data
- ✓ No overlap in entity access (lp_demo can't see entity_id ≠ 3)

### Scenario 4: API Endpoint Isolation
**Steps:**
1. Login as lp_demo
2. Get access token from localStorage
3. Use curl/Postman to test API endpoints:
   - GET /api/v1/investments
   - GET /api/v1/investments/{id} (try an investment NOT owned by entity 3)
   - GET /api/v1/dashboard/summary
   - POST /api/v1/reports/generate (type: holdings)

**Expected Results:**
- ✓ GET /api/v1/investments returns only entity_id = 3 investments
- ✓ GET /api/v1/investments/{other_entity_investment} returns 404 or 403
- ✓ Dashboard summary filtered to entity_id = 3
- ✓ Holdings report filtered to entity_id = 3

### Scenario 5: Session Persistence
**Steps:**
1. Login as lp_demo
2. Refresh the page
3. Navigate to different pages
4. Close tab and reopen (same browser)
5. Verify still logged in as lp_demo

**Expected Results:**
- ✓ Session persists across page refreshes
- ✓ Still see only Baum Family Trust data after refresh
- ✓ account_type maintained in localStorage
- ✓ Token refresh works correctly

### Scenario 6: Logout and URL History Clearing
**Steps:**
1. Login as testfm
2. Navigate through multiple pages
3. Logout
4. Use browser back button
5. Verify redirected to login page

**Expected Results:**
- ✓ Logout clears localStorage tokens
- ✓ Hard redirect to `/` (using window.location.href)
- ✓ Cannot use back button to access protected pages
- ✓ Must login again to access application

---

## Test Results

### Fund Manager Account (testfm)
- [ ] Login successful
- [ ] Redirected to Fund Dashboard
- [ ] Analytics shows aggregate data
- [ ] Holdings shows all investments
- [ ] Report generation works
- [ ] Logout successful

### LP Client Account (lp_demo)
- [ ] Login successful
- [ ] Redirected to LP Portal
- [ ] Capital Account Summary filtered
- [ ] Investment holdings filtered
- [ ] Cannot access Fund Dashboard
- [ ] Report generation filtered
- [ ] Logout successful

### Data Isolation
- [ ] testfm sees more data than lp_demo
- [ ] lp_demo only sees entity_id = 3 data
- [ ] No data leakage between accounts
- [ ] API endpoints properly filtered

### Session Management
- [ ] Session persists across refreshes
- [ ] Token refresh works
- [ ] Logout clears history
- [ ] Back button blocked after logout

---

## Issues Found

### Issue 1:
**Description:**
**Expected:**
**Actual:**
**Severity:** High/Medium/Low
**Fix Required:**

### Issue 2:
**Description:**
**Expected:**
**Actual:**
**Severity:** High/Medium/Low
**Fix Required:**

---

## Sign-off

**Tester:** _____________
**Date:** _____________
**Status:** Pass / Fail / Pass with Minor Issues
**Notes:**
