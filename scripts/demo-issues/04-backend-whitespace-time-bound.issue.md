---
title: "Backend: trim whitespace before treating time range bounds as empty"
labels: bug,backend,demo-seed,test-needed
---
## Summary
Whitespace-only time range bounds (e.g. `"start of this month :   "`) are not trimmed before the empty-bound check.

## Expected behavior
Bounds containing only whitespace should be treated the same as an empty/missing bound.

## Actual behavior
Whitespace-only segments are treated as non-empty and sent through datetime expression parsing.

## Affected area
- `superset/utils/date_parser.py` — `get_since_until()`, `since_and_until_partition`

## Acceptance criteria
- [ ] Partition segments are stripped before empty-bound normalization
- [ ] `"start of this month :   "` behaves like an open-ended until bound
- [ ] Valid non-empty bounds with intentional internal spaces still parse correctly
- [ ] Unit test added for whitespace-only bounds

## Target branch
`devin-demo-target-v2`

## Notes for remediation
- Do not add the `devin-remediate` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
