# Issue #31158 - Dashboard Export with Special Characters Fix

## Bug Fix: URL-encode dashboard export filename for special characters

### Problem
Exporting dashboards with special characters in their names (e.g., `Dashboard [2024] - Q4`, `Report/Q4`, `Test™`) would fail or result in corrupted download filenames because special characters were not properly URL-encoded in the HTTP Content-Disposition header.

### Solution  
- Added `urllib.parse.quote()` import to `superset/dashboards/api.py`
- URL-encode the export filename before passing it to `send_file()` as `download_name`
- Preserves the `.` in the file extension with `safe="."` parameter

### Files Changed
- `superset/dashboards/api.py`: Added URL-encoding for export filename
- `tests/integration_tests/dashboard_export_test.py`: Added regression tests

### Tests
- `test_export_dashboard_with_normal_name` (baseline)
- `test_export_dashboard_with_brackets` (brackets: `[]`)
- `test_export_dashboard_with_special_chars` (forward slash, ampersand, trademark)
- `test_export_multiple_dashboards_with_special_chars` (batch export)

### Impact
- Fixes export functionality for all dashboard names with special characters
- No breaking changes - uses standard URL encoding
- Content-Disposition header now properly formatted
- ZIP files are generated correctly with encoded filenames
