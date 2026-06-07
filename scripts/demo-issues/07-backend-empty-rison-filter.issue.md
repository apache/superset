---
title: "Backend: ignore empty Rison filter query parameter instead of parsing"
labels: bug,backend,demo-seed,test-needed
---
## Summary
An empty `f` Rison filter query parameter should be treated as "no filters", but it is passed to the parser.

## Expected behavior
- `filter_string=""` → `[]`
- `filter_string=None` → `[]`
- Valid Rison strings continue to parse

## Actual behavior
Empty string input is not treated as a no-op and may produce warnings or incorrect filter objects.

## Affected area
- `superset/utils/rison_filters.py` — `RisonFilterParser.parse()`

## Acceptance criteria
- [ ] `""` returns an empty filter list
- [ ] Valid Rison filter strings still parse correctly
- [ ] Unit test added for empty-string `f` parameter

## Target branch
`devin-demo-target-v2`

## Notes for remediation
- Do not add the `devin-remediate` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
