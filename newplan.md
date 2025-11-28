# Task and Purpose

The task is to enable users to summarise data for each row in an AG Grid table into a convenient chart, these charts will be rendered using new custom cell renderers (CCRs). 

Our deliverable will be to create a POC using our new feature.

# Superset AG Grid Cell Renderer Structure


IMPORTANT: In superset/config.py, Ensure AG_GRID_TABLE_ENABLED: True & TABLE_V2_TIME_COMPARISON_ENABLED: True


NOTE: Charts are configured at the column level; a column may only display one type of chart, all of which will have the same configuration (e.g. same color). This also means there can only be one chart col


## User Requirements & Limitations (POC)

### How to Use Chart Renderers:

1. **Add a Chart Column:**
   - Option A: Add a new NULL column to your dataset specifically for visualization
   - Option B: Sacrifice an existing column (its data will be replaced by charts)

2. **Configure the Chart Column:**
   - Set `chartType` to desired type 
   - The renderer will visualize ALL numeric values from that row

3. **Data Requirements:**
   - ⚠️ **User Responsibility:** Ensure your row contains only relevant numeric columns
   - Renderers automatically skip strings and null values
   - Renderers process ALL numeric values in the row (in column order)
   - Ensure column order reflects desired visualization sequence (e.g., Q1, Q2, Q3, Q4)

### Example Use Cases:

**Good Usage:**

Product | Q1 | Q2 | Q3 | Q4 | Trend (NULL column)
Widget A | 100 | 150 | 120 | 180 | [sparkline: 100→150→120→180]

**Also Valid (sacrificing Q1 column):**

Product | Q1 (Trend) | Q2 | Q3 | Q4
Widget A | [sparkline: 100→150→120→180] | 150 | 120 | 180

Note: Q1's value (100) is included in the sparkline but not displayed as text.
**User Must Be Careful:**

Product | Genre | Q1 | Q2 | Q3 | Q4 | Canada Total | Trend
Widget A | Electronics | 100 | 150 | 120 | 180 | 550 | [sparkline: 100→150→120→180→550]

- "Genre" is automatically skipped (string)
- "Canada Total" is included in sparkline (numeric) - may not be desired
- **User should exclude or reorder columns to avoid this**

### Known Limitations (POC):

- No column-specific filtering (all numeric columns are included)
- User cannot specify which columns to include/exclude per chart
- Column order determines visualization order
- Only one chart column per table is possible

### Future Enhancements:

- Add `sourceColumns` configuration to explicitly specify which columns to visualize
- Add column filtering options
- Support for virtual/computed columns


# Summary of what the custom cell renderers will do (and what they need to filter)

Each custom cell renderer (CCR) will visually summarise all numerical data for its row. 

The CCRs will need to filter out all string and null values from the row data before
rendering. All numeric values will be considered. The renderer is not responsible for ordering the row data, that is user responsibility. 

### Main Files
1. Renderer Directory: `superset-frontend/plugins/plugin-chart-ag-grid-table/src/renderers/`
2. Renderer Assignment: `superset-frontend/plugins/plugin-chart-ag-grid-table/src/utils/useColDefs.ts`
3. Renderer Config: 
    * Modify TableColumnConfig: `superset-frontend/plugins/plugin-chart-ag-grid-table/src/types.ts`
        * Used for configurating new renderers
    * Modify TableChartProps: `superset-frontend/plugins/plugin-chart-ag-grid-table/src/transformProps.ts`
        * Converts raw chart config and query data for use by AG Grid (i.e. our renderers)
4. UI Config:
    * Modify ControlPanelConfig: `superset-frontend/plugins/plugin-chart-ag-grid-table/src/controlPanel.tsx`

Our goal is to deliver a POC demonstrating our new custom renderers (located at 1, integrated using 2 and 3)

In summary, we want to modify, create, and reference the following files:
```
superset-frontend/plugins/plugin-chart-ag-grid-table/src/
├── utils/
│   ├── useColDefs.ts          (modify)
│   ├── useTableTheme.ts       (reference)
│   └── chartRenderers.ts      (create) \\ used for assignment logic (see Factory Pattern Solution)
├── renderers/
│   ├── NumericCellRenderer.tsx  (reference)
│   ├── TextCellRenderer.tsx     (reference)
│   ├── SparklineRenderer.tsx    (create)
│   └── MiniBarRenderer.tsx      (create)
├── types.ts                   (modify)
└── transformProps.ts             (modify)
```
### Data Flow Diagram:
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Backend API   │    │  transformProps  │    │   useColDefs    │    │   AG Grid        │
│                 │───▶│                  │───▶│                │───▶│   Rendered       │
│ - form_data     │    │ - Data cleanup   │    │ - Column config │    │   Table          │
│ - query results │    │ - Column config  │    │ - Cell renderers│    │                  │
│ - column_config │    │ - Formatters     │    │ - Styling       │    │                  │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘
       ▲                         │                         │                         │
       │                         ▼                         ▼                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   UI Controls   │    │ AgGridTableChart │    │ Chart Renderers │    │    User View     │
│                 │    │                  │    │                 │    │                  │
│ - Chart type    │    │ Props consumed   │    │ - Sparkline     │    │                  │
│ - Chart config  │    │ by component     │    │                 │
│ - User settings │    │                  │    │ - Mini bars     │    │                  │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘
```

## Renderer Structure
For example, we have NumericCellRenderer.tsx; This extends CustomCellRendererProps

#### CellRendererProps Interface
```typescript
export type CellRendererProps = CustomCellRendererProps & {
  hasBasicColorFormatters: boolean | undefined;
  col: InputColumn;
  basicColorFormatters: { [Key: string]: BasicColorFormatterType; }[];
  valueRange: any;
  alignPositiveNegative: boolean;
  colorPositiveNegative: boolean;
  allowRenderHtml: boolean;
  columns: InputColumn[];
};
```

#### **Main AG Grid Props**
- `value` - The cell value
- `valueFormatted` - Formatted display value  
- `node` - Row node info (includes `rowIndex`, `rowPinned`)
- `api` - AG Grid API access
- `colDef` - Column definition
- `data` - Full row data

### **Renderer Function Signatures**

Both existing (Numeric and Text) renderers follow this pattern:
```typescript
export const RendererName = (params: CellRendererProps) => {
  // Extract props
  const { value, valueFormatted, node, ... } = params;
  
  // Handle totals row
  if (node?.rowPinned === 'bottom') {
    return <SpecialTotalsRow />;
  }
  
  // Main rendering logic
  return <CellContent />;
};
```

### **Chart Implementation Pattern (NumericCellRenderer)**

#### **Visual Chart Components**
```typescript
const Bar = styled.div<{ offset: number; percentage: number; background: string }>`
  position: absolute;
  left: ${({ offset }) => `${offset}%`};
  top: 0;
  height: 100%;
  width: ${({ percentage }) => `${percentage}%`};
  background-color: ${({ background }) => background};
  z-index: 1;
`;
```

#### **Data Processing Functions**
- `cellWidth()` - Calculate bar width percentage
- `cellOffset()` - Calculate bar position offset  
- `cellBackground()` - Determine bar color

#### **Chart Rendering Structure**
```typescript
return (
  <div>
    <Bar offset={CellOffset} percentage={CellWidth} background={background} />
    {valueFormatted ?? value}
  </div>
);
```

Row Data (props.data)
       ↓
valueGetter extracts value for column
       ↓
props.value (in your renderer)
       ↓
Your renderer uses it
location: src/utils/formatValue.ts lines 103-116

Example:
Row data: 
{ product: "Widget A", sales: 100, date: "2024-01" }
For the "sales" column:

1) valueGetter runs:
// params.column.getColId() = "sales"
// params.data = { product: "Widget A", sales: 100, date: "2024-01" }
return params.data["sales"];  // Returns: 100

2) Value passed to your renderer:

const SparklineRenderer: React.FC<CustomCellRendererProps> = (props) => {
  props.value  // ← This is 100 (from valueGetter)
  props.data   // ← This is { product: "Widget A", sales: 100, date: "2024-01" }
};


---
## Integration Structure
This section explains existing patterns in Superset. Skip to "Proposed Integration Solution" for proposal.
### 1. Column Definition
Recapping the flow;
```
Backend API → transformProps.ts → AgGridTableChart → useColDefs → AG Grid → Rendered Table
     ↓              ↓                   ↓              ↓           ↓
- form_data    - Data cleanup      - Props        - Column    - Cell 
- query data   - Column config     - Transformed  - config    - renderers
- column_config - Chart validation - data/config  - Renderer  - applied
               - Default setting                  - selection
```
```typescript
// AgGridTableChart.tsx
const colDefs = useColDefs({
  columns: filteredColumns,
  data,
  serverPagination,
  isRawRecords,
  defaultAlignPN: alignPositiveNegative,
  showCellBars,
  colorPositiveNegative,
  totals,
  columnColorFormatters,
  allowRearrangeColumns,
  basicColorFormatters,
  isUsingTimeComparison,
  emitCrossFilters,
  alignPositiveNegative,
  slice_id,
});
```

### 2. Renderer Assignment Logic

#### Line 240 in useColDefs.ts
```typescript
const isTextColumn = 
  dataType === GenericDataType.String ||
  dataType === GenericDataType.Temporal;

cellRenderer: (p: CellRendererProps) =>
  isTextColumn ? TextCellRenderer(p) : NumericCellRenderer(p),
```

#### 
- **Text Columns**: String + Temporal data → `TextCellRenderer`
- **Numeric Columns**: Numeric + Boolean + Others → `NumericCellRenderer`

### 3. cellRendererParams Structure

#### Parameters Passed to Every Renderer:
```typescript
cellRendererParams: {
  allowRenderHtml: true,
  columns,                          // All column definitions
  hasBasicColorFormatters,          // Time comparison color support
  col,                             // Current column definition
  basicColorFormatters,            // Color formatter array
  valueRange,                      // Data range for bars [min, max]
  alignPositiveNegative: alignPN || alignPositiveNegative,
  colorPositiveNegative,
},
```

### 4. Column Type Detection

#### GenericDataType Enum Usage:
```typescript
import { GenericDataType } from '@apache-superset/core/api/core';

// Available types:
// - GenericDataType.String 
// - GenericDataType.Numeric
// - GenericDataType.Temporal  
// - GenericDataType.Boolean
```

#### Column Property Access:
```typescript
const { config, isMetric, isPercentMetric, isNumeric, key, dataType, originalLabel } = col;

// Key properties for renderer selection:
// - dataType: GenericDataType enum
// - isMetric: boolean (calculated fields)
// - isNumeric: boolean (numeric data)
// - config: TableColumnConfig (user settings)
```

### 5. Value Range Calculation

#### Data Processing for Charts:
```typescript
function getValueRange(key: string, alignPositiveNegative: boolean, data: InputData[]) {
  if (typeof data?.[0]?.[key] === 'number') {
    const nums = data.map(row => row[key]) as number[];
    return (
      alignPositiveNegative 
        ? [0, d3Max(nums.map(Math.abs))] 
        : d3Extent(nums)
    ) as ValueRange;
  }
  return null;
}
```
### 6. Data Transformation; Communicating between backend and AG Grid via transformProps.ts
Now we are looking at file location: `superset-frontend/plugins/plugin-chart-ag-grid-table/src/transformProps.ts`

Raw backend data is processed by transformProps.ts - Processed data is consumed by useColDefs.ts for chart renderer selection.

#### Input Structure (TableChartProps):
```typescript
interface TableChartProps extends ChartProps {
  rawFormData: TableChartFormData & {
    // Chart configuration comes through here
    column_config?: Record<string, TableColumnConfig>; // Chart configs
    show_cell_bars?: boolean;
    align_pn?: boolean;
    color_pn?: boolean;
    // ... other form data
  };
  queriesData: ChartDataResponseResult[]; // Raw query results
  height: number;
  width: number;
  ownCurrentState?: ServerPaginationData;
}
```

#### Output Structure (AgGridTableChartTransformedProps):
```typescript
interface AgGridTableChartTransformedProps {
  data: DataRecord[];                    // Processed data records
  columns: DataColumnMeta[];             // Column definitions with config
  columnConfig: Record<string, TableColumnConfig>; // Processed chart configs
  showCellBars: boolean;
  alignPositiveNegative: boolean;
  colorPositiveNegative: boolean;
  // ... other transformed props passed to AgGridTableChart
}
```

#### Processing Patterns:
1. Column Config Processing:
```typescript
const processColumns = memoizeOne(function processColumns(props) {
  const { rawFormData: { column_config = {} } } = props;
  
  return columns.map(column => ({
    key: column.key,
    label: column.label,
    config: columnConfig[column.key] || {}, // Where chart config gets applied
    formatter: getFormatter(column, columnConfig[column.key]),
    dataType: column.dataType,
    isMetric: column.isMetric,
    // ... other column properties
  }));
});
```
2. Data Processing with Memoisation:
```typescript
// Performance optimization using memoizeOne
const processDataRecords = memoizeOne(function processDataRecords(
  data: DataRecord[] | undefined,
  columns: DataColumnMeta[],
) {
  // Transform data based on column configurations
  return data?.map(record => {
    // Apply transformations like date formatting
    return transformedRecord;
  });
});
```
3. Configuration Inheritance Pattern:
```typescript
// How existing configurations flow through
const config = columnConfig[key] || {}; // From rawFormData.column_config
const savedFormat = columnFormats?.[key]; // From datasource
const numberFormat = config.d3NumberFormat || savedFormat; // Config override
```
### Notes:
* Data Validation - Ensures chart configs are valid before reaching useColDefs
* Default Setting - Applies chart-type-specific defaults consistently  
* Type Safety - Converts raw API data to typed TypeScript interfaces
* Error Recovery - Fallback when chart configs are invalid

#### Chart Display Conditions:
- `showCellBars` must be enabled globally
- `config.showCellBars` not explicitly false
- Column must be metric OR raw records OR percent metric

## Proposed Integration Solution

#### Summary of Integration Strategy
* **Extend useColDefs.ts** - Add chart renderer selection logic
* **Create renderer factory** - Centralized chart renderer management  
* **Update TableColumnConfig** - Add chartType and chartConfig options
* **Update TableChartProps** - Add chart config processing function
* **Build chart renderers** - Follow established patterns from NumericCellRenderer
* **Add configuration UI** - Dashboard column settings integration
---
### 1. Assignment

Below is the high level structure of the assigment logic. See solution proposal below;

#### **Current cellRenderer Assignment (Line ~240):**
```typescript
cellRenderer: (p: CellRendererProps) =>
  isTextColumn ? TextCellRenderer(p) : NumericCellRenderer(p),
```

#### **Modified cellRenderer Assignment:**
```typescript
cellRenderer: (p: CellRendererProps) => {
  // Chart renderer selection logic
  if (shouldUseChartRenderer(col, data)) {
    return getChartRenderer(col.config?.chartType || 'default')(p);
  }
  // Fall back to existing logic
  return isTextColumn ? TextCellRenderer(p) : NumericCellRenderer(p);
},
```

### Example (Sparkline):
```typescript
// Column config that would enable sparkline renderer:
const columnConfig = {
  sales_trend: {
    chartType: 'sparkline',
    chartConfig: { 
      width: 80, 
      height: 25,
      color: 'green',
      showValues: true
      showPoints: true 
    }
  }
};
```

### Factory Pattern Solution
Proposal: We create a new file chartRenderers.ts (under .../src/utils) which implements a modular factory pattern for selecting a custom cell renderer; this enables better modularity and extensibility. 
File Location: `superset-frontend/plugins/plugin-chart-ag-grid-table/src/utils/chartRenderers.ts`
#### **Proposed Implementation:**
```typescript
// superset-frontend/plugins/plugin-chart-ag-grid-table/src/utils/chartRenderers.ts

import { NumericCellRenderer } from '../renderers/NumericCellRenderer'; // existing
import { SparklineRenderer } from '../renderers/SparklineRenderer';     // new
import { MiniBarRenderer } from '../renderers/MiniBarRenderer';         // new
import type { InputColumn } from '../types';

const CHART_RENDERERS = {
  'sparkline': SparklineRenderer,
  'minibar': MiniBarRenderer,
  'horizontal-bar': NumericCellRenderer, // existing horizontal bars
  'default': NumericCellRenderer,        // fallback to existing
};

export const getChartRenderer = (chartType: string) => {
  return CHART_RENDERERS[chartType] || CHART_RENDERERS.default;
};

export const shouldUseChartRenderer = (col: InputColumn, data: any[]): boolean => {
  return !!(
    col.config?.chartType && 
    col.config.chartType !== 'default' &&
    col.config.chartType !== 'horizontal-bar' // existing numeric renderer
  );
};
```
 Then Import in useColDefs.ts:
```typescript
import { SparklineRenderer } from '../renderers/SparklineRenderer';
import { MiniBarRenderer } from '../renderers/MiniBarRenderer';
// Add other renderers if any
import { getChartRenderer, shouldUseChartRenderer } from './chartRenderers';
```
---
### 2. Config:
### Part a): Modifying TableColumnConfig
#### **Current TableColumnConfig Interface (Lines 48-62):** (`.../src/types.ts`)
```typescript
export type TableColumnConfig = {
  d3NumberFormat?: string;
  d3SmallNumberFormat?: string;
  d3TimeFormat?: string;
  columnWidth?: number;
  horizontalAlign?: 'left' | 'right' | 'center';
  showCellBars?: boolean;
  alignPositiveNegative?: boolean;
  colorPositiveNegative?: boolean;
  truncateLongCells?: boolean;
  currencyFormat?: Currency;
  visible?: boolean;
  customColumnName?: string;
  displayTypeIcon?: boolean;
};
```

#### **Updated TableColumnConfig Interface:**
```typescript
export type TableColumnConfig = {
  d3NumberFormat?: string;
  d3SmallNumberFormat?: string;
  d3TimeFormat?: string;
  columnWidth?: number;
  horizontalAlign?: 'left' | 'right' | 'center';
  showCellBars?: boolean;
  alignPositiveNegative?: boolean;
  colorPositiveNegative?: boolean;
  truncateLongCells?: boolean;
  currencyFormat?: Currency;
  visible?: boolean;
  customColumnName?: string;
  displayTypeIcon?: boolean;
  // Modification: Optional chart renderer properties
  chartType?: 'sparkline' | 'minibar' | 'horizontal-bar' | 'default';
  chartConfig?: {
    width?: number;
    height?: number;
    color?: string;
    strokeWidth?: number;
    showValues?: boolean;
    showPoints?: boolean;
  };
};
```
### Part b): Modifying transformProps.ts
Problem: Chart configuration input data needs to flow from UI/API to renderer selection logic
Solution: We build a processChartConfiguration function to manage this

1. Import Required Types:
```typescript
// Add to existing imports at top of file
import type { TableColumnConfig } from './types';
```

2. Add Chart Config Processing Function:
```typescript
// Add this new function after the existing helper functions (around line 400)
const processChartConfiguration = memoizeOne(function processChartConfiguration(
  columnConfig: Record<string, TableColumnConfig>,
  columns: DataColumnMeta[],
) {
  const chartColumnConfig: Record<string, TableColumnConfig> = {};
  
  columns.forEach(column => {
    const config = columnConfig[column.key] || {};
    
    if (config.chartType && config.chartType !== 'default') {
      // Validate and set defaults for chart configuration
      chartColumnConfig[column.key] = {
        ...config,
        chartType: config.chartType,
        chartConfig: {
          // Set chart defaults
          width: config.chartConfig?.width ?? 60,
          height: config.chartConfig?.height ?? 20,
          color: config.chartConfig?.color,
          strokeWidth: config.chartConfig?.strokeWidth ?? 1.5,
          showValues: config.chartConfig?.showValues ?? true,
          showPoints: config.chartConfig?.showPoints ?? true,
        },
      };
    } else {
      // Keep existing configuration for non-chart columns
      chartColumnConfig[column.key] = config;
    }
  });
  
  return chartColumnConfig;
});
```

3. Modify Main transformProps Function:
```typescript
// In the main transformProps function, find the return statement (around line 700)
// Add chart configuration processing before the return:

const transformProps = (chartProps: TableChartProps): AgGridTableChartTransformedProps => {
  // ... existing code ...
  
  const [, percentMetrics, columns] = processColumns(chartProps);
  
  // ADD: Process chart configurations
  const { rawFormData: { column_config = {} } } = chartProps;
  const processedColumnConfig = processChartConfiguration(column_config, columns);
  
  // ... existing code continues ...
  
  return {
    // ... existing return properties ...
    columnConfig: processedColumnConfig, // ADD: Pass processed chart config
    // ... rest of existing return properties ...
  };
};
```
### Chart Configuration Flow
Recapping;
```
Backend API → transformProps.ts → AgGridTableChart → useColDefs → AG Grid → Rendered Table
     ↓              ↓                   ↓              ↓           ↓
- form_data    - Data cleanup      - Props        - Column    - Cell 
- query data   - Column config     - Transformed  - config    - renderers
- column_config - Chart validation - data/config  - Renderer  - applied
               - Default setting                  - selection
```
1. User Configuration (UI → Backend):
```typescript
// User sets in dashboard UI:
{ 
  chartType: 'sparkline',
  chartConfig: { width: 80, height: 25, showPoints: true }
}
```

2. Backend → Frontend (API Response):
```typescript
// Comes in via chartProps.rawFormData.column_config:
{
  "sales_trend": {
    "chartType": "sparkline", 
    "chartConfig": { "width": 80, "height": 25, "showPoints": true }
  }
}
```

3. transformProps Processing:
```typescript
// processChartConfiguration validates and adds defaults:
{
  "sales_trend": {
    "chartType": "sparkline",
    "chartConfig": { 
      "width": 80,           // User value
      "height": 25,          // User value  
      "strokeWidth": 1.5,    // Default added
      "showValues": true     // Default added
      "showPoints": true     // User value 
    }
  }
}
```

4. useColDefs Consumption:
```typescript
// useColDefs receives processed config and applies to renderer:
const shouldUseChart = shouldUseChartRenderer(col, data);
if (shouldUseChart) {
  cellRenderer = getChartRenderer(col.config?.chartType);
  cellRendererParams = {
    ...existingParams,
    chartConfig: col.config?.chartConfig
  };
}
```

5. Chart Renderer Usage:

TODO #1 : Remove chart configuration from renderers; Already configured by transformProps


### Notes:

1. All existing TableColumnConfig properties must remain unchanged
2. New chartType and chartConfig are optional
3. Fallback to existing TextCellRenderer/NumericCellRenderer (Backwards Compatibility)
4. Maintain memoisation and error handling patterns
---
### 3. UI:

Proposed Solution:

TODO #2 : Implement UI

#### **Dark Mode Support**
```typescript
import { useIsDark } from '../utils/useTableTheme';

const isDarkTheme = useIsDark();
const background = cellBackground({
  value: value as number,
  colorPositiveNegative,
  isDarkTheme,
});
```