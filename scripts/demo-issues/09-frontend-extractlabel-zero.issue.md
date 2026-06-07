---
title: "Frontend: native filter extractLabel should preserve zero in multi-value filters"
labels: bug,frontend,dashboard,demo-seed,test-needed
---
## Summary
When a native filter has multiple selected values including `0`, the label formatter drops zero from the displayed label.

## Expected behavior
- `[0, 1, 2]` should display as `"0, 1, 2"`
- Empty/null entries should still be filtered out

## Actual behavior
Numeric `0` is removed from multi-value filter labels.

## Affected area
- `superset-frontend/src/dashboard/components/nativeFilters/selectors.ts` — `extractLabel()`

## Acceptance criteria
- [ ] `extractLabel({ value: [0, 1] })` returns `"0, 1"`
- [ ] `null`, `undefined`, and `""` entries are still excluded
- [ ] Unit test added for zero in multi-value arrays

## Target branch
`devin-demo-target-v2`

## Notes for remediation
- Do not add the `devin-remediate` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
