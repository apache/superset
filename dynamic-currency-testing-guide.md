# Dynamic Currency Handling - Comprehensive Testing Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Dataset Setup](#dataset-setup)
3. [Test Data Overview](#test-data-overview)
4. [Dataset Configuration Tests](#dataset-configuration-tests)
5. [Chart Test Cases](#chart-test-cases)
   - [Table Chart](#1-table-chart)
   - [Pivot Table](#2-pivot-table)
   - [Big Number](#3-big-number)
   - [Big Number with Trendline](#4-big-number-with-trendline)
   - [Big Number Period Over Period](#5-big-number-period-over-period)
   - [Time-series Chart](#6-time-series-chart)
   - [Mixed Time-series](#7-mixed-time-series)
   - [Pie Chart](#8-pie-chart)
   - [Gauge Chart](#9-gauge-chart)
   - [Funnel Chart](#10-funnel-chart)
   - [Treemap](#11-treemap)
   - [Heatmap](#12-heatmap)
   - [Sunburst](#13-sunburst)
   - [WorldMap](#14-worldmap)
   - [AG-Grid Table (Interactive Table)](#15-ag-grid-table-interactive-table)
6. [Currency Dropdown UI Tests](#currency-dropdown-ui-tests)
7. [Edge Case Tests](#edge-case-tests)
8. [Backwards Compatibility Tests](#backwards-compatibility-tests)
9. [Acceptance Criteria Coverage Matrix](#acceptance-criteria-coverage-matrix)

---

## Prerequisites

1. **Superset Running**: Ensure Superset is running at `http://localhost:8088`
2. **Database Connection**: Examples database connected (`postgresql://examples:examples@db:5432/examples`)
3. **Test Table Created**: `international_sales` table exists (see SQL below)

### Create Test Table SQL

```sql
CREATE TABLE IF NOT EXISTS international_sales (
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

INSERT INTO international_sales (transaction_date, country, region, currency_code, revenue, profit, product_name, product_category) VALUES
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
('2024-03-01', 'UK', 'Europe', 'GBP', 0.99, 0.20, 'Minimal Charge', 'Services'),
-- Word-form normalization tests (per requirement 3.4)
('2024-03-02', 'France', 'Europe', 'euro', 2500.00, 625.00, 'Euro Word Test', 'Services'),
('2024-03-02', 'France', 'Europe', 'EURO', 3500.00, 875.00, 'Euro Uppercase Word', 'Services'),
('2024-03-02', 'France', 'Europe', '€', 4500.00, 1125.00, 'Euro Symbol Test', 'Services'),
('2024-03-02', 'USA', 'North America', 'dollar', 1500.00, 375.00, 'Dollar Word Test', 'Services'),
('2024-03-02', 'USA', 'North America', '$', 2000.00, 500.00, 'Dollar Symbol Test', 'Services'),
-- Invalid currency code test (per requirement 7)
('2024-03-03', 'Unknown', 'Other', 'XYZ', 999.99, 249.99, 'Invalid Currency Test', 'Other'),
('2024-03-03', 'Unknown', 'Other', 'INVALID', 888.88, 222.22, 'Invalid Code Test', 'Other');
```

---

## Dataset Setup

### Step 1: Create the Dataset

1. Navigate to **Data → Datasets**
2. Click **+ Dataset**
3. Configure:
   - **Database**: `examples`
   - **Schema**: `public`
   - **Table**: `international_sales`
4. Click **Create Dataset and Create Chart**

### Step 2: Configure Currency Code Column

1. Navigate to **Data → Datasets**
2. Find and click on `international_sales` to edit
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

The `international_sales` table contains:

| Data Aspect | Details |
|-------------|---------|
| **Currencies** | USD, EUR, GBP, JPY, AUD, CAD |
| **Case Variations** | `USD`, `usd`, `EUR`, `eur`, `Cad`, `Gbp` (tests normalization) |
| **Word-form Variations** | `euro`, `EURO`, `dollar` (tests requirement 3.4) |
| **Symbol Variations** | `€`, `$` (tests symbol → code normalization) |
| **Regions** | North America, Europe, Asia, Asia Pacific, Other |
| **Countries** | USA, Canada, Germany, France, UK, Japan, Australia, Unknown |
| **Time Range** | 2024-01-15 to 2024-03-15 |
| **Edge Cases** | NULL currency codes, empty strings, small numbers (< 1), invalid codes (XYZ, INVALID) |

### Quick Verification Query
```sql
SELECT currency_code, COUNT(*) as rows, ROUND(SUM(revenue)::numeric, 2) as total_revenue
FROM international_sales
GROUP BY currency_code
ORDER BY currency_code;
```

---

## Dataset Configuration Tests

> **Requirement Coverage:** Acceptance Criteria 1.1

### Test D1: Currency Code Column - String Column Only

**Setup:**
1. Navigate to **Data → Datasets**
2. Click on `international_sales` to edit
3. Look at the **"Currency code column"** dropdown options

**Expected Result:**
- Only **string-typed columns** appear in the dropdown
- `currency_code` (VARCHAR) should be available
- `country` (VARCHAR), `region` (VARCHAR), `product_name` (VARCHAR), `product_category` (VARCHAR) should appear
- Numeric columns (`id`, `revenue`, `profit`) should **NOT** appear
- Date columns (`transaction_date`) should **NOT** appear

---

### Test D2: Single Column Selection Enforcement

**Setup:**
1. In the dataset editor, select `currency_code` as the Currency code column
2. Observe the dropdown behavior

**Expected Result:**
- Only one column can be selected at a time (not a multi-select)
- The selection is a radio-button style choice (mutually exclusive)
- Selecting a different column replaces the previous selection

---

### Test D3: Metadata Persistence

**Setup:**
1. Set `currency_code` as the Currency code column
2. Click **Save**
3. Navigate away from the page
4. Return to **Data → Datasets → international_sales**

**Expected Result:**
- The "Currency code column" setting persists after page reload
- `currency_code` is still selected

---

### Test D4: Clear Currency Code Column

**Setup:**
1. Edit the dataset
2. Clear the "Currency code column" selection (select empty/none)
3. Save the dataset

**Expected Result:**
- Selection can be cleared
- After clearing, AUTO mode in charts will use neutral formatting
- No errors occur when saving with empty selection

---

## Chart Test Cases

### 1. Table Chart

#### Test 1.1: Per-Row Currency Symbols (No Filter)

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **Table**
2. In **Query** tab:
   - **Columns**: Add `country`, `product_name`, `revenue`, `currency_code`
3. In **Customize** tab:
   - Expand **Customize columns**
   - Click on `revenue` column
   - **Currency**: Select **"Auto-detect"**
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
1. Click **+ Chart** → Select `international_sales` → Choose **Pivot Table**
2. In **Query** tab:
   - **Rows**: `region`
   - **Columns**: `product_category`
   - **Metrics**: `SUM(revenue)`
3. In **Customize** tab:
   - **Currency**: Select **"Auto-detect"**
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
1. Click **+ Chart** → Select `international_sales` → Choose **Big Number**
2. In **Query** tab:
   - **Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Currency**: Select **"Auto-detect"**
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

> **Requirement Coverage:** Acceptance Criteria 3.1, 3.2

#### Test 4.1: Single Currency with Trend

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **Big Number with Trendline**
2. In **Query** tab:
   - **Metric**: `SUM(revenue)`
   - **Temporal Column**: `transaction_date`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Currency**: Select **"Auto-detect"**
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

### 5. Big Number Period Over Period

> **Note:** This chart type requires the `ChartPluginsExperimental` feature flag to be enabled.
> **Requirement Coverage:** Acceptance Criteria 3.1, 3.2

#### Test 5.1: Period Comparison with Single Currency

**Setup:**
1. Ensure feature flag `CHART_PLUGINS_EXPERIMENTAL` is enabled in Superset config
2. Click **+ Chart** → Select `international_sales` → Choose **Big Number Period Over Period**
3. In **Query** tab:
   - **Metric**: `SUM(revenue)`
   - **Temporal Column**: `transaction_date`
   - **Filters**: `country = USA`
4. In **Customize** tab:
   - **Currency**: Select **"Auto-detect"**
   - **Position**: **"Prefix"**
5. Click **Update Chart**

**Expected Result:**
- Current period and comparison values show `$` symbol
- Percentage change displays correctly

---

#### Test 5.2: Period Comparison with Mixed Currency

**Setup:**
1. Remove country filter
2. Click **Update Chart**

**Expected Result:**
- All values show neutral formatting (no symbol)
- Percentage calculations still work correctly

---

### 6. Time-series Chart

#### Test 6.1: Single Currency Time-series

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **Time-series Chart**
2. In **Query** tab:
   - **Time Column**: `transaction_date`
   - **Time Grain**: `Month`
   - **Metrics**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Y Axis** section:
     - **Currency**: Select **"Auto-detect"**
     - **Position**: **"Prefix"**
4. Click **Update Chart**

**Expected Result:**
- Y-axis labels show `$` symbol: `$100K`, `$200K`, etc.
- Tooltip values show `$` symbol

---

#### Test 6.2: Multi-Series with Mixed Currency

**Setup:**
1. Remove filter
2. Add **Dimensions**: `region`
3. Click **Update Chart**

**Expected Result:**
- Y-axis shows **neutral formatting** (no symbol)
- Each series represents different regions with different currencies

---

### 7. Mixed Time-series

#### Test 7.1: Dual Axis with Different Currency Contexts

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **Mixed Chart**
2. In **Query** tab:
   - **Time Column**: `transaction_date`
   - **Metrics (Left Y-Axis)**: `SUM(revenue)`
   - **Metrics (Right Y-Axis)**: `SUM(profit)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Y Axis** → **Currency**: **"Auto-detect"**
   - **Y Axis 2** → **Currency**: **"Auto-detect"**
4. Click **Update Chart**

**Expected Result:**
- Both axes show `$` symbol (single currency in filtered data)

---

### 8. Pie Chart

#### Test 8.1: Pie with Single Currency

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **Pie Chart**
2. In **Query** tab:
   - **Dimensions**: `product_category`
   - **Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect"**
4. Click **Update Chart**

**Expected Result:**
- Slice labels show `$` symbol
- Tooltip shows `$` formatted values

---

#### Test 8.2: Pie with Mixed Currency

**Setup:**
1. Remove filter
2. Change **Dimensions** to: `country`
3. Click **Update Chart**

**Expected Result:**
- Labels show **neutral formatting** (no symbol)
- Tooltip shows neutral formatted values

---

### 9. Gauge Chart

#### Test 9.1: Gauge with Single Currency

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **Gauge Chart**
2. In **Query** tab:
   - **Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect"**
   - **Min**: `0`
   - **Max**: `2000000`
4. Click **Update Chart**

**Expected Result:**
- Gauge value shows `$` symbol
- Axis labels show `$` formatted values

---

### 10. Funnel Chart

#### Test 10.1: Funnel with Single Currency

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **Funnel Chart**
2. In **Query** tab:
   - **Dimensions**: `product_category`
   - **Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect"**
4. Click **Update Chart**

**Expected Result:**
- Funnel segment labels show `$` symbol
- Tooltip shows `$` formatted values

---

### 11. Treemap

#### Test 11.1: Treemap with Single Currency

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **Treemap**
2. In **Query** tab:
   - **Dimensions**: `region`, `country`
   - **Metric**: `SUM(revenue)`
   - **Filters**: `currency_code = USD` (include case variations)
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect"**
4. Click **Update Chart**

**Expected Result:**
- Tree node labels show `$` symbol
- Tooltip shows `$` formatted values

---

### 12. Heatmap

#### Test 12.1: Heatmap with Single Currency

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **Heatmap**
2. In **Query** tab:
   - **X Axis**: `product_category`
   - **Y Axis**: `region`
   - **Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect"**
4. Click **Update Chart**

**Expected Result:**
- Cell values show `$` symbol
- Legend shows `$` formatted range
- Tooltip shows `$` formatted values

---

### 13. Sunburst

#### Test 13.1: Sunburst with Single Currency

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **Sunburst**
2. In **Query** tab:
   - **Hierarchy**: `region`, `country`, `product_category`
   - **Primary Metric**: `SUM(revenue)`
   - **Filters**: `country = USA`
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect"**
4. Click **Update Chart**

**Expected Result:**
- Center total shows `$` symbol
- Segment tooltips show `$` formatted values

---

### 14. WorldMap

> **Requirement Coverage:** Charts with currency_format support

#### Test 14.1: WorldMap with Single Currency

**Setup:**
1. Click **+ Chart** → Select `international_sales` → Choose **World Map**
2. In **Query** tab:
   - **Country Column**: `country`
   - **Metric**: `SUM(revenue)`
   - **Filters**: `currency_code = USD` (to get single currency)
3. In **Customize** tab:
   - **Number format** → **Currency**: **"Auto-detect"**
4. Click **Update Chart**

**Expected Result:**
- Tooltip values show `$` symbol when hovering over countries
- Bubble sizes (if enabled) show `$` formatted values

---

#### Test 14.2: WorldMap with Mixed Currency

**Setup:**
1. Remove the currency filter
2. Click **Update Chart**

**Expected Result:**
- Tooltip values show neutral formatting (no symbol)
- Data from multiple countries with different currencies aggregated

---

### 15. AG-Grid Table (Interactive Table)

> **Note:** This chart type requires the `AG_GRID_TABLE_ENABLED` feature flag to be enabled.
> **Requirement Coverage:** Acceptance Criteria 5.1 (Non-Aggregated Tables)

#### Test 15.1: AG-Grid Per-Row Currency Symbols

**Setup:**
1. Ensure feature flag `AG_GRID_TABLE_ENABLED` is enabled
2. Click **+ Chart** → Select `international_sales` → Choose **AG-Grid Table**
3. In **Query** tab:
   - **Columns**: Add `country`, `product_name`, `revenue`, `currency_code`
4. In **Customize** tab:
   - Expand **Customize columns**
   - Click on `revenue` column
   - **Currency**: Select **"Auto-detect"**
   - **Position**: Select **"Prefix"**
5. Click **Update Chart**

**Expected Result:**
- Each row displays its own currency symbol:
  - USA rows: `$64,999.50`
  - Germany rows: `€47,999.60`
  - UK rows: `£34,999.65`
  - Japan rows: `¥3,999,975`

---

#### Test 15.2: AG-Grid with Static Currency Override

**Setup:**
1. Change **Currency** to **"EUR (€)"** (static selection)
2. Click **Update Chart**

**Expected Result:**
- All rows show `€` symbol regardless of actual currency in data
- Confirms static mode overrides auto-detection

---

## Currency Dropdown UI Tests

> **Requirement Coverage:** Acceptance Criteria 2.1, 2.2

### Test UI1: Currency Dropdown Structure

**Setup:**
1. Create any chart with AUTO currency support (e.g., Big Number)
2. Open the **Customize** tab
3. Look at the **Currency** dropdown

**Expected Result:**
- First option is **"Auto-detect"** (displayed with special styling)
- Followed by ISO currency list: USD, EUR, GBP, JPY, etc.
- Each currency shows code with symbol (e.g., "USD ($)")
- **Custom** option appears (may be last)

---

### Test UI2: Tooltip Verification

**Setup:**
1. In Explore, find the **Currency** label/dropdown
2. Hover over the label or look for info icon

**Expected Result:**
- Tooltip displays: *"'Automatic' formats this metric using the dataset's currency configuration. The dataset must define a currency code column and this field must be tagged as a currency value."*
- (Note: The "currency value" tagging was removed from requirements, so tooltip may differ)

---

## Edge Case Tests

### Test E1: Currency Code Case Normalization

> **Requirement Coverage:** Acceptance Criteria 3.4

**Setup:**
1. Any chart with AUTO mode
2. Filter: `country IN ('USA', 'Canada')`

**Expected Result:**
- Data includes `USD`, `usd`, `CAD`, `Cad`
- USA data normalizes to `USD` → shows `$`
- Canada data normalizes to `CAD` → shows `CA$` or neutral if mixed with USD

---

### Test E1b: Word-Form Normalization

> **Requirement Coverage:** Acceptance Criteria 3.4 - "euro", "EURO", "€" normalize to EUR

**Setup:**
1. Table chart with AUTO mode
2. Filter: `product_name LIKE '%Euro%' OR product_name LIKE '%Dollar%'`
   (This will get rows with currency_code: 'euro', 'EURO', '€', 'dollar', '$')

**Expected Result:**
- Rows with `euro`, `EURO`, `€` all normalize to EUR → show `€` symbol
- Rows with `dollar`, `$` all normalize to USD → show `$` symbol
- Chart does not error on these variations

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

### Test E5: Invalid Currency Codes

> **Requirement Coverage:** Acceptance Criteria 7 - Invalid or unmapped codes fall back to neutral formatting

**Setup:**
1. Table chart with AUTO mode
2. Filter: `currency_code IN ('XYZ', 'INVALID')`

**Expected Result:**
- Rows with invalid codes `XYZ` and `INVALID` show **neutral formatting** (no symbol)
- Chart does not break or show errors
- Other valid currencies in same view still show correct symbols

---

### Test E6: Mixed Valid and Invalid Currencies

**Setup:**
1. Big Number chart with AUTO mode
2. Filter: `currency_code IN ('USD', 'XYZ')`

**Expected Result:**
- Because one currency is invalid, treated as "mixed" → neutral formatting
- No errors or warnings displayed

---

### Test E7: Decimal Precision Control

> **Requirement Coverage:** Acceptance Criteria 4 - Decimal precision user-controlled

**Setup:**
1. Big Number chart with AUTO mode
2. Filter: `country = USA`
3. Set **Decimal Precision** to various values: 0, 1, 2, 3

**Expected Result:**
- Precision `0`: `$1,234,567`
- Precision `1`: `$1,234,567.8`
- Precision `2`: `$1,234,567.89`
- Precision `3`: `$1,234,567.890`
- Currency symbol (`$`) always shown regardless of precision setting
- Precision works identically in both Automatic and Static modes

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
| **Dataset Configuration** ||||
| D1 | String Column Only | Dataset Editor | Column dropdown | Only string columns |
| D2 | Single Selection | Dataset Editor | Selection behavior | One column only |
| D3 | Metadata Persistence | Dataset Editor | Save and reload | Setting persists |
| D4 | Clear Selection | Dataset Editor | Clear currency col | No errors |
| **Table Chart** ||||
| 1.1 | Table - Per Row | Table | No filter | Per-row symbols |
| 1.2 | Table - Single | Table | USA filter | All `$` |
| 1.3 | Table - Mixed | Table | Europe filter | `€` and `£` |
| **Pivot Table** ||||
| 2.1 | Pivot - Basic | Pivot | No filter | Neutral totals |
| 2.2 | Pivot - Single | Pivot | USA filter | All `$` |
| 2.3 | Pivot - Cell | Pivot | By country | Per-row symbols |
| **Big Number Variants** ||||
| 3.1 | BigNum - Single | Big Number | USA filter | `$` |
| 3.2 | BigNum - Mixed | Big Number | Europe filter | Neutral |
| 4.1 | BigTrend - Single | Big Number + Trend | USA filter | `$` |
| 4.2 | BigTrend - Mixed | Big Number + Trend | No filter | Neutral |
| 5.1 | PopKpi - Single | Period Over Period | USA filter | `$` |
| 5.2 | PopKpi - Mixed | Period Over Period | No filter | Neutral |
| **Time-series Charts** ||||
| 6.1 | Time - Single | Time-series | USA filter | `$` on Y-axis |
| 6.2 | Time - Multi | Time-series | By region | Neutral |
| 7.1 | Mixed - Dual | Mixed Chart | USA filter | Both axes `$` |
| **Other ECharts** ||||
| 8.1 | Pie - Single | Pie | USA filter | `$` labels |
| 8.2 | Pie - Mixed | Pie | By country | Neutral |
| 9.1 | Gauge - Single | Gauge | USA filter | `$` |
| 10.1 | Funnel - Single | Funnel | USA filter | `$` |
| 11.1 | Tree - Single | Treemap | USD filter | `$` |
| 12.1 | Heat - Single | Heatmap | USA filter | `$` |
| 13.1 | Sun - Single | Sunburst | USA filter | `$` |
| **Additional Chart Types** ||||
| 14.1 | WorldMap - Single | WorldMap | USD filter | `$` in tooltip |
| 14.2 | WorldMap - Mixed | WorldMap | No filter | Neutral |
| 15.1 | AGGrid - Per Row | AG-Grid Table | No filter | Per-row symbols |
| 15.2 | AGGrid - Static | AG-Grid Table | Static EUR | All `€` |
| **UI Tests** ||||
| UI1 | Dropdown Structure | Explore | Currency dropdown | AUTO first, then ISO |
| UI2 | Tooltip | Explore | Hover on label | Tooltip text shown |
| **Edge Cases** ||||
| E1 | Case Normalization | Any | Mixed case | Normalized |
| E1b | Word Normalization | Table | euro/EURO/€ | All `€` |
| E2 | NULL handling | Table | Unknown country | Neutral |
| E3 | Empty string | Table | Empty currency | Neutral |
| E4 | Small numbers | Table | Services | `$0.50` |
| E5 | Invalid codes | Table | XYZ, INVALID | Neutral |
| E6 | Mixed valid/invalid | Big Number | USD + XYZ | Neutral |
| E7 | Decimal precision | Big Number | Various settings | Symbol + precision |
| **Backwards Compatibility** ||||
| B1 | Static override | Any | Static USD, EUR data | `$` |
| B2 | No column | Any | No currency col | Neutral |
| B3 | Existing | Dashboard | Legacy charts | Unchanged |

---

## Troubleshooting

### Chart shows neutral formatting when single currency expected
1. Verify dataset has "Currency code column" configured
2. Check filter is correctly limiting to single currency
3. Run SQL to verify data: `SELECT DISTINCT currency_code FROM international_sales WHERE [your_filter]`

### Currency symbol not appearing
1. Ensure "Auto-detect" is selected (not blank)
2. Verify position (Prefix/Suffix) is set
3. Check that the currency code column contains valid ISO codes or symbols

### Mixed results within same currency
1. Check for case variations: `USD` vs `usd`
2. Normalization should handle this - verify with: `SELECT DISTINCT UPPER(currency_code) FROM ...`

---

## Acceptance Criteria Coverage Matrix

This matrix maps each acceptance criterion from the requirements document to the test cases that validate it.

| Acceptance Criteria | Test Cases | Status |
|---------------------|------------|--------|
| **1. Dataset Configuration** |||
| 1.1 Currency Code Column (string only, single select) | D1, D2, D3, D4 | ✅ Covered |
| **2. Explore / Chart Builder Behavior** |||
| 2.1 Currency Dropdown (AUTO first, ISO list, Custom) | UI1 | ✅ Covered |
| 2.2 Tooltip text | UI2 | ✅ Covered |
| 2.3 AUTO applies when currency_code_column exists | All chart tests with AUTO | ✅ Covered |
| 2.4 Static mode uses selected symbol | B1, 15.2 | ✅ Covered |
| **3. Automatic Currency Formatting Logic** |||
| 3.1 Single Currency → show symbol | 1.2, 2.2, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1, 13.1, 14.1, 15.1 | ✅ Covered |
| 3.2 Multiple Currencies → neutral | 1.3, 2.1, 3.2, 4.2, 5.2, 6.2, 8.2, 14.2 | ✅ Covered |
| 3.3 No filter (mixed) → neutral | 3.3 (implied in 3.2 tests) | ✅ Covered |
| 3.4 Normalization (case, word-forms, symbols) | E1, E1b | ✅ Covered |
| **4. Decimal Precision** |||
| User-controlled precision in AUTO and Static modes | E7 | ✅ Covered |
| **5. Table and Pivot Table Behavior** |||
| 5.1 Non-aggregated tables (per-row symbols) | 1.1, 1.3, 15.1 | ✅ Covered |
| 5.2 Pivot tables (cell-level, totals) | 2.1, 2.2, 2.3 | ✅ Covered |
| 5.3 Aggregates with mixed → neutral | 2.1 | ✅ Covered |
| **6. Backwards Compatibility** |||
| Existing dashboards unchanged | B3 | ✅ Covered |
| Dataset metadata doesn't modify existing visuals | B3 | ✅ Covered |
| **7. Error and Edge Cases** |||
| No currency code column → neutral | B2, D4 | ✅ Covered |
| NULL currency codes → neutral | E2 | ✅ Covered |
| Invalid/unmapped codes → neutral | E5, E6 | ✅ Covered |
| Charts don't break on edge cases | E2, E3, E5, E6 | ✅ Covered |

### Chart Type Coverage

| Chart Type | Test Cases | Requirement Reference |
|------------|------------|----------------------|
| Table | 1.1, 1.2, 1.3 | ✅ Primary chart |
| Pivot Table | 2.1, 2.2, 2.3 | ✅ Primary chart |
| Big Number | 3.1, 3.2, 3.3 | ✅ Primary chart |
| Big Number with Trendline | 4.1, 4.2 | ✅ Primary chart |
| Big Number Period Over Period | 5.1, 5.2 | ✅ Experimental (feature flagged) |
| Time-series Chart | 6.1, 6.2 | ✅ Primary chart |
| Mixed Time-series | 7.1 | ✅ Primary chart |
| Pie Chart | 8.1, 8.2 | ✅ Primary chart |
| Gauge Chart | 9.1 | ✅ Primary chart |
| Funnel Chart | 10.1 | ✅ Primary chart |
| Treemap | 11.1 | ✅ Primary chart |
| Heatmap | 12.1 | ✅ Primary chart |
| Sunburst | 13.1 | ✅ Primary chart |
| WorldMap | 14.1, 14.2 | ✅ From requirements list |
| AG-Grid Table (Interactive Table) | 15.1, 15.2 | ✅ Feature flagged |

### Notes on Removed Requirements

Per Elizabeth Thompson's comment on Nov 24:
> "Also I think we can remove the dataset column 'Is currency value' in the dataset, since it will be defined in the chart."

The following original acceptance criteria were **removed** and are not tested:
- 1.2 "Is currency value" Checkbox (Numeric Columns Only) - **REMOVED**
- The metric's column must be marked "is currency value" - **REMOVED**

The current implementation uses:
- Dataset-level `currency_code_column` configuration
- Chart-level currency format selection (AUTO or static)
- No per-metric "is currency value" tagging required
