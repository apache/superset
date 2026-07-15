# Quickstart: Reproduce and Validate SC-112048

## Fixture

The running PostgreSQL fixture contains `cube_source.public.orders` with 10,000 rows and these relevant columns:

- `created_at` timestamp spanning 2024-01-01 through 2025-12-30
- `amount` numeric

Host connection:

```text
postgresql://cube:cube@127.0.0.1:15433/cube_source
```

Superset-in-Docker connection:

```text
postgresql://cube:cube@host.docker.internal:15433/cube_source
```

## Confirm the database behavior

Verify the fixture:

```bash
PGPASSWORD=cube psql -h 127.0.0.1 -p 15433 -U cube -d cube_source \
  -c "SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM public.orders;"
```

The mismatched query must fail before the fix:

```sql
SELECT
  DATE_TRUNC('quarter', created_at) AS quarter_start,
  CASE
    WHEN DATE_TRUNC('QUARTER', created_at) = TIMESTAMP '2024-01-01'
    THEN COUNT(*) / 1000
  END AS metric
FROM public.orders
GROUP BY DATE_TRUNC('quarter', created_at);
```

The authoritative baseline uses matching lowercase units and must succeed.

### Baseline evidence (2026-07-15)

- Fixture: 10,000 rows from `2024-01-01 04:01:00` through `2025-12-30 17:51:00`.
- Mixed-case metric unit: PostgreSQL raised `GroupingError` because `created_at` did not match the grouped expression.
- Lowercase metric unit: query succeeded; the first two quarter rows were `2024-01-01` with metric `1` and `2024-04-01` with a null metric.

## Browser scenario

1. Start the Superset environment for this checkout and confirm its `/health` endpoint.
2. Add a PostgreSQL database using the Docker URI above.
3. Register `public.orders` as a dataset and mark `created_at` temporal.
4. Create a time-series chart with:
   - x-axis/time column: `created_at`
   - time grain: Quarter
   - broad time range covering 2024
   - custom SQL metric:

```sql
CASE
  WHEN DATE_TRUNC('QUARTER', created_at) = '2024-01-01'
    THEN COUNT(*) / 1000
  WHEN DATE_TRUNC('QUARTER', created_at) = '2024-04-01'
    THEN COUNT(*) / 2000
END
```

5. Run the chart and inspect the generated query.

Acceptance:

- The chart renders on its first execution.
- The metric and `GROUP BY` contain structurally matching lowercase `DATE_TRUNC` units.
- Results match the direct lowercase baseline.
- Repeating with mixed-case `QuArTeR` also succeeds.
- A month-grain smoke check succeeds.
- An unrelated metric such as `ROUND(AVG(amount), 4)` retains its semantics.

## Automated checks

Activate the project environment using the environment configured for this checkout, for example:

```bash
source "${SUPERSET_VENV:-$HOME/venv/superset-4}/bin/activate"
```

Run focused tests selected during implementation:

```bash
pytest tests/unit_tests/db_engine_specs/test_postgres.py \
  tests/unit_tests/db_engine_specs/test_redshift.py
pytest tests/unit_tests/models/helpers_test.py -k "date_trunc or time_grain"
pytest tests/integration_tests/sqla_models_tests.py -k "date_trunc or time_grain"
pytest tests/integration_tests/query_context_tests.py \
  -k "equivalent_date_trunc_grouping"
pytest tests/unit_tests/sql/parse_tests.py -k "sanitize_clause"
```

Initial focused baseline command:

```bash
pytest -q tests/unit_tests/db_engine_specs/test_base.py \
  tests/unit_tests/db_engine_specs/test_postgres.py \
  tests/unit_tests/db_engine_specs/test_redshift.py \
  tests/unit_tests/sql/parse_tests.py -k "timegrain or sanitize_clause"
```

Baseline result: 52 passed, 827 deselected. The local environment is Python 3.12 despite the plan's Python 3.11 example; commands therefore rely on the configured virtual environment rather than a fixed interpreter version.

The committed PostgreSQL integration test must use Superset's managed test fixtures and PostgreSQL-only marker rather than `cube_source.public.orders`. The authoritative CI invocation must report the test as executed; an unexpected skip is a failure. The Cube database and port `15433` are used only for the manual browser scenario above.

Before pushing, stage the intended changes and run the mandatory full check:

```bash
git add <changed-files>
pre-commit run --all-files
```

### Implementation verification (2026-07-15)

- Engine-spec and helper matrix: 247 passed.
- Saved and ad hoc PostgreSQL metric comment cases: 4 passed.
- Managed PostgreSQL query-context regression: 1 passed against an isolated
  PostgreSQL 16 metadata database; the test executed under the
  `only_postgresql` marker and did not skip.
- Focused Ruff hook: passed.
- Focused MyPy hook: the changed files produced no errors; the hook stopped on
  the pre-existing `superset/semantic_layers/mapper.py:1040` `no-redef` error.
- A combined integration-file run encountered pre-existing local metadata
  state (`UNIQUE constraint failed: tables.table_name`); isolated tests for all
  changed integration cases passed.
- Mandatory `pre-commit run --all-files`: executed and failed on four duplicate
  MyPy definitions in pre-existing semantic-layer files and on the missing
  `@oxlint/binding-darwin-arm64` optional dependency. Installing the optional
  binding without changing the lockfile was blocked by the frontend workspace's
  existing npm peer-dependency conflict. All other reported hooks passed.
### Browser smoke evidence after metadata reset (2026-07-15)

- Recreated the checkout's Docker volumes with explicit approval and initialized
  a healthy Superset instance at `http://localhost:8098`.
- Added the Docker PostgreSQL connection and registered `public.orders`; Superset
  detected `created_at` as temporal and as the main datetime column.
- Created chart `SC-112048 DATE_TRUNC quarter regression` (chart ID 1) using a
  mixed-case `DATE_TRUNC('QuArTeR', created_at)` custom metric.
- The chart-data request returned eight rows without errors. Generated SQL used
  `DATE_TRUNC('quarter', created_at)` in the time axis, metric, and `GROUP BY`.
- A mixed-case Month request returned 24 rows and generated matching
  `DATE_TRUNC('month', created_at)` expressions.
- The unrelated `ROUND(AVG(amount), 4)` quarterly request returned eight rows;
  its generated metric expression remained exactly `ROUND(AVG(amount), 4)`.
