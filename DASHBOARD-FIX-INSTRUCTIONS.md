# Dashboard Statistics Fix - Implementation Guide

## Issue Fixed
The merchant dashboard was showing 0 for all statistics (total invoices, draft, sent, revenue) because the `invoices` table was missing the `merchant_id` column required for merchant isolation.

## Root Cause
- Database query in `getInvoiceStats()` filters by `merchant_id`
- `invoices` table in `database-schema.sql` was missing `merchant_id` column
- All queries returned 0 results due to failed WHERE condition

## Files Modified

### 1. Database Schema (`database-schema.sql`)
**ADDED**: `merchant_id INTEGER` column to invoices table:
```sql
-- Line 124 added:
merchant_id INTEGER,
```

### 2. Migration Script (`fix-dashboard-merchant-isolation.sql`)
**CREATED**: Migration script to update existing database:
- Adds `merchant_id` column if missing
- Updates existing invoices with default merchant ID (1)
- Adds foreign key constraint (if merchants table exists)
- Creates performance index
- Includes verification queries

### 3. Application Code (`src/supabase-database.js`)
**VERIFIED**: Code already correctly handles merchant isolation:
- `saveInvoice()` includes `merchant_id: merchantId` (line 568)
- `getInvoiceStats()` filters by merchant ID (line 923)
- `updateInvoice()` requires merchant ID for updates

## Deployment Steps

### Step 1: Apply Database Migration
Execute the migration SQL in your Supabase dashboard:
```bash
# Copy and run the contents of:
fix-dashboard-merchant-isolation.sql
```

### Step 2: Verify Migration
Check that invoices have merchant_id:
```sql
SELECT COUNT(*) as total_invoices,
       COUNT(merchant_id) as invoices_with_merchant_id,
       COUNT(DISTINCT merchant_id) as unique_merchants
FROM invoices;
```

### Step 3: Test Dashboard
1. Login to merchant dashboard
2. Navigate to main dashboard page
3. Verify statistics show correct numbers:
   - Total Invoices: Should show actual count
   - Draft/Sent/Paid: Should show breakdown by status
   - Total Revenue: Should show sum of paid invoices

## Expected Results
After applying the fix:
- ✅ Dashboard shows actual invoice counts
- ✅ Revenue calculations work correctly
- ✅ Status breakdowns (draft/sent/paid) display properly
- ✅ Future invoices automatically include merchant_id

## Testing Commands
```bash
# Test the fix (requires .env configuration):
node test-dashboard-fix.js

# Manual verification via API:
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "http://localhost:3000/api/stats"
```

## Rollback Plan
If issues occur, rollback by removing the column:
```sql
-- Only if absolutely necessary:
ALTER TABLE invoices DROP COLUMN merchant_id;
```

## Notes
- All existing invoices are assigned to merchant ID 1
- New invoices automatically get correct merchant_id
- The fix maintains full backward compatibility
- Performance optimized with database index

## Files to Commit
To deploy this fix, commit these files:
1. `database-schema.sql` - Updated schema
2. `fix-dashboard-merchant-isolation.sql` - Migration script
3. `DASHBOARD-FIX-INSTRUCTIONS.md` - This documentation
4. `test-dashboard-fix.js` - Test script (optional)