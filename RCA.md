# Snowflake Case-Sensitive Column Identifier Quoting

## Symptom

A physical Snowflake table can contain explicitly quoted, case-sensitive lowercase
columns, for example:

```sql
CREATE TABLE bug_test ("id" INT, "name" VARCHAR);
```

Charts backed by such a table can generate references such as `SELECT id, name`.
Snowflake folds those unquoted identifiers to `ID` and `NAME`, which do not match the
physical lowercase identifiers, so the query fails with a column-not-found error.

## Root Cause

The Snowflake SQLAlchemy dialect preserves the exact case discovered during
reflection by returning `quoted_name` values from its name-normalization logic.
Superset persists reflected table and column names in ordinary string ORM fields,
however, so the `quoted_name` subtype and its explicit-quoting flag are lost after a
save and reload.

During query generation, Superset consequently passes a plain string to
`sqlalchemy.column()`. SQLAlchemy's generic identifier heuristic leaves all-lowercase
names unquoted and quotes names containing uppercase or special characters. That
heuristic fits engines that fold unquoted identifiers to lowercase, but it is the
opposite of Snowflake's unquoted-identifier behavior. Superset can no longer infer
whether a lowercase string was explicitly quoted when its table was created.

For datasets with `normalize_columns` disabled, that history is not needed: the
stored value is already the exact physical identifier produced during metadata
synchronization. Explicitly quoting that exact value is safe and idempotent.

## Fix

The engine-spec interface gains an identifier-preparation hook whose default
implementation returns the supplied name unchanged, preserving every other engine's
existing SQLAlchemy auto-quoting behavior.

Snowflake overrides the hook to return an explicitly quoted SQLAlchemy identifier
when `normalize_columns` is disabled. Physical column construction in the modern and
legacy dataset query paths uses the hook before creating SQLAlchemy column elements.
Calculated and custom expressions remain on their existing `literal_column()` path.

When `normalize_columns` is enabled, the Snowflake hook leaves the stored name
unchanged because normalization is intentionally lossy; force-quoting that display
form could refer to a different physical identifier.

## Out of Scope

A related symptom affects dataset creation when the table name itself is an
explicitly quoted lowercase Snowflake identifier. Table, schema, and catalog quoting
in `FROM` clauses and table-existence checks are separate code paths and are not
changed by this fix. They require a follow-up focused on physical table identifiers.

## Testing

Offline unit tests compile SQLAlchemy expressions with an ANSI double-quote dialect,
so no Snowflake connection or Snowflake SQLAlchemy package is required. The tests
cover the physical-column query paths, Snowflake's quoted and normalized identifier
behavior, and the no-op default engine-spec behavior. The affected connector,
query-helper, Snowflake engine-spec, and base engine-spec test modules provide
regression coverage.
