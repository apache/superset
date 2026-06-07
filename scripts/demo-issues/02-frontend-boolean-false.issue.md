---
title: "Frontend: dashboard filter formatter should preserve boolean false values"
labels: bug,frontend,dashboard,demo-seed,test-needed
---
## Summary
Dashboard filter display treats boolean `false` as an empty/missing value.

## Expected behavior
- `false` displays as `"false"`
- `true` displays as `"true"`
- `null` and `undefined` remain empty/missing

## Actual behavior
Boolean `false` renders as an empty string in filter badges and tooltips.

## Affected area
- `superset-frontend/src/dashboard/components/nativeFilters/utils.ts` — `getFilterValueForDisplay()`

## Acceptance criteria
- [ ] `getFilterValueForDisplay(false)` returns `"false"`
- [ ] `getFilterValueForDisplay(true)` returns `"true"`
- [ ] Dashboard UI shows `false` when a boolean filter is set to false
- [ ] Unit test added for boolean false/true

## Target branch
`devin-demo-target-v2`

## Notes for remediation
- Do not add the `devin-remediate` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
