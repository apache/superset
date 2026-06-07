---
title: "Backend: parse_boolean_string should accept common boolean strings with surrounding whitespace"
labels: bug,backend,demo-seed,test-needed
---
## Summary
`parse_boolean_string()` returns incorrect results for common boolean strings that include surrounding whitespace or inconsistent casing.

## Expected behavior
- `" true "` → `True`
- `" false "` → `False`
- `None` and `""` → `False`

## Actual behavior
Whitespace-padded or case-variant values such as `" true "` and `"TRUE"` are not recognized and fall through to `False`.

## Affected area
- `superset/utils/core.py` — `parse_boolean_string()`

## Acceptance criteria
- [ ] Leading/trailing whitespace is handled consistently
- [ ] Case-insensitive true/false values continue to work
- [ ] Unit tests added for whitespace-padded boolean strings

## Target branch
`devin-demo-target-v2`

## Notes for remediation
- Do not add the `devin-remediate` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
