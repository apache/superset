## What Happened

Importing a database connection ZIP (Settings → Database Connections →
Export/Import) can complete successfully while creating no `schema_access`
permission for a schema that has appeared on the live target connection
since the connection's last successful sync -- most importantly, a schema
that was created on the underlying database after the connection was
originally set up. Editing the imported connection in the UI and re-saving
it (with no changes) makes the missing schema's permission appear
immediately.

Expected: after a successful import, every schema currently visible on the
target connection has a `schema_access` permission (or the import/update
visibly reports that it could not verify one).

Actual: a single failure while listing a catalog's schemas during the
import silently discards every schema permission that catalog would have
produced -- both new ones and already-granted ones -- while the import as a
whole still reports success. Separately, importing a chart, dataset, or
saved-query bundle that references a database already present in the target
skips the permission sync entirely for that database, every time, with no
failure involved at all.

## Root Cause

Two distinct, additive causes were found. Both are `verified` at the code
level (read end-to-end and reproduced with a failing→passing unit test);
whether the first of the two is the specific mechanism behind any one
previously reported incident is `inferred` -- there is no production log
confirming a schema-listing exception actually occurred and cleared on
retry for that incident. No production evidence for that link exists or is
obtainable at this remove; what follows is the strongest defect this
investigation can verify that plausibly produces the reported symptom, not
a confirmed match to a specific past occurrence.

### Cause 1 (verified mechanism, inferred link to any specific past incident): a transient failure during schema listing discards a whole catalog's grants

`verified` -- `superset/db_engine_specs/base.py:126`:

```python
GenericDBException = Exception
```

`GenericDBException` is a bare alias for the built-in `Exception` class, not
a distinct, narrower exception type.

`verified` -- `superset/commands/database/utils.py`, `add_permissions()`
(before this change):

```python
for catalog in catalogs:
    try:
        for schema in database.get_all_schema_names(catalog=catalog, cache=False):
            security_manager.add_permission_view_menu(
                "schema_access",
                security_manager.get_schema_perm(
                    database.database_name,
                    catalog,
                    schema,
                ),
            )
    except GenericDBException:  # pylint: disable=broad-except
        logger.warning("Error processing catalog '%s'", catalog)
        continue
```

Because `database.get_all_schema_names(...)` returns its result atomically
(one query, one `set[str]`, or an exception -- never a partial list), any
exception raised while listing schemas for a catalog discards *every*
schema that catalog would have produced this attempt, not just the ones
that were actually inaccessible. And because `except GenericDBException`
catches literally any `Exception`, this fires for genuinely transient
failures (a driver hiccup, a momentary lock, metadata not yet visible right
after a `CREATE SCHEMA`) exactly the same way it fires for a persistently
unlistable catalog (the condition PR #31437 introduced this handler for,
e.g. AWS RDS's `rdsadmin`) -- there is no way, from inside this handler, to
tell the two apart.

`add_permissions()` is called, unconditionally, both when a database is
freshly imported (`existing=None`) and when an existing database is
re-imported with `overwrite=True` -- both reachable through the real import
lifecycle (`superset/commands/importers/v1/__init__.py`'s `run()` /
`validate()` only blocks an existing-UUID import when `overwrite=False`,
via `_prevent_overwrite_existing_model()`, which raises a
`CommandInvalidError` *before* `_import()` -- and therefore
`add_permissions()` -- is ever reached). On both paths,
`add_permissions()` does a live, uncached query
(`database.get_all_schema_names(catalog=..., cache=False)`), so in the
common case it correctly grants every schema currently visible on the
connection, including ones that appeared after the connection was
originally created. The gap only shows up when that specific live query
fails for a reason unrelated to genuine inaccessibility.

Reproduced (`verified`, a command-helper-level unit test,
`tests/unit_tests/commands/databases/importers/v1/command_test.py::test_transient_schema_listing_failure_is_recovered_by_retry`,
which calls `ImportDatabasesCommand._import()` directly -- not
`.run()`/`.validate()` -- so it exercises `add_permissions()` and the
surrounding import logic but not the full command lifecycle. The
`overwrite=True` re-import scenario it drives is confirmed reachable in
production separately, by the integration test
`tests/integration_tests/databases/api_tests.py::test_import_database_overwrite`,
which does go through the API and `run()`/`validate()`):
1. Import a database connection for the first time (`existing=None`): the
   live connection exposes `old_schema`. `add_permission_view_menu` is
   called for it, as expected.
2. The live connection gains `new_schema`, but the *first* attempt to list
   schemas for the (single, non-catalog) connection raises a bare
   `Exception` -- simulating a transient driver/connector hiccup, e.g. right
   after the schema was created and its metadata hasn't propagated yet on
   the target database.
3. Re-import the same bundle with `overwrite=True` (the only way to
   legitimately re-import an existing connection; confirmed by the
   integration test `tests/integration_tests/databases/api_tests.py`'s
   `test_import_database_overwrite`, which asserts a 422 for
   `overwrite=False` against an existing UUID). Before the fix,
   `add_permission_view_menu` is called zero times for this import: the
   transient exception discards the entire catalog's schema list, so
   neither `new_schema` (which needed a first grant) nor a redundant
   re-confirmation of `old_schema` happens, and the import still reports
   success with no user-visible indication that anything was skipped.

`inferred`: this matches the reported workaround (editing the connection
and re-saving it re-runs the same kind of live schema discovery, via
`SyncPermissionsCommand`, triggered unconditionally by
`UpdateDatabaseCommand.run()`; by the time a human notices the problem and
acts on it, whatever transient condition affected the earlier attempt has
typically cleared, so the retry succeeds and backfills the missing grant).
This is a plausible, self-consistent explanation and the best one this
investigation can verify end-to-end, but it is a reconstruction, not a
confirmed diagnosis: no log from the original report was available to
confirm a schema-listing exception actually fired and cleared. A verified,
reproduced defect that plausibly explains the reported symptom class is
being treated as worth fixing on its own merits, independent of whether it
is provably *the* incident.

### Cause 2 (verified, independent of Cause 1): the existing-UUID/no-overwrite branch of `import_database()` skips permission sync unconditionally, and is reachable

An earlier revision of this investigation claimed the early return in
`import_database()` (`superset/commands/database/importers/v1/utils.py`,
`if existing: if not overwrite or not can_write: return existing`) --
which skips `add_permissions()` entirely -- was dead code, unreachable
through `ImportDatabasesCommand`'s real lifecycle because
`_prevent_overwrite_existing_model()` rejects a same-UUID,
`overwrite=False` *database-only* import with a 422 before `_import()` runs.

That is correct for a database-only import, but incomplete: `verified` by
reading `superset/commands/chart/importers/v1/__init__.py:78`,
`superset/commands/dataset/importers/v1/__init__.py:66`,
`superset/commands/query/importers/v1/__init__.py:61`, and
`superset/commands/dashboard/importers/v1/__init__.py:135,149` -- all four
call `import_database()` directly, bypassing `ImportModelsCommand.validate()`
/ `_prevent_overwrite_existing_model()` for the database sub-resource (that
validation only applies to the top-level model the command is importing --
charts, datasets, saved queries, or dashboards -- not to a database nested
inside the bundle). The chart, dataset, and saved-query importers always
pass `overwrite=False` unconditionally. The dashboard importer passes
`overwrite=overwrite_assets`, where `overwrite_assets = overwrite and
kwargs.get("overwrite_all", False)` (`superset/commands/dashboard/importers/v1/__init__.py:135`)
-- so it reaches the same no-overwrite branch whenever either flag is
false, which is the default (`overwrite=False`, `overwrite_all=False`) and
the common case; it only takes the overwrite path when both are explicitly
set to `True`. So the branch is reachable, every time a chart/dataset/
saved-query/dashboard bundle references a database that already exists in
the target (e.g. a dashboard exported from the same instance and
re-imported, or one instance's export imported into another that already
has the same database registered): `add_permissions()` is never called for
that database on that import, regardless of whether anything failed.

This is a second, independent way the reported symptom (a schema created
on the underlying connection after the database was first imported never
gets a `schema_access` permission) can occur -- it requires no exception at
all, just a bundle that references an already-present database.

## Why It Wasn't Caught

Test gap (Cause 1): `tests/unit_tests/databases/commands/utils_test.py` /
`tests/unit_tests/commands/databases/utils_test.py` covered `add_permissions()`
tolerating a failure for *one catalog out of several* (`catalog2` fails,
`catalog1`/`catalog3` still succeed), but every existing test used a
catalog-supporting, multi-catalog database. None exercised the much more
common single-catalog case (`supports_catalog=False`, e.g. Postgres,
MySQL, most schema-only connections), where there is only one "catalog"
(`None`) and a failure there discards *all* schema permissions for the
import, not a fraction of them. None of the existing tests asserted
anything about a schema that had not been granted before the failing call
-- only about catalogs that had never had schemas processed at all -- so
the "old grant survives, new grant silently never happens, import still
succeeds" shape had no coverage.

Test gap (Cause 2): no test at any layer asserted on `add_permissions()`
being called (or not called) for the existing/no-overwrite branch of
`import_database()`. All chart/dataset/saved-query importer tests mock
`import_database()` or `add_permissions()` outright, so none of them could
have observed that this branch skips the call.

Review gap: the first revision of this investigation treated "unreachable
through `ImportDatabasesCommand.run()`" as equivalent to "unreachable",
without checking whether any other caller in the codebase invokes
`import_database()` directly. Three do.

## The Fix

### Fix 1 -- retry the schema-listing call, without narrowing what the catalog-level guard tolerates

`superset/commands/database/utils.py`: retry the live schema-listing call
once, immediately (no sleep/backoff), before giving up on a catalog. This
does not change which exceptions are tolerated (still the broad
`GenericDBException`/`Exception` catch, preserving the original protective
intent from PR #31437 -- a persistently unlistable catalog like AWS RDS's
`rdsadmin` still fails both attempts and is still skipped, with the same
outcome as before) and does not add any latency to the common
(no-failure) case; it only adds one extra network round trip, and only for
a catalog that just failed.

An earlier draft of this fix moved the retry loop *outside* the exception
guard that also covers `security_manager.add_permission_view_menu()`,
which narrowed that guard's scope: previously, an exception raised while
creating a schema's permission view (not just while listing schemas) was
tolerated the same way and caused the rest of that catalog to be skipped
without failing the whole import. The retry below is isolated to a small
helper so the surrounding `try/except` keeps covering both the
schema-listing call and the permission-view-creation loop, exactly as it
did before this change:

Before (pre-existing, on `master`):
```python
for catalog in catalogs:
    try:
        for schema in database.get_all_schema_names(catalog=catalog, cache=False):
            security_manager.add_permission_view_menu(...)
    except GenericDBException:  # pylint: disable=broad-except
        logger.warning("Error processing catalog '%s'", catalog)
        continue
```

After (`superset/commands/database/utils.py`, lines ~54-119):
```python
def _get_all_schema_names_with_retry(
    database: Database, catalog: str | None
) -> set[str]:
    try:
        return database.get_all_schema_names(catalog=catalog, cache=False)
    except GenericDBException:  # pylint: disable=broad-except
        return database.get_all_schema_names(catalog=catalog, cache=False)


...

for catalog in catalogs:
    try:
        schemas = _get_all_schema_names_with_retry(database, catalog)
        for schema in schemas:
            security_manager.add_permission_view_menu(...)
    except GenericDBException:  # pylint: disable=broad-except
        logger.warning("Error processing catalog '%s'", catalog)
        continue
```

`tests/unit_tests/databases/commands/utils_test.py`:
- `test_add_permissions_handle_failures` and
  `test_add_permissions_retries_transient_failure` cover the retry itself
  (a catalog is now attempted twice before being given up on).
- `test_add_permissions_tolerates_failure_creating_permission_view` (new)
  pins the scope this fix must not narrow: a failure while granting one
  schema's permission still aborts the rest of that catalog and still lets
  the next catalog proceed, exactly as before the retry was introduced.

This is not a full fix for the theoretical "provider is down for the whole
request" case (still silently skipped, by design, to avoid failing an
otherwise-successful import over one inaccessible catalog) but directly
closes the transient-failure gap reproduced above.

### Fix 2 -- back-fill permissions on the existing/no-overwrite branch of `import_database()`

`superset/commands/database/importers/v1/utils.py`, `import_database()`:
when an existing database is found and the branch would otherwise return it
untouched (`overwrite=False`, the case the chart, dataset, and saved-query
importers always hit, and the dashboard importer hits whenever `overwrite`
or `overwrite_all` is false, for a database they reference but don't own),
call `add_permissions(existing)` first -- but only when the caller already
has the `can_write` capability this function already gates every other
permission-view creation behind, so this does not create a new way to
trigger permission-view creation without that capability:

```python
if existing:
    if not overwrite or not can_write:
        if can_write:
            try:
                add_permissions(existing)
            except (SupersetDBAPIConnectionError, OAuth2RedirectError) as ex:
                logger.warning(ex.message)
        return existing
    config["id"] = existing.id
    ...
```

The exception handling mirrors the existing tail-of-function call to
`add_permissions()` for the fresh-import/overwrite path, so a transient or
OAuth2 failure here is non-fatal in the same way.

Trade-off accepted: this adds a full uncached live metadata scan of the
target connection (`add_permissions()` enumerates catalogs via
`get_all_catalog_names()`, then issues a separate `get_all_schema_names()`
query per catalog -- its own existing comment already warns this "can take
a long time (minutes, while importing a chart, eg)" for
cross-catalog-enabled engines) every time a chart, dataset, saved-query, or
dashboard bundle references a database that already exists in the target --
mirroring the always-on cost the fresh-import and `overwrite=True` paths
already pay, not a new class of cost, but a new place it is paid.

Tests (`tests/unit_tests/databases/commands/importers/v1/import_test.py`):
- `test_import_database_existing_no_overwrite_backfills_permissions`
  confirms `add_permissions(existing)` is called on this branch when the
  caller can write databases.
- `test_import_database_existing_no_overwrite_no_permission_skips_backfill`
  pins that this stays gated on `can_write`, matching every other
  permission-view creation in this function.

## Latent Bugs Found

- `get_all_catalog_names()` (the catalog-enumeration call for
  catalog-supporting, multi-catalog-enabled databases,
  `superset/commands/database/utils.py`) is not wrapped in any try/except
  inside `add_permissions()` at all -- an exception there propagates out of
  `add_permissions()` entirely, is not caught by `import_database()`'s
  `except (SupersetDBAPIConnectionError, OAuth2RedirectError)` unless it
  happens to be one of those two types, and would otherwise fail the whole
  import. This is a real asymmetry (catalog listing is not tolerated the
  way per-catalog schema listing is) but changing it is a larger, separate
  decision and not needed to fix the reported symptom.
- `tests/unit_tests/conftest.py`'s `session`/`get_session` fixture mocks
  `SupersetSecurityManager.session` wholesale and only rebinds `.query` to
  the real in-memory session, leaving `.add`/`.commit` as no-op `MagicMock`
  attributes. A test that calls the committing
  `security_manager.add_permission_view_menu()` and then tries to verify
  persisted state via `find_permission_view_menu()` against this fixture
  always gets `None` back, even on success, because the "add" half of the
  round trip is mocked away while the "find" half hits the real session.
  Existing tests, and this fix's tests, avoid this by asserting on
  `add_permission_view_menu` call arguments instead of persisted state.
- Fix 2 lives inside `import_database()` itself, so it covers all four
  known callers that can reach the existing/no-overwrite branch directly
  (chart, dataset, and saved-query importers, which always pass
  `overwrite=False`; the dashboard importer, which passes it whenever
  `overwrite` or `overwrite_all` is false) without needing to patch each
  call site individually. If a future importer adds another direct call
  site, it inherits the same backfill automatically.

## Prevention

Add test coverage for the single-catalog (`supports_catalog=False`) shape
of `add_permissions()`'s failure handling, not just the multi-catalog
shape -- this is now covered by
`test_transient_schema_listing_failure_is_recovered_by_retry`. More
generally: any test asserting that `add_permissions()` "tolerates a
failure and continues" should also assert what happens to schemas that
*needed a first-time grant* during the failing attempt, not just schemas
from catalogs that succeeded -- a passing "continues to the next catalog"
test can still hide "and this catalog's new schema never gets granted" if
nothing asserts on it directly.

Separately: when a fix narrows or restructures an existing exception guard
(as the first draft of Fix 1 did to the permission-view-creation
tolerance), add a test that pins the guard's *original* scope, not just the
new behavior being added -- a retry test alone would not have caught that
regression.

And: "is this code path reachable" claims about a specific entry point
(e.g. `ImportDatabasesCommand.run()`) do not generalize to "this code path
is unreachable" without checking every caller of the function in question --
`import_database()` had three other direct callers beyond the one this
investigation initially checked.
