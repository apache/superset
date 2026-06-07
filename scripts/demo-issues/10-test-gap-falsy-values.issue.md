---
title: "Test gap: add regression coverage for falsy-but-valid dashboard filter values"
labels: bug,demo-seed,test-needed,frontend,backend
---
## Summary
Dashboard filter display and backend normalization paths lack consolidated regression coverage for values that are falsy in JavaScript/Python but semantically valid (`0`, `false`, `""` edge cases).

## Expected behavior
Add focused unit tests documenting intended behavior across:
- `getFilterValueForDisplay()`
- `extractLabel()`
- `CustomizationsBadge` active-value detection
- `get_since_until()` empty/whitespace bounds
- `parse_boolean_string()` whitespace handling
- `RisonFilterParser.parse()` empty-string input

## Actual behavior
No consolidated regression suite exists for these falsy-but-valid edge cases on branch `devin-demo-target-v2`.

## Affected area
- `superset-frontend/src/dashboard/components/nativeFilters/`
- `superset-frontend/src/dashboard/components/CustomizationsBadge/`
- `superset/utils/date_parser.py`
- `superset/utils/core.py`
- `superset/utils/rison_filters.py`

## Acceptance criteria
- [ ] Frontend tests cover `0`, `false`, and empty/null filter values
- [ ] Backend tests cover empty-string and whitespace-only time range bounds
- [ ] Backend tests cover whitespace-padded boolean strings and empty Rison `f` param
- [ ] Tests fail on the seeded bugs and pass after remediation

## Target branch
`devin-demo-target-v2`

## Notes for remediation
- Do not add the `devin-remediate` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
