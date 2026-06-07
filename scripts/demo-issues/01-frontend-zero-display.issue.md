---
title: "Frontend: dashboard filter formatter should preserve numeric zero values"
labels: bug,frontend,dashboard,demo-seed,test-needed
---
## Summary
Dashboard filter indicators and badges show a blank value when a native filter is set to numeric `0`.

## Expected behavior
- `0` displays as `"0"`
- `null`, `undefined`, and `""` remain empty/missing

## Actual behavior
Numeric `0` is treated as missing and renders as an empty string.

## Affected area
- `superset-frontend/src/dashboard/components/nativeFilters/utils.ts` — `getFilterValueForDisplay()`

## Acceptance criteria
- [ ] `getFilterValueForDisplay(0)` returns `"0"`
- [ ] `getFilterValueForDisplay(null)`, `undefined`, and `""` still return `""`
- [ ] Dashboard filter badge shows `0` for a zero-valued numeric filter
- [ ] Unit test added for numeric zero

## Target branch
`devin-demo-target-v2`

## Notes for remediation
- Do not add the `devin-remediate` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
