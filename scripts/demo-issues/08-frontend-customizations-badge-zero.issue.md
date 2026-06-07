---
title: "Frontend: dashboard customizations badge should count zero as an active value"
labels: bug,frontend,dashboard,demo-seed,test-needed
---
## Summary
The dashboard customizations badge hides active display controls when the selected value is numeric `0` or boolean `false`.

## Expected behavior
- `0` and `false` count as active customization values
- Only `null` / `undefined` should be excluded

## Actual behavior
The badge count and tooltip omit customizations whose value is `0` or `false`.

## Affected area
- `superset-frontend/src/dashboard/components/CustomizationsBadge/index.tsx` — `effectiveCustomizations`

## Acceptance criteria
- [ ] Customizations with value `0` appear in the badge count
- [ ] Customizations with value `false` appear in the badge count
- [ ] `null` / `undefined` values are still excluded
- [ ] Unit test added for falsy-but-valid customization values

## Target branch
`devin-demo-target-v2`

## Notes for remediation
- Do not add the `devin-remediate` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
