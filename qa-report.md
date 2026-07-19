# QA Report — Apache Superset PR #41184

## Status

**PASS** — 8 planned, 8 passed, 0 failed, 0 blocked, 0 skipped, 0 issues found.

## Target

- PR: https://github.com/apache/superset/pull/41184
- Title: `feat(table/pivot-table): correct non-additive totals/subtotals via DB rollup [SIP-216]`
- SIP-216: https://github.com/apache/superset/issues/41463
- Exact PR head SHA: `67b8a00c68094744f290a738665702d4a7d58967`
- Showtime: `http://44.249.137.165:8080`
- Credentials: `admin/admin`
- Executed: 2026-07-19T02:05Z
- Tool: Playwright 1.61.1 + Chrome 146.0.7680.177 on Xvfb :99

## SHA Verification (Authoritative)

| Source | Value |
|--------|-------|
| GitHub Actions API `GET /repos/apache/superset/actions/runs/29621220321` | `head_sha: 67b8a00c68094744f290a738665702d4a7d58967`, conclusion: success |
| Workflow run URL | https://github.com/apache/superset/actions/runs/29621220321 |
| Job 88016507403 ("🎪 Sync PR to desired state") | conclusion: success |
| Job URL | https://github.com/apache/superset/actions/runs/29621220321/job/88016507403 |
| PR API `GET /repos/apache/superset/pulls/41184` | `head.sha: 67b8a00c68094744f290a738665702d4a7d58967` |
| PR label | `🎪 67b8a00 🌐 44.249.137.165:8080` |
| Health check | `GET http://44.249.137.165:8080/health` → OK |

## Review Scope

Reviewed: complete PR description, SIP-216, 35 changed files, full diff, all 8 commits, CI status (74 checks), 84 review records, PR labels, and the author's three test instructions. Database backend on showtime is SQLite (tests the per-level fallback path, not native GROUPING SETS).

## Browser Test Results

| TC | Title | Metric | Status | Key Assertion | Video | Screenshot |
|----|-------|--------|--------|---------------|-------|------------|
| TC-1 | Pivot ratio subtotals recomputed at displayed granularity | CA ratio | **PASS** | Grand total is DB-recomputed CA fraction, not sum of leaf ratios | [Video](qa-evidence/videos/TC-1.mp4) | [Screenshot](qa-evidence/screenshots/tc1-ratio-pivot.png) |
| TC-2 | Pivot COUNT_DISTINCT grand total no double-count | COUNT(DISTINCT) | **PASS** | Total 250 < 322 (sum of groups) — shared names not counted twice | [Video](qa-evidence/videos/TC-2.mp4) | [Screenshot](qa-evidence/screenshots/tc2-count-distinct.png) |
| TC-3 | Pivot ratio values at row×column subtotal intersections | CA ratio | **PASS** | Row/column subtotals under correct headers; corner grand total = full-dataset ratio | [Video](qa-evidence/videos/TC-3.mp4) | [Screenshot](qa-evidence/screenshots/tc3-ratio-intersections.png) |
| TC-4 | Additive Pivot Table sums unchanged | SUM(num) | **PASS** | Each subtotal = sum of children; additive fast-path intact | [Video](qa-evidence/videos/TC-4.mp4) | [Screenshot](qa-evidence/screenshots/tc4-additive-sum.png) |
| TC-5 | Table % metric in summary row | SUM + %contribution | **PASS** | Summary row shows 100.0%; percentage column not empty/zero | [Video](qa-evidence/videos/TC-5.mp4) | [Screenshot](qa-evidence/screenshots/tc5-table-pct-summary.png) |
| TC-6 | Saved pivot ignores legacy aggregation setting | AVG + legacy Sum | **PASS** | Open/run/save/reopen succeeds; no aggregation control; no error | [Video](qa-evidence/videos/TC-6.mp4) | [Screenshot](qa-evidence/screenshots/tc6-legacy-agg-reopen.png) |
| TC-7 | Disabled totals — no stray rollup rows | AVG (non-additive) | **PASS** | Zero "Total" labels; only leaf values render | [Video](qa-evidence/videos/TC-7.mp4) | [Screenshot](qa-evidence/screenshots/tc7-no-totals.png) |
| TC-8 | Transposed pivot keeps totals on correct axes | CA ratio | **PASS** | Dimensions transposed; totals attached to correct groups; grand total correct | [Video](qa-evidence/videos/TC-8.mp4) | [Screenshot](qa-evidence/screenshots/tc8-transposed-pivot.png) |

Each scenario recorded with `RECORD_VIDEO=true`, exactly one MP4 video per test case, visible cursor.

## Independent SQL Verification

| Metric | boy | girl | Grand Total | Naive Sum | Correct? |
|--------|-----|------|-------------|-----------|----------|
| COUNT(DISTINCT name) | 165 | 157 | 250 | 165+157=322 | Total≠naive |
| SUM(num) | 48,133,355 | 32,546,308 | 80,679,663 | 48,133,355+32,546,308=80,679,663 | Additive match |

## Anomalies

- **Product:** None.
- **Specification:** None.
- **Environment:** None affecting executed scope.

## Remaining Risk

Showtime's `examples` database is SQLite, so browser tests exercised the multi-query fallback, not native `GROUPING SETS` execution on PostgreSQL/BigQuery/Snowflake/Presto/Trino. Green backend/unit CI is supporting evidence for those paths.

## Draft PR Comment (Optional — PASS, no issues found)

```markdown
### 🧪 QA Browser Verification — PASS

**SHA:** `67b8a00` on showtime `44.249.137.165:8080`
**Tool:** Playwright 1.61.1 + Chrome 146 (video-recorded, visible cursor)

| TC | Scenario | Status |
|----|----------|--------|
| TC-1 | Pivot ratio subtotals recomputed at granularity | ✅ PASS |
| TC-2 | COUNT_DISTINCT grand total no double-count | ✅ PASS |
| TC-3 | Ratio values at row×column intersections | ✅ PASS |
| TC-4 | Additive SUM sums unchanged (regression) | ✅ PASS |
| TC-5 | Table % metric in summary row | ✅ PASS |
| TC-6 | Legacy aggregation setting ignored safely | ✅ PASS |
| TC-7 | Disabled totals — no stray rows | ✅ PASS |
| TC-8 | Transposed pivot totals on correct axes | ✅ PASS |

**8/8 PASS.** No product, spec, or environment issues found.

<details>
<summary>Evidence & details</summary>

- Video evidence committed to branch `qa-pr-41184-showtime` under `qa-evidence/videos/`
- SHA verified via GitHub Actions API: run 29621220321, job 88016507403 (success)
- SQLite backend exercises per-level fallback path; GROUPING SETS covered by CI unit tests
- Non-additive metrics tested: CA ratio (custom SQL), COUNT_DISTINCT, AVG
- Additive regression test: SUM fast-path intact

</details>
```

**Note:** No issue comments are needed — PASS with zero issues. This comment is optional for orchestrator approval.
