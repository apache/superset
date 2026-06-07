---
title: "Backend: treat empty until parameter as missing in get_since_until"
labels: bug,backend,demo-seed,test-needed
---
## Summary
When `until=""` is passed directly to `get_since_until()`, the empty string is parsed instead of falling back to the relative end default.

## Expected behavior
- `until=""` should behave like a missing until value
- Valid until strings continue to parse correctly

## Actual behavior
`until=""` triggers `parse_human_datetime("")` instead of using the default relative end.

## Affected area
- `superset/utils/date_parser.py` — `get_since_until()` else branch

## Acceptance criteria
- [ ] `get_since_until(since="7 days ago", until="")` treats until as missing
- [ ] Non-empty until values still parse correctly
- [ ] Unit test added for empty-string `until` parameter

## Target branch
`devin-demo-target-v2`

## Notes for remediation
- Do not add the `devin-remediate` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
