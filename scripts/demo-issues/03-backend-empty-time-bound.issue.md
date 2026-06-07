---
title: "Backend: normalize empty string bounds in colon-separated time range parsing"
labels: bug,backend,demo-seed,test-needed
---
## Summary
Open-ended time ranges with an empty bound (e.g. `"start of this month : "`) fail because empty strings are not normalized to `None`.

## Expected behavior
- `"start of this month : "` → `(since_datetime, None)`
- `" : now"` → `(None, until_datetime)`
- Closed ranges continue to parse correctly

## Actual behavior
Empty string bounds are passed to datetime parsing instead of being treated as missing.

## Affected area
- `superset/utils/date_parser.py` — `get_since_until()`, colon-separated partition loop

## Acceptance criteria
- [ ] Empty bound segments normalize to `None`
- [ ] `get_since_until("start of this month : ")` returns `None` for the open bound
- [ ] Existing `test_get_since_until` passes
- [ ] Unit test added for empty-string bound normalization

## Target branch
`devin-demo-target-v2`

## Notes for remediation
- Do not add the `devin-remediate` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
