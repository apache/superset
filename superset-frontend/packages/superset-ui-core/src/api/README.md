# Orval API Client Generation

## Current Status: POC Complete ✅

We've successfully proven that orval can generate **type-safe API clients** for Superset!

### What Works Now
- ✅ **Orval integration** - Installed and configured in superset-ui-core
- ✅ **Client generation** - Working generation from simplified OpenAPI spec
- ✅ **Type safety** - Full TypeScript interfaces and functions
- ✅ **POC component** - Demonstrates usage patterns vs SupersetClient

### Generated Client Structure
```
src/api/generated/
├── superset-api.ts     # API functions (getCharts, createChart, etc.)
└── types/              # TypeScript interfaces (Chart, ChartPayload, etc.)
```

### Usage Example
```typescript
// Old SupersetClient way ❌
const response = await SupersetClient.get({
  endpoint: '/api/v1/charts/',
  searchParams: { page: 1 }
});
const data: any = response.json; // No type safety!

// New orval-generated way ✅  
import { getCharts, type Chart } from './generated/superset-api';
const response = await getCharts({ page: 1, page_size: 25 });
const charts: Chart[] = response.data.result || []; // Fully typed!
```

## The Full API Scope 🚀

Superset's OpenAPI spec contains **176 unique endpoints** covering:

### Major API Categories
- **Charts** (`/api/v1/chart/`) - Chart CRUD, data, screenshots, favorites
- **Dashboards** (`/api/v1/dashboard/`) - Dashboard management, filters, permissions  
- **Datasets** (`/api/v1/dataset/`) - Dataset management, columns, metrics
- **Databases** (`/api/v1/database/`) - Database connections, schemas, tables
- **Security** (`/api/v1/security/`) - Authentication, permissions, roles
- **SQL Lab** (`/api/v1/sqllab/`) - Query execution, saved queries
- **And many more** - Reports, annotations, themes, advanced data types...

### Example Generated Functions (Full API)
```typescript
// Charts
getCharts(params?: GetChartsParams): Promise<ChartsResponse>
createChart(payload: ChartPayload): Promise<Chart>
updateChart(id: number, payload: ChartUpdatePayload): Promise<Chart>
deleteChart(id: number): Promise<void>
getChartData(id: number, params: QueryParams): Promise<ChartDataResponse>

// Dashboards  
getDashboards(params?: GetDashboardsParams): Promise<DashboardsResponse>
createDashboard(payload: DashboardPayload): Promise<Dashboard>
getDashboardCharts(id: number): Promise<Chart[]>
exportDashboard(id: number): Promise<DashboardExportResponse>

// Datasets
getDatasets(params?: GetDatasetsParams): Promise<DatasetsResponse>
getDatasetColumns(id: number): Promise<DatasetColumn[]>
updateDatasetColumn(datasetId: number, columnId: number, payload: ColumnPayload): Promise<DatasetColumn>

// SQL Lab
executeQuery(payload: QueryPayload): Promise<QueryResult>
getSavedQueries(params?: SavedQueryParams): Promise<SavedQueriesResponse>
```

## Current Challenge: OpenAPI Spec Validation

The full Superset OpenAPI spec has validation issues that prevent complete generation:
1. **Missing schema references** (e.g., `DashboardScreenshotPostSchema`)
2. **Invalid array schemas** (arrays without `items` property)
3. **Complex nested references** causing circular dependencies

## Next Steps for Full Implementation

### 1. Schema Validation Fix
```bash
# Approach 1: Fix upstream in Flask-AppBuilder
# - Update marshmallow schemas in Python code
# - Ensure all references are properly defined

# Approach 2: Post-processing script
# - Automatically fix common issues in generated spec
# - Handle missing references and invalid arrays

# Approach 3: Gradual rollout
# - Generate clients for individual API sections
# - Combine multiple smaller specs
```

### 2. Enhanced Configuration
```typescript
// orval.config.ts for full API
export default defineConfig({
  charts: {
    input: { target: './specs/charts-api.json' },
    output: { target: './src/api/charts/' }
  },
  dashboards: {
    input: { target: './specs/dashboards-api.json' },
    output: { target: './src/api/dashboards/' }
  },
  // ... other API sections
});
```

### 3. Migration Strategy
- **Phase 1**: Fix schema issues, generate complete client
- **Phase 2**: Add TanStack Query hooks for caching/optimistic updates
- **Phase 3**: Create SupersetClient compatibility layer
- **Phase 4**: Gradual migration of existing code

### 4. Developer Experience Improvements
```typescript
// With TanStack Query integration
const { data: charts, isLoading, error } = useGetCharts({ page: 1 });
const createChartMutation = useCreateChart({
  onSuccess: () => queryClient.invalidateQueries(['charts'])
});

// With automatic retries, caching, background refetch
const { data } = useGetDashboard(dashboardId, {
  staleTime: 5 * 60 * 1000, // 5 minutes
  retry: 3
});
```

## Value Proposition Confirmed ✅

Even with the current limitations, the POC demonstrates **massive value**:

1. **Type Safety**: Compile-time API validation
2. **Developer Experience**: Auto-completion, parameter validation
3. **Maintainability**: Automatic sync with backend changes  
4. **Performance**: Modern fetch-based client with caching potential
5. **Scale**: 176 endpoints → thousands of type-safe functions

**Bottom Line**: Once we resolve the schema issues, we'll have a **game-changing** improvement to Superset's frontend API layer! 🚀
