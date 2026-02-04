# ADR 0001: Dashboard Bulk Data Exporter

## Status

Proposed - 2026-02-02

## Context

### Problem Statement

Currently, Apache Superset users who want to export data from multiple charts in a dashboard must:
1. Navigate to each chart individually
2. Open the chart's menu
3. Click "Export to CSV" or "Export to Excel"
4. Repeat for each chart in the dashboard
5. Manually organize multiple downloaded files

For a dashboard with 10 charts, this process takes approximately 2 minutes and results in 10 separate files. This workflow is:
- Time-consuming and repetitive
- Error-prone (easy to miss charts)
- Results in disorganized data (multiple files to manage)
- Creates friction for users who need regular dashboard data exports

### Competitive Analysis

Major BI tools offer bulk export capabilities:
- **Tableau**: "Download → Data" exports all sheets in a workbook
- **Power BI**: Export entire report data functionality
- **Looker**: "Download → All results" option

Superset currently lacks this capability, creating a feature gap.

### User Impact

Based on typical usage patterns:
- Average dashboard: 8 charts
- Time saved per export: ~90 seconds (from 2 minutes to 10 seconds)
- Estimated frequency: 1,000 dashboard exports per month (org-wide)
- **Total time saved: ~25 hours per month**

### Technical Context

**Existing Infrastructure:**
- Backend: `/api/v1/chart/data` endpoint supports CSV, JSON, and XLSX exports (`superset/charts/data/api.py`)
- Frontend: `exportChart()` function in `explore/exploreUtils/index.js` handles single chart exports
- Library: `xlsx` library already in dependencies (used for pivot table exports)
- Permission system: `can_csv` permission controls export access

**Dashboard Data Structure:**
- Redux state contains `sliceIds` (array of chart IDs)
- `sliceEntities.slices` maps chart ID → metadata (including `slice_name` and `form_data`)
- Each chart's `form_data` contains the configuration needed for export API calls

## Decision

We will implement a **frontend-orchestrated bulk export feature** that:

1. **Exports data as JSON, then converts to multi-sheet Excel client-side**
2. **Provides a modal UI for chart selection**
3. **Shows real-time progress during export**
4. **Generates a single Excel workbook with one sheet per chart**

### Architecture Decision: JSON → Excel (Client-Side Conversion)

**Decision:** Export each chart as JSON via `/api/v1/chart/data`, collect responses, then generate multi-sheet Excel workbook client-side using the `xlsx` library.

**Rationale:**
- **Simplicity**: Leverages existing `exportChart()` function with minimal changes
- **Flexibility**: Can process and combine data in memory before generating Excel
- **Error handling**: Can continue exporting other charts if one fails
- **Progress tracking**: Can show progress as each chart completes
- **No backend changes**: Uses existing API endpoints without modification

**Alternative Considered:** Export each chart as XLSX, parse files, combine
- Rejected because: Requires parsing XLSX files in browser, more complex, larger memory footprint

**Alternative Considered:** New backend endpoint that generates multi-sheet Excel
- Rejected because: Requires backend development, harder to implement in 10-hour hackathon, less flexible for future enhancements

### Key Architectural Choices

#### 1. Frontend Orchestration

**Decision:** Implement export logic in frontend (browser), not backend.

**Rationale:**
- **No backend changes needed** (faster implementation)
- **Respects existing permissions** (uses same API as single chart export)
- **User feedback**: Can show real-time progress
- **Failure resilience**: Can retry failed charts without re-exporting successful ones

**Trade-off:**
- ❌ Limited by browser memory (reasonable for dashboards with <50 charts, typical is ~8)
- ✅ Faster to implement, no backend deployment needed

#### 2. Export Format: Multi-Sheet Excel

**Decision:** Generate `.xlsx` file with one sheet per chart, named after the chart.

**Rationale:**
- **User expectation**: Excel is standard for business data analysis
- **Organization**: Sheets naturally separate different charts
- **Professional**: Single organized file vs. 10 scattered CSVs

**Alternative Considered:** ZIP file with multiple CSVs
- Rejected because: Users would still need to extract and manage multiple files

**Alternative Considered:** Single-sheet CSV with all data
- Rejected because: Charts have different schemas, would be confusing

#### 3. Chart Selection UI

**Decision:** Modal dialog with checkboxes for chart selection, "Select All" / "Deselect All" buttons.

**Rationale:**
- **User control**: Some users may only want specific charts
- **Performance**: Large dashboards can skip unused charts
- **Clarity**: Shows exactly what will be exported
- **Flexibility**: Can be enhanced with filters (e.g., "charts with data only")

**Alternative Considered:** Always export all charts
- Rejected because: No user control, wastes time/bandwidth on unwanted charts

#### 4. Progress Feedback

**Decision:** Show modal with progress indicator: "Exporting chart 3 of 8..." and individual chart status.

**Rationale:**
- **User confidence**: Visible progress reduces anxiety ("is it frozen?")
- **Transparency**: Users see which charts are exporting
- **Error visibility**: Can show which charts failed
- **Professional polish**: Matches UX expectations of modern tools

#### 5. Integration Point

**Decision:** Add to existing "Download" submenu in dashboard header, between screenshots and YAML export.

**Location:** `dashboard/components/menu/DownloadMenuItems/index.tsx`

**Rationale:**
- **Discoverability**: Users already look in "Download" menu for export options
- **Consistency**: Follows existing menu structure
- **Clear labeling**: "Export Dashboard Data" distinguishes from screenshots

#### 6. Permission Handling

**Decision:** Respect existing `can_csv` permission. Only show export option if user has permission.

**Rationale:**
- **Security**: Maintains existing access control
- **Consistency**: Same permission model as single chart export
- **No new permissions**: Avoids need for database migrations or configuration changes

#### 7. Error Handling Strategy

**Decision:** Partial success model - export successful charts even if some fail.

**Behavior:**
- Continue exporting remaining charts if one fails
- Show error summary at end: "8 of 10 charts exported successfully"
- Include error details in UI (which charts failed, why)
- Generate Excel file with successfully exported charts

**Rationale:**
- **User value**: Some data is better than no data
- **Resilience**: Network hiccups or permission issues on one chart don't block others
- **Transparency**: Users know exactly what succeeded/failed

**Alternative Considered:** All-or-nothing (fail entire export if any chart fails)
- Rejected because: Too rigid, frustrating user experience

## Implementation Details

### Data Flow

```
1. User clicks "Export Dashboard Data" in Download menu
2. Modal opens, showing list of charts with checkboxes (all checked by default)
3. User clicks "Export" button
4. For each selected chart:
   a. Call exportChart({ formData, resultFormat: 'json', resultType: 'full' })
   b. Wait for response
   c. Parse JSON response
   d. Store: { chartId, chartName, data: rows[], columns: [] }
   e. Update progress: "Exporting chart 3 of 8..."
5. When all complete (or failed):
   a. Create workbook: XLSX.utils.book_new()
   b. For each successful chart:
      - Convert data to worksheet: XLSX.utils.json_to_sheet(data)
      - Add sheet: XLSX.utils.book_append_sheet(wb, ws, chartName)
   c. Write file: XLSX.writeFile(wb, 'dashboard_export.xlsx')
6. Show success message with error summary if applicable
```

### Component Structure

```
New files to create:
- src/dashboard/components/ExportDashboardDataModal/
  ├── index.tsx              (Modal component)
  ├── ChartSelector.tsx      (Checkbox list)
  ├── ExportProgress.tsx     (Progress indicator)
  └── useBulkExport.ts       (Export logic hook)

Modified files:
- src/dashboard/components/menu/DownloadMenuItems/index.tsx
  (Add "Export Dashboard Data" menu item)
```

### API Usage

**Endpoint:** `POST /api/v1/chart/data`

**Request per chart:**
```json
{
  "datasource": "...",
  "viz_type": "...",
  "result_format": "json",
  "result_type": "full",
  ...formData
}
```

**Response:**
```json
{
  "result": [
    {
      "data": [
        { "column1": "value1", "column2": "value2" },
        ...
      ],
      "colnames": ["column1", "column2"],
      "coltypes": [1, 1]
    }
  ]
}
```

### Excel Structure

**File name:** `{dashboard_title}_{timestamp}.xlsx`

**Sheet naming:**
- Use `slice_name` from chart metadata
- Sanitize invalid characters for Excel sheet names
- Truncate to 31 characters (Excel limit)
- Handle duplicates by appending number: "Chart Name (2)"

**Sheet content:**
- First row: Column headers
- Subsequent rows: Data values
- Auto-size columns (approximate based on header length)

## Consequences

### Positive

1. **User Productivity**: Saves ~90 seconds per dashboard export, ~25 hours/month org-wide
2. **Competitive Parity**: Brings Superset in line with Tableau, Power BI, Looker
3. **User Satisfaction**: Addresses frequent user request
4. **Professional Output**: Single organized Excel file vs. scattered CSVs
5. **Fast Implementation**: Can be completed in ~10 hours (hackathon-friendly)
6. **No Backend Changes**: Reduces deployment complexity and risk
7. **Extensible**: Foundation for future enhancements (scheduled exports, filters, cloud storage)

### Negative

1. **Browser Memory Limit**: May struggle with dashboards containing >50 charts or charts with millions of rows
   - **Mitigation**: Show warning if >20 charts selected, implement chunking if needed later
2. **Network Overhead**: N sequential API calls (one per chart)
   - **Mitigation**: Can parallelize in future (3-5 concurrent requests)
3. **Excel Sheet Limit**: Excel has 255 sheet maximum
   - **Mitigation**: Reasonable, typical dashboards have <20 charts
4. **No Server-Side Caching**: Each export re-queries database
   - **Mitigation**: Uses existing caching if enabled in Superset config

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Browser crashes on large exports | Low | High | Show warning for >20 charts, implement streaming in future |
| API rate limiting | Low | Medium | Add exponential backoff, respect rate limits |
| Sheet name conflicts | Medium | Low | Append numbers to duplicate names |
| Permission confusion | Low | Medium | Clear error messages, respect existing permissions |
| Inconsistent data formats | Medium | Low | Standardize data transformation, handle edge cases |

## Alternatives Considered

### Alternative 1: Backend Multi-Sheet Excel Generation

**Description:** New backend endpoint `/api/v1/dashboard/{id}/export_data` that generates multi-sheet Excel server-side.

**Pros:**
- Server has more memory for large exports
- Single API call
- Could leverage server-side caching more efficiently

**Cons:**
- Requires backend development (Python)
- Needs database migrations if storing export metadata
- Longer implementation time (backend + frontend + testing)
- Harder to show real-time progress
- Backend deployment required

**Rejected because:** Can't complete in 10-hour hackathon, more complex, overkill for typical use case.

### Alternative 2: ZIP of Individual CSVs

**Description:** Export each chart as CSV, bundle into a ZIP file client-side.

**Pros:**
- CSVs are universal format
- Smaller file size than Excel
- Simpler than multi-sheet Excel

**Cons:**
- Users must extract ZIP
- Still managing multiple files
- Less professional appearance
- Extra step in workflow

**Rejected because:** Doesn't solve the "multiple files" problem, worse UX than Excel.

### Alternative 3: Streaming Multi-Sheet Export

**Description:** Use HTTP streaming to progressively build Excel file as charts complete.

**Pros:**
- Lower memory footprint
- Could handle very large dashboards

**Cons:**
- Much more complex implementation
- Browser compatibility issues
- Harder to implement error handling
- Overkill for typical dashboards

**Rejected because:** Too complex for hackathon, typical dashboards don't need it.

### Alternative 4: Add to Existing Reports/Alerts System

**Description:** Extend scheduled reports to support data exports (not just screenshots).

**Pros:**
- Reuses existing infrastructure
- Supports scheduling and email delivery
- Backend already has report generation logic

**Cons:**
- Doesn't solve immediate export need (requires scheduling)
- More complex feature scope
- Requires understanding reports system
- Not discoverable as "quick export"

**Rejected because:** Different user need (scheduled vs. on-demand), larger scope.

## Future Enhancements

These are **out of scope** for initial implementation but good candidates for future work:

1. **Parallel Exports**: Export 3-5 charts concurrently (faster for large dashboards)
2. **Cloud Storage**: Export directly to S3, Google Drive, Dropbox
3. **Export Filters**: "Only charts with data", "Only visible charts"
4. **Format Options**: Support CSV ZIP, Parquet, JSON in addition to Excel
5. **Dashboard Filters Applied**: Respect active dashboard filters during export
6. **Scheduled Bulk Exports**: Integrate with Reports/Alerts for recurring exports
7. **Export Templates**: Save chart selection preferences
8. **Compression**: GZIP large Excel files automatically
9. **Export History**: Track who exported what and when (audit trail)

## References

- [Existing Export Implementation](superset-frontend/src/explore/exploreUtils/index.js)
- [Chart Data API](superset/charts/data/api.py)
- [Dashboard Download Menu](superset-frontend/src/dashboard/components/menu/DownloadMenuItems/index.tsx)
- [xlsx Library Documentation](https://docs.sheetjs.com/)
- [Superset Export Architecture Discussion](https://github.com/apache/superset/discussions/...)

## Revision History

- 2026-02-02: Initial proposal created during hackathon planning
