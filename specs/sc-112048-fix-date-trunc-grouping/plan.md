# Implementation Plan: Preserve Equivalent Time-Grain Expressions

**Branch**: `sc-112048-fix-date-trunc-grouping` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/sc-112048-fix-date-trunc-grouping/spec.md`

## Summary

Canonicalize recognized `DATE_TRUNC` unit literals in PostgreSQL and Redshift custom SQL metrics to the lowercase spelling already used by those engines' generated time-grain expressions. The normalization will be source-preserving and token-aware, run after template expansion and before the metric becomes a SQLAlchemy literal, and leave every other token unchanged. This makes lowercase, uppercase, and mixed-case units structurally match the chart `GROUP BY` without restoring the broad SQLGlot regeneration removed by #36113.

## Technical Context

**Language/Version**: Python 3.10+ (project requirement; local validation uses Python 3.11)
**Primary Dependencies**: SQLAlchemy expression construction, SQLGlot tokenizer/parser for validation, Superset database engine specifications
**Storage**: No persistent schema changes; PostgreSQL fixture `cube_source.public.orders` is used for live validation
**Testing**: pytest unit and integration tests; manual Superset chart validation against PostgreSQL
**Target Platform**: Superset backend on Linux containers or native development environments; PostgreSQL and Amazon Redshift query dialects
**Project Type**: Existing Flask/Python web application backend
**Performance Goals**: Normalization performs at most one linear scan of each rendered custom SQL metric and no database round trips
**Constraints**: Preserve existing SQL safety validation; avoid broad AST regeneration; do not modify unrelated literals, comments, functions, filters, columns, or dialects; no live Redshift service required
**Scale/Scope**: Custom SQL metrics for PostgreSQL and Redshift, eight direct `DATE_TRUNC` units plus composite chart grains that use `minute` or `hour`

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

- **Type Safety — PASS**: New Python hooks and helpers will be fully annotated and MyPy-compatible.
- **Testing Strategy — PASS**: The plan prioritizes token/helper and query-generation unit tests, adds one PostgreSQL integration test, and keeps browser work as manual acceptance validation.
- **Modern Frontend Patterns — PASS**: No frontend change is planned.
- **Security & Access Control — PASS**: Existing subquery, parser, and denylist validation remains in place; normalization does not authorize new SQL constructs.
- **Simplicity & YAGNI — PASS**: Default behavior is identity; only PostgreSQL and Redshift opt in; only recognized `DATE_TRUNC` unit literals change.
- **Additional Constraints — PASS**: No model, migration, API, inline-import, or raw-query construction changes are required. Any new file receives an ASF header.
- **Workflow — PASS**: Focused tests, MyPy, and mandatory `pre-commit run --all-files` are included before push.

### Post-design re-check

The design introduces no database model, public API, frontend, RBAC, or import-surface change. The parser-aware helper is narrower than global SQL regeneration and retains the existing validation boundary. No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/sc-112048-fix-date-trunc-grouping/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── query-expression-normalization.md
└── tasks.md
```

### Source Code (repository root)

```text
superset/
├── db_engine_specs/
│   ├── base.py                 # identity normalization hook
│   ├── postgres.py             # shared lowercase DATE_TRUNC helper + PostgreSQL opt-in
│   └── redshift.py             # explicit Redshift opt-in
├── models/helpers.py           # single metric-only normalization entry point
└── connectors/sqla/models.py   # saved/ad hoc callers of the shared entry point

tests/
├── unit_tests/
│   ├── db_engine_specs/
│   │   ├── test_postgres.py
│   │   └── test_redshift.py
│   ├── models/helpers_test.py
│   └── sql/parse_tests.py      # existing semantic-preservation guards
└── integration_tests/
    ├── query_context_tests.py
    └── sqla_models_tests.py
```

**Structure Decision**: Extend the existing engine-spec and metric-conversion seams. Do not create a new service, API, frontend component, or persistence layer. Put generic identity behavior on the base engine specification, keep the source-preserving normalizer near PostgreSQL time-grain conventions, and opt in PostgreSQL and Redshift explicitly rather than through `PostgresBaseEngineSpec` inheritance.

## Phase 0: Research Conclusions

1. Add an engine-spec metric-expression normalization hook whose default returns input unchanged.
2. Implement a token-aware, source-preserving helper that finds actual `DATE_TRUNC` calls and lowercases only a recognized string-literal first argument.
3. Opt in `PostgresEngineSpec` and `RedshiftEngineSpec` explicitly. Do not enable the behavior for every `PostgresBaseEngineSpec` descendant because some descendants, including Snowflake, have different casing and expression conventions.
4. Invoke one metric-only normalization entry point for saved and ad hoc SQL metrics after Jinja expansion. Ad hoc metrics then continue through runtime validation; saved metrics retain authoritative save-time validation. Ensure processed order-by metrics reuse the same rendered and normalized expression as SELECT metrics.
5. Preserve the #36113 behavior: never broadly parse and regenerate comment-free custom SQL. Handle unsafe line-comment embedding only inside the metric-specific entry point, converting line-comment delimiters to a block-comment representation while preserving comment contents; do not change global `sanitize_clause` behavior.
6. Validate PostgreSQL through real execution and Redshift through deterministic query generation.

## Phase 1: Design

### Normalization algorithm

1. Receive the rendered custom metric expression and engine context.
2. Tokenize without regenerating the expression.
3. Identify function-call tokens named `DATE_TRUNC` case-insensitively.
4. Confirm the first argument is a simple quoted string literal whose unescaped value is one of `second`, `minute`, `hour`, `day`, `week`, `month`, `quarter`, or `year`, case-insensitively.
5. Replace only the literal's source span with its lowercase canonical value, preserving quote style and all surrounding source text.
6. Leave malformed calls, dynamic units, unrelated strings, comments, different functions, and unrecognized units untouched so ordinary validation retains authority.

### Metric-only integration point

- Add a typed identity hook on `BaseEngineSpec` for custom metric expression normalization.
- Implement the PostgreSQL/Redshift canonicalizer once and expose it through explicit overrides on `PostgresEngineSpec` and `RedshiftEngineSpec`.
- Define one typed custom-metric entry point in `ExploreMixin` that accepts rendered metric SQL, applies the engine hook exactly once, and returns the normalized expression. Generic column, WHERE, HAVING, and raw-selection processing MUST NOT call it.
- Call the entry point from both `ExploreMixin.adhoc_metric_to_sqla` and `SqlaTable.adhoc_metric_to_sqla` after template rendering. Wire `template_processor` through the SELECT and order-by callers so a Jinja-generated unit is rendered before normalization.
- Apply the same entry point to saved SQL metrics after their runtime Jinja rendering and before `literal_column`. Save-time validation remains authoritative; this feature does not add a second saved-metric validation pass.
- Treat the changes to generic and `SqlaTable` metric paths as one atomic implementation slice. Do not enable PostgreSQL behavior until all saved, ad hoc, SELECT, and order-by callers and tests are complete.

### Comment handling decision

Comment-free expressions follow the narrow metric normalizer and existing verbatim sanitizer path. Characterize block, inline line, and trailing line comments at the final query-generation boundary. For PostgreSQL and Redshift custom metrics only, the metric entry point may convert line comments to equivalent block comments so surrounding generated SQL cannot be consumed, while preserving comment text and all computational tokens. Global `sanitize_clause` behavior, non-metric clauses, and engines retaining the identity hook remain unchanged. If this metric-scoped rule cannot satisfy the characterization tests, stop and re-plan instead of broadening the sanitizer change.

### Test design

- Unit-test identity behavior for unaffected engines.
- Unit-test PostgreSQL and Redshift normalization for lower, upper, and mixed casing across all eight direct units.
- Cover composite grains whose templates contain `DATE_TRUNC('minute', ...)` or `DATE_TRUNC('hour', ...)`.
- Assert unrelated string literals such as `status = 'QUARTER'`, comments, lookalike function names, dynamic unit arguments, and genuinely different grains remain unchanged.
- Assert nested `CASE` and aggregate semantics remain intact.
- Exercise saved metrics, ad hoc metrics, SELECT reuse, order-by reuse, and Jinja-rendered units through separate focused query-generation tests.
- Keep existing #36113 `ROUND(AVG(...), n)` and comment tests green.
- Execute the quarterly query through Superset's managed PostgreSQL integration fixture using the repository's PostgreSQL-only convention, fail on an unexpected skip in the authoritative CI job, and compare with a direct lowercase baseline. Keep `cube_source.public.orders` exclusively for manual browser validation.
- Compile the complete ticket query for Redshift and assert the final metric and `GROUP BY` use structurally matching units.
- Verify structurally that the metric entry point invokes the engine normalizer once per rendered metric and performs no database work.

## Complexity Tracking

No constitution violations require justification.
