# Research: Preserve Equivalent Time-Grain Expressions

## Decision 1: Canonicalize only `DATE_TRUNC` unit literals

**Decision**: For PostgreSQL and Redshift custom SQL metrics, lowercase recognized `DATE_TRUNC` first-argument unit literals using a source-preserving, token-aware transformation.

**Rationale**: PostgreSQL accepts unit values case-insensitively when evaluating the function but compares the grouped expression structurally before evaluation. The live fixture confirms that `DATE_TRUNC('quarter', created_at)` in `GROUP BY` and `DATE_TRUNC('QUARTER', created_at)` in a `CASE` metric produce `GroupingError`. Lowercase is the established canonical form in Superset's PostgreSQL time-grain templates.

**Alternatives considered**:

- Broad SQLGlot parse/generate: rejected because it previously changed aggregation semantics and was removed by #36113.
- Uppercase the generated time-grain templates: rejected because lowercase and mixed-case user metrics would then fail instead.
- Regular-expression replacement: rejected because it can modify comments, string contents, or function lookalikes.
- Group by ordinal or alias: rejected as a much broader cross-dialect query-generation change.

## Decision 2: Use an engine-spec hook with explicit opt-in

**Decision**: Add identity behavior to the base engine specification and opt in only PostgreSQL and Redshift, sharing the implementation without activating it on every Postgres-like subclass.

**Rationale**: The transformation exists to align custom metrics with each engine's generated time-grain contract. Some `PostgresBaseEngineSpec` descendants use different templates or casing, so inheritance-wide behavior would exceed the evidence and could regress them.

**Alternatives considered**:

- Put active behavior on `PostgresBaseEngineSpec`: rejected because it implicitly affects HANA, Hologres, Netezza, Snowflake, TimescaleDB, Vertica, YugabyteDB, and other descendants.
- Put behavior globally in `sanitize_clause`: rejected because that expands the change to filters, columns, ordering expressions, and every engine.

## Decision 3: Normalize at the custom metric boundary

**Decision**: Normalize rendered SQL custom metrics exactly once through a metric-only entry point before they become SQLAlchemy literal expressions, covering saved metrics, ad hoc metrics, and processed/order-by reuse without affecting generic expression processing.

**Rationale**: Saved metrics and ad hoc metrics enter query generation through different paths. Changing only `sanitize_clause` misses saved metrics, while changing only one `adhoc_metric_to_sqla` implementation misses another conversion path. Jinja expansion must happen first so generated `DATE_TRUNC` calls are visible. Generic expression functions also process columns and filters, so the normalization boundary must remain explicitly metric-only.

**Alternatives considered**:

- Normalize after SQLAlchemy compilation: rejected because it is late, dialect-dependent string surgery.
- Normalize only ad hoc metrics: rejected because existing saved uppercase metrics would remain broken.

## Decision 4: Preserve comment-free SQL and characterize comments

**Decision**: Retain the #36113 verbatim path and global sanitizer behavior. Add final-query comment regressions and handle unsafe line-comment embedding only in the metric-specific normalization path; do not make a cross-engine `sanitize_clause` change in this feature.

**Rationale**: Current `sanitize_clause` returns comment-free source unchanged but regenerates expressions containing comments. SQLGlot's base generator can change `DATE_TRUNC` shape, and its PostgreSQL generator can introduce other semantic rewrites. Comments are part of the stated non-regression scope, but broad regeneration is not an acceptable fix. Metric-scoped conversion of unsafe line comments to equivalent block comments keeps the delivery batch narrow.

**Alternatives considered**:

- Ignore commented expressions: rejected because custom metrics already support comments and the spec requires semantic preservation.
- Special-case generated `TIMESTAMP_TRUNC` output: rejected as brittle recovery after an avoidable semantic transformation.

## Decision 5: Bottom-heavy verification with one live database

**Decision**: Use focused unit/query-generation tests, one PostgreSQL integration execution, and manual chart validation. Verify Redshift through generated SQL rather than a live service.

**Rationale**: The defect is concentrated in deterministic expression construction. Unit tests give fast coverage across units and dialect boundaries; PostgreSQL execution proves the actual grouping rule; manual browser validation demonstrates customer behavior. The clarified spec does not require live Redshift infrastructure.

**Alternatives considered**:

- Browser automation for every grain: rejected as slow and redundant.
- PostgreSQL-only tests: rejected because the ticket explicitly includes Redshift.
- Live Redshift integration: rejected because it is unnecessary for deterministic query compatibility and would make delivery depend on external infrastructure.

## Evidence

- `superset/db_engine_specs/postgres.py`: lowercase PostgreSQL time-grain templates.
- `superset/db_engine_specs/redshift.py`: Redshift inherits the PostgreSQL time-grain map.
- `superset/sql/parse.py`: `sanitize_clause` preserves comment-free text following #36113.
- `superset/models/helpers.py` and `superset/connectors/sqla/models.py`: separate custom metric conversion paths.
- Live PostgreSQL fixture: 10,000 `public.orders` rows; mixed literal casing reproduces the reported grouping error.
- Git history: #41215 began preserving single-statement execution text; #36113/#41125 later stopped broad custom-clause regeneration but does not canonicalize explicitly uppercase or previously saved metrics.
