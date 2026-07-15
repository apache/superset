# Contract: Custom Metric Time-Grain Normalization

## Scope

This is an internal query-generation contract. It does not add or change a public HTTP API.

## Input

- Rendered custom SQL metric text.
- Database engine specification.
- Existing metric-processing context.

## Output

- For engines without explicit support: the exact input text.
- For PostgreSQL and Redshift: input text with recognized string-literal first arguments of actual `DATE_TRUNC` calls rewritten to lowercase.
- All non-target computational tokens remain unchanged. Line comments may receive a safety-preserving representation change when the metric is embedded in a larger query.

## Required examples

| Input | Output |
|---|---|
| `DATE_TRUNC('quarter', created_at)` | unchanged |
| `DATE_TRUNC('QUARTER', created_at)` | `DATE_TRUNC('quarter', created_at)` |
| `date_trunc('QuArTeR', created_at)` | `date_trunc('quarter', created_at)` |
| `CASE WHEN DATE_TRUNC('MONTH', created_at) = ... THEN COUNT(*) END` | only `'MONTH'` becomes `'month'` |
| `status = 'QUARTER'` | unchanged |
| `OTHER_DATE_TRUNC('QUARTER', created_at)` | unchanged |
| `DATE_TRUNC(unit_column, created_at)` | unchanged |
| `DATE_TRUNC('fiscal_quarter', created_at)` | unchanged |

## Invariants

1. Ad hoc metrics run existing SQL validation after normalization. Saved metrics retain authoritative save-time validation and receive only runtime template rendering plus normalization before query construction.
2. The transformation does not regenerate the complete SQL expression.
3. Saved and ad hoc SQL metrics produce the same normalized expression.
4. SELECT and order-by reuse cannot diverge in normalization.
5. Comment contents and unrelated literals are not normalization targets; line-comment delimiters may be converted to an embedding-safe form without changing comment contents.
6. PostgreSQL and Redshift chart time-grain expressions retain their existing lowercase templates.
7. Other database engines retain identity behavior unless separately justified and tested.

## Failure behavior

- Tokenization or recognition uncertainty results in unchanged source passed to existing validation.
- Malformed SQL remains rejected by existing validation.
- A genuinely different time grain or date column is not coerced to match the chart grouping.
- If a rendered saved metric cannot be normalized safely, query construction leaves it unchanged; existing save-time validation remains authoritative.
