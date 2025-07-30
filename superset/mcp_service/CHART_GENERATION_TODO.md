# Chart Generation Improvement Plan

Based on user feedback from testing the chart generation API, this document tracks improvements needed for the MCP service chart generation functionality.

## Status: Active Development

### 1. **Fix ASCII Preview Rendering** 🟡 In Progress
**Status**: Partially Complete  
**Issue**: ASCII previews show "Range: nan to nan" for time series data
**Tasks:**
- [x] Fix ASCII chart rendering for time series/datetime data
- [x] Add proper NaN/null value handling in ASCII generation
- [x] Implement fallback messages when data can't be visualized
- [ ] Add unit tests for edge cases (empty data, NaN values, date formats)

### 2. **Enhance Error Messages with Context** 🟢 Complete
**Status**: Complete  
**Issue**: Generic error messages without helpful context
**Tasks:**
- [x] Create detailed error response schema with:
  - [x] Invalid field name
  - [x] Available columns list
  - [x] Fuzzy matching suggestions for typos
  - [x] Data type mismatches
- [x] Implement column validation with helpful error messages
- [x] Add dataset schema introspection for better error context

### 3. **Fix Table Chart Aggregation** 🟢 Complete
**Status**: Complete  
**Issue**: Table previews truncate headers, unexpected aggregation behavior
**Tasks:**
- [x] Fix column header truncation in table previews
- [x] Clarify GROUP BY behavior for non-aggregated columns
- [x] Improve table formatting with proper column width calculation
- [x] Add option to control grouping behavior explicitly
- [x] Document expected table aggregation behavior

### 4. **Fix Preview Generation Consistency** 🟢 Complete
**Status**: Complete  
**Issue**: Previews not generated when `save_chart=false`
**Tasks:**
- [x] Ensure preview generation works regardless of save_chart flag
- [x] Fix the logic flow to generate previews before/after save
- [x] Add preview generation from form data for unsaved charts
- [x] Remove base64 preview support (never return base64)
- [ ] Add integration tests for all preview generation scenarios
- [ ] Validate preview_formats parameter is respected

### 5. **Implement Rich Performance Analytics** 🟢 Medium Priority
**Status**: Not Started  
**Issue**: Generic performance feedback
**Tasks:**
- [ ] Add query analysis with specific optimization suggestions:
  - [ ] Index recommendations based on filter columns
  - [ ] Partitioning suggestions for large datasets
  - [ ] Caching recommendations with specific TTL values
- [ ] Include metrics:
  - [ ] Rows processed
  - [ ] Bytes scanned
  - [ ] Execution plan hints
- [ ] Implement cost estimation when available

### 6. **Enhance Semantic Analysis** 🟢 Medium Priority
**Status**: Not Started  
**Issue**: Basic semantic responses without actual insights
**Tasks:**
- [ ] Implement statistical analysis:
  - [ ] Trend detection (increasing/decreasing/stable)
  - [ ] Seasonality detection
  - [ ] Outlier detection with specific values
  - [ ] Growth rate calculations
- [ ] Add data storytelling:
  - [ ] Key insights based on actual data
  - [ ] Anomaly descriptions with context
  - [ ] Comparative analysis (YoY, MoM)
- [ ] Include summary statistics in response

### 7. **Additional Improvements** 🔵 Low Priority
**Status**: Not Started
- [ ] Add preview format validation
- [ ] Implement preview size constraints
- [ ] Add chart type validation against dataset characteristics
- [ ] Improve caching for preview generation
- [ ] Add preview quality options (low/medium/high)

## Implementation Timeline

### Phase 1 (Critical Fixes - Current Sprint)
1. Fix preview generation when `save_chart=false` (#4)
2. Fix ASCII preview NaN handling (#1)
3. Fix table header truncation (#3)

### Phase 2 (Error Handling - Next Sprint)
1. Implement enhanced error response schema (#2)
2. Add column validation with suggestions (#2)
3. Add comprehensive error tests (#2)

### Phase 3 (Data Quality - Sprint 3)
1. Fix table aggregation behavior (#3)
2. Implement semantic analysis engine (#6)
3. Add statistical calculations (#6)

### Phase 4 (Performance - Sprint 4)
1. Add performance analytics (#5)
2. Implement optimization suggestions (#5)
3. Add cost estimation (#5)

## Testing Requirements
- Unit tests for each component
- Integration tests for full chart generation flow
- Edge case testing (empty data, large datasets, special characters)
- Performance benchmarking

## Documentation Requirements
- API documentation with examples
- Error response catalog
- Best practices guide
- Migration guide for breaking changes

## Progress Tracking
- 🔴 Critical - Must fix immediately
- 🟡 High Priority - Fix in current release
- 🟢 Medium Priority - Plan for next release
- 🔵 Low Priority - Nice to have

Last Updated: 2025-07-30
