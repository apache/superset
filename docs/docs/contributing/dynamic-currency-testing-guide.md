# Dynamic Currency Handling - Comprehensive Testing Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Dataset Setup](#dataset-setup)
3. [Test Data Overview](#test-data-overview)
4. [Chart Test Cases](#chart-test-cases)
   - [Table Chart](#1-table-chart)
   - [Pivot Table](#2-pivot-table)
   - [Big Number](#3-big-number)
   - [Big Number with Trendline](#4-big-number-with-trendline)
   - [Time-series Chart](#5-time-series-chart)
   - [Mixed Time-series](#6-mixed-time-series)
   - [Pie Chart](#7-pie-chart)
   - [Gauge Chart](#8-gauge-chart)
   - [Funnel Chart](#9-funnel-chart)
   - [Treemap](#10-treemap)
   - [Heatmap](#11-heatmap)
   - [Sunburst](#12-sunburst)
5. [Edge Case Tests](#edge-case-tests)
6. [Backwards Compatibility Tests](#backwards-compatibility-tests)

---

## Prerequisites

1. **Superset Running**: Ensure Superset is running at `http://localhost:8088`
2. **Database Connection**: Examples database connected (`postgresql://examples:examples@db:5432/examples`)
3. **Test Table Created**: `currency_test_full` table exists (see SQL below)

### Create Test Table SQL

```sql
CREATE TABLE IF NOT EXISTS currency_test_full (
    id SERIAL PRIMARY KEY,
    transaction_date DATE,
    country VARCHAR(50),
    region VARCHAR(50),
    currency_code VARCHAR(10),
    revenue DECIMAL(15, 2),
    profit DECIMAL(15, 2),
    product_name VARCHAR(100),
    product_category VARCHAR(50)
);

INSERT INTO currency_test_full (transaction_date, country, region, currency_code, revenue, profit, product_name, product_category) VALUES
-- USD transactions (USA) - various case formats
('2024-01-15', 'USA', 'North America', 'USD', 64999.50, 14999.90, 'Premium Laptop', 'Electronics'),
('2024-01-15', 'USA', 'North America', 'usd', 179998.00, 44999.50, 'Enterprise Server', 'Electronics'),
('2024-01-20', 'USA', 'North America', 'USD', 74995.00, 17498.75, 'Office Suite 100-pack', 'Software'),
('2024-02-01', 'USA', 'North America', 'USD', 89996.00, 20999.15, 'Cloud Service Annual', 'Services'),
('2024-02-15', 'USA', 'North America', 'usd', 124997.50, 29999.40, 'Data Center Equipment', 'Electronics'),
('2024-03-01', 'USA', 'North America', 'USD', 34999.75, 8749.94, 'Security Software', 'Software'),
-- EUR transactions (Germany, France)
('2024-01-16', 'Germany', 'Europe', 'EUR', 47999.60, 11999.90, 'Industrial Sensor Kit', 'Electronics'),
('2024-01-25', 'Germany', 'Europe', 'eur', 89998.80, 22499.70, 'Manufacturing Robot', 'Electronics'),
('2024-02-10', 'Germany', 'Europe', 'EUR', 29999.85, 7499.96, 'ERP License Pack', 'Software'),
('2024-02-20', 'France', 'Europe', 'EUR', 54998.75, 13749.69, 'Telecom Equipment', 'Electronics'),
('2024-03-05', 'France', 'Europe', 'eur', 18999.90, 4749.98, 'Analytics Platform', 'Software'),
-- GBP transactions (UK)
('2024-01-18', 'UK', 'Europe', 'GBP', 34999.65, 8749.91, 'Financial Terminal', 'Electronics'),
('2024-02-05', 'UK', 'Europe', 'Gbp', 67998.70, 16999.68, 'Trading Platform', 'Software'),
('2024-02-28', 'UK', 'Europe', 'GBP', 44999.55, 11249.89, 'Compliance System', 'Services'),
-- JPY transactions (Japan)
('2024-01-22', 'Japan', 'Asia', 'JPY', 3999975.00, 999993.75, 'Precision Equipment', 'Electronics'),
('2024-02-12', 'Japan', 'Asia', 'JPY', 7499952.00, 1874988.00, 'Semiconductor Tools', 'Electronics'),
('2024-03-10', 'Japan', 'Asia', 'JPY', 1999988.00, 499997.00, 'Quality Control System', 'Software'),
-- AUD transactions (Australia)
('2024-01-28', 'Australia', 'Asia Pacific', 'AUD', 52999.45, 13249.86, 'Mining Software', 'Software'),
('2024-02-18', 'Australia', 'Asia Pacific', 'AUD', 84998.30, 21249.58, 'Resource Management', 'Services'),
('2024-03-15', 'Australia', 'Asia Pacific', 'AUD', 39999.60, 9999.90, 'Environmental Monitor', 'Electronics'),
-- CAD transactions (Canada) - mixed case
('2024-01-30', 'Canada', 'North America', 'CAD', 47999.55, 11999.89, 'Healthcare System', 'Software'),
('2024-02-22', 'Canada', 'North America', 'Cad', 72998.40, 18249.60, 'Medical Equipment', 'Electronics'),
('2024-03-08', 'Canada', 'North America', 'CAD', 28999.70, 7249.93, 'Pharma Analytics', 'Services'),
-- Edge cases
('2024-02-14', 'Unknown', 'Other', NULL, 15999.95, 3999.99, 'Generic Product', 'Other'),
('2024-02-25', 'Unknown', 'Other', '', 12999.85, 3249.96, 'Unclassified Item', 'Other'),
-- Small values for edge case testing
('2024-03-01', 'USA', 'North America', 'USD', 0.50, 0.10, 'Micro Transaction', 'Services'),
('2024-03-01', 'Germany', 'Europe', 'EUR', 0.75, 0.15, 'Small Fee', 'Services'),
('2024-03-01', 'UK', 'Europe', 'GBP', 0.99, 0.20, 'Minimal Charge', 'Services');
```

---

## Dataset Setup

### Step 1: Create the Dataset

1. Navigate to **Data → Datasets**
2. Click **+ Dataset**
3. Configure:
   - **Database**: `examples`
   - **Schema**: `public`
   - **Table**: `currency_test_full`
4. Click **Create Dataset and Create Chart**

### Step 2: Configure Currency Code Column

1. Navigate to **Data → Datasets**
2. Find and click on `currency_test_full` to edit
3. Scroll down to **"Default Column Settings"** section
4. In the **"Currency code column"** dropdown:
   - Select `currency_code`
5. Click **Save**

### Step 3: Verify Configuration Persisted

1. Refresh the page
2. Go back to edit the dataset
3. Verify **"Currency code column"** still shows `currency_code`

---

## Test Data Overview

The `currency_test_full` table contains:

| Data Aspect | Details |
|-------------|---------|
| **Currencies** | USD, EUR, GBP, JPY, AUD, CAD |
| **Case Variations** | `USD`, `usd`, `EUR`, `eur`, `Cad`, `Gbp` (tests normalization) |
| **Regions** | North America, Europe, Asia, Asia Pacific, Other |
| **Countries** | USA, Canada, Germany, France, UK, Japan, Australia, Unknown |
| **Time Range** | 2024-01-15 to 2024-03-15 |
| **Edge Cases** | NULL currency codes, empty strings, small numbers (< 1) |

### Quick Verification Query
```sql
SELECT currency_code, COUNT(*) as rows, ROUND(SUM(revenue)::numeric, 2) as total_revenue
FROM currency_test_full
GROUP BY currency_code
ORDER BY currency_code;
```

---

## Chart Test Cases

### 1. Table Chart

#### Test 1.1: Per-Row Currency Symbols (No Filter)

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Table**
2. In **Query** tab:
   - **Columns**: Add `country`, `product_name`, `revenue`, `currency_code`
3. In **Customize** tab:
   - Expand **Customize columns**
   - Click on `revenue` column
   - **Currency**: Select **"Auto-detect from dataset"**
   - **Position**: Select **"Prefix"**
4. Click **Update Chart**

**Expected Result:**
- Each row displays its own currency symbol:
  - USA rows: `$64,999.50`
  - Germany rows: `€47,999.60`
  - UK rows: `£34,999.65`
  - Japan rows: `¥3,999,975`

---

#### Test 1.2: Single Currency Filter (USA Only)

**Setup:**
1. Continue from Test 1.1
2. In **Query** tab → **Filters**:
   - Add filter: `country = USA`
3. Click **Update Chart**

**Expected Result:**
- All rows show `$` symbol (single currency detected)
- Values: `$64,999.50`, `$179,998.00`, `$74,995.00`, etc.

---

#### Test 1.3: Mixed Currency Region (Europe)

**Setup:**
1. Change filter to: `region = Europe`
2. Click **Update Chart**

**Expected Result:**
- Rows show their respective currency:
  - Germany/France: `€` (EUR)
  - UK: `£` (GBP)

---

### 2. Pivot Table

#### Test 2.1: Basic Pivot with AUTO Mode

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Pivot Table**
2. In **Query** tab:
   - **Rows**: `region`
   - **Columns**: `product_category`
   - **Metrics**: `SUM(revenue)`
3. In **Customize** tab:
   - **Currency**: Select **"Auto-detect from dataset"**
   - **Position**: **"Prefix"**
4. Click **Update Chart**

**Expected Result (No Filter):**
- Individual cells may show symbols if they represent single currency
- **Grand totals show neutral formatting** (no symbol) because they aggregate mixed currencies

---

#### Test 2.2: Pivot with Single Currency Filter

**Setup:**
1. Add filter: `country = USA`
2. Click **Update Chart**

**Expected Result:**
- All cells show `$` symbol
- Totals also show `$` symbol (single currency)

---

#### Test 2.3: Pivot Cell-Level Detection

**Setup:**
1. Remove filters
2. Change **Rows** to: `country`
3. Click **Update Chart**

**Expected Result:**
- USA row cells: `$`
- Germany row cells: `€`
- UK row cells: `£`
- Grand total row: Neutral formatting (mixed currencies)

---

### 3. Big Number

#### Test 3.1: Single Currency Detection

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Big Number**
2. In **Query** tab:
   - **Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Currency**: Select **"Auto-detect from dataset"**
   - **Position**: **"Prefix"**
4. Click **Update Chart**

**Expected Result:**
- Big number displays with `$` symbol
- Example: `$1,237,472.75`

---

#### Test 3.2: Mixed Currency (Neutral Formatting)

**Setup:**
1. Change filter to: `region = Europe`
2. Click **Update Chart**

**Expected Result:**
- Big number displays **without** currency symbol (neutral formatting)
- Example: `1,070,487.04` (no € or £ because data contains both)

---

#### Test 3.3: No Filter (All Data)

**Setup:**
1. Remove all filters
2. Click **Update Chart**

**Expected Result:**
- Big number displays **without** currency symbol
- Total revenue shown in neutral format

---

### 4. Big Number with Trendline

#### Test 4.1: Single Currency with Trend

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Big Number with Trendline**
2. In **Query** tab:
   - **Metric**: `SUM(revenue)`
   - **Temporal Column**: `transaction_date`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Currency**: Select **"Auto-detect from dataset"**
   - **Position**: **"Prefix"**
4. Click **Update Chart**

**Expected Result:**
- Big number shows `$` symbol
- Trendline tooltip values also show `$` symbol

---

#### Test 4.2: Mixed Currency Trend

**Setup:**
1. Remove filter (show all data)
2. Click **Update Chart**

**Expected Result:**
- Big number and trendline use neutral formatting (no symbol)

---

### 5. Time-series Chart

#### Test 5.1: Single Currency Time-series

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Time-series Chart**
2. In **Query** tab:
   - **Time Column**: `transaction_date`
   - **Time Grain**: `Month`
   - **Metrics**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Y Axis** section:
     - **Currency**: Select **"Auto-detect from dataset"**
     - **Position**: **"Prefix"**
4. Click **Update Chart**

**Expected Result:**
- Y-axis labels show `$` symbol: `$100K`, `$200K`, etc.
- Tooltip values show `$` symbol

---

#### Test 5.2: Multi-Series with Mixed Currency

**Setup:**
1. Remove filter
2. Add **Dimensions**: `region`
3. Click **Update Chart**

**Expected Result:**
- Y-axis shows **neutral formatting** (no symbol)
- Each series represents different regions with different currencies

---

### 6. Mixed Time-series

#### Test 6.1: Dual Axis with Different Currency Contexts

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Mixed Chart**
2. In **Query** tab:
   - **Time Column**: `transaction_date`
   - **Metrics (Left Y-Axis)**: `SUM(revenue)`
   - **Metrics (Right Y-Axis)**: `SUM(profit)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Y Axis** → **Currency**: **"Auto-detect from dataset"**
   - **Y Axis 2** → **Currency**: **"Auto-detect from dataset"**
4. Click **Update Chart**

**Expected Result:**
- Both axes show `$` symbol (single currency in filtered data)

---

### 7. Pie Chart

#### Test 7.1: Pie with Single Currency

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Pie Chart**
2. In **Query** tab:
   - **Dimensions**: `product_category`
   - **Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect from dataset"**
4. Click **Update Chart**

**Expected Result:**
- Slice labels show `$` symbol
- Tooltip shows `$` formatted values

---

#### Test 7.2: Pie with Mixed Currency

**Setup:**
1. Remove filter
2. Change **Dimensions** to: `country`
3. Click **Update Chart**

**Expected Result:**
- Labels show **neutral formatting** (no symbol)
- Tooltip shows neutral formatted values

---

### 8. Gauge Chart

#### Test 8.1: Gauge with Single Currency

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Gauge Chart**
2. In **Query** tab:
   - **Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect from dataset"**
   - **Min**: `0`
   - **Max**: `2000000`
4. Click **Update Chart**

**Expected Result:**
- Gauge value shows `$` symbol
- Axis labels show `$` formatted values

---

### 9. Funnel Chart

#### Test 9.1: Funnel with Single Currency

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Funnel Chart**
2. In **Query** tab:
   - **Dimensions**: `product_category`
   - **Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect from dataset"**
4. Click **Update Chart**

**Expected Result:**
- Funnel segment labels show `$` symbol
- Tooltip shows `$` formatted values

---

### 10. Treemap

#### Test 10.1: Treemap with Single Currency

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Treemap**
2. In **Query** tab:
   - **Dimensions**: `region`, `country`
   - **Metric**: `SUM(revenue)`
   - **Filters**: `currency_code = USD` (include case variations)
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect from dataset"**
4. Click **Update Chart**

**Expected Result:**
- Tree node labels show `$` symbol
- Tooltip shows `$` formatted values

---

### 11. Heatmap

#### Test 11.1: Heatmap with Single Currency

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Heatmap**
2. In **Query** tab:
   - **X Axis**: `product_category`
   - **Y Axis**: `region`
   - **Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect from dataset"**
4. Click **Update Chart**

**Expected Result:**
- Cell values show `$` symbol
- Legend shows `$` formatted range
- Tooltip shows `$` formatted values

---

### 12. Sunburst

#### Test 12.1: Sunburst with Single Currency

**Setup:**
1. Click **+ Chart** → Select `currency_test_full` → Choose **Sunburst**
2. In **Query** tab:
   - **Hierarchy**: `region`, `country`, `product_category`
   - **Primary Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect from dataset"**
4. Click **Update Chart**

**Expected Result:**
- Center total shows `$` symbol
- Segment tooltips show `$` formatted values

---

## Edge Case Tests

### Test E1: Currency Code Normalization

**Setup:**
1. Any chart with AUTO mode
2. Filter: `country IN ('USA', 'Canada')`

**Expected Result:**
- Data includes `USD`, `usd`, `CAD`, `Cad`
- USA data normalizes to `USD` → shows `$`
- Canada data normalizes to `CAD` → shows `CA$` or neutral if mixed with USD

---

### Test E2: NULL Currency Values

**Setup:**
1. Table chart with AUTO mode
2. Filter: `country = Unknown`

**Expected Result:**
- Rows with NULL `currency_code` show **neutral formatting**
- Chart does not break or error

---

### Test E3: Empty String Currency

**Setup:**
1. Table chart with AUTO mode
2. Include rows where `currency_code = ''`

**Expected Result:**
- Empty string treated as missing → neutral formatting

---

### Test E4: Small Numbers (< 1)

**Setup:**
1. Table chart with AUTO mode
2. Filter: `product_category = Services`

**Expected Result:**
- Small values like `0.50`, `0.75`, `0.99` display correctly
- Currency symbol still applies: `$0.50`

---

## Backwards Compatibility Tests

### Test B1: Static Currency Override

**Setup:**
1. Any chart
2. Set Currency to **"USD ($)"** (static, not Auto-detect)
3. Filter: `country = Germany` (EUR data)

**Expected Result:**
- Values show `$` symbol regardless of actual data currency
- This maintains existing behavior for users who don't want auto-detection

---

### Test B2: No Currency Code Column Configured

**Setup:**
1. Edit the dataset
2. Clear the "Currency code column" selection
3. Save
4. Return to any chart with AUTO mode selected

**Expected Result:**
- Chart shows **neutral formatting** (no symbol)
- No errors occur

---

### Test B3: Existing Dashboard Unchanged

**Setup:**
1. Open any existing dashboard created before this feature
2. Charts that don't have AUTO mode selected

**Expected Result:**
- All existing charts render exactly as before
- No automatic behavior changes

---

## Test Summary Checklist

| # | Test | Chart Type | Scenario | Expected |
|---|------|------------|----------|----------|
| 1.1 | Table - Per Row | Table | No filter | Per-row symbols |
| 1.2 | Table - Single | Table | USA filter | All `$` |
| 1.3 | Table - Mixed | Table | Europe filter | `€` and `£` |
| 2.1 | Pivot - Basic | Pivot | No filter | Neutral totals |
| 2.2 | Pivot - Single | Pivot | USA filter | All `$` |
| 2.3 | Pivot - Cell | Pivot | By country | Per-row symbols |
| 3.1 | BigNum - Single | Big Number | USA filter | `$` |
| 3.2 | BigNum - Mixed | Big Number | Europe filter | Neutral |
| 4.1 | BigTrend - Single | Big Number + Trend | USA filter | `$` |
| 5.1 | Time - Single | Time-series | USA filter | `$` on Y-axis |
| 5.2 | Time - Multi | Time-series | By region | Neutral |
| 6.1 | Mixed - Dual | Mixed Chart | USA filter | Both axes `$` |
| 7.1 | Pie - Single | Pie | USA filter | `$` labels |
| 7.2 | Pie - Mixed | Pie | By country | Neutral |
| 8.1 | Gauge - Single | Gauge | USA filter | `$` |
| 9.1 | Funnel - Single | Funnel | USA filter | `$` |
| 10.1 | Tree - Single | Treemap | USD filter | `$` |
| 11.1 | Heat - Single | Heatmap | USA filter | `$` |
| 12.1 | Sun - Single | Sunburst | USA filter | `$` |
| E1 | Normalization | Any | Mixed case | Normalized |
| E2 | NULL handling | Table | Unknown country | Neutral |
| E3 | Empty string | Table | Empty currency | Neutral |
| E4 | Small numbers | Table | Services | `$0.50` |
| B1 | Static override | Any | Static USD, EUR data | `$` |
| B2 | No column | Any | No currency col | Neutral |
| B3 | Existing | Dashboard | Legacy charts | Unchanged |

---

## Troubleshooting

### Chart shows neutral formatting when single currency expected
1. Verify dataset has "Currency code column" configured
2. Check filter is correctly limiting to single currency
3. Run SQL to verify data: `SELECT DISTINCT currency_code FROM currency_test_full WHERE [your_filter]`

### Currency symbol not appearing
1. Ensure "Auto-detect from dataset" is selected (not blank)
2. Verify position (Prefix/Suffix) is set
3. Check that the currency code column contains valid ISO codes or symbols

### Mixed results within same currency
1. Check for case variations: `USD` vs `usd`
2. Normalization should handle this - verify with: `SELECT DISTINCT UPPER(currency_code) FROM ...`
