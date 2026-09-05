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
whole still reports success. Because the exception type caught is a bare
alias for the built-in `Exception`, this triggers on *any* failure while
listing schemas, not only the kind of persistently-unlistable-catalog
condition (e.g. AWS RDS `rdsadmin`) the handler was written for -- including
purely transient ones.

## Root Cause

`verified` -- `superset/db_engine_specs/base.py:126`:

```python
GenericDBException = Exception
```

`GenericDBException` is a bare alias for the built-in `Exception` class, not
a distinct, narrower exception type.

`verified` -- `superset/commands/database/utils.py` (`add_permissions()`),
lines 84-97:

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
unlistable catalog -- there is no way, from inside this handler, to tell the
two apart.

`add_permissions()` is called, unconditionally, both when a database is
freshly imported (`existing=None`) and when an existing database is
re-imported with `overwrite=True` -- both reachable through the real import
lifecycle (`superset/commands/importers/v1/__init__.py`'s `run()` /
`validate()` only blocks an existing-UUID import when `overwrite=False`,
via `_prevent_overwrite_existing_model()`, which raises a `CommandInvalidError`
*before* `_import()` -- and therefore `add_permissions()` -- is ever
reached; see "Corrected claim" below). On both reachable paths,
`add_permissions()` does a live, uncached query
(`database.get_all_schema_names(catalog=..., cache=False)`), so in the
common case it correctly grants every schema currently visible on the
connection, including ones that appeared after the connection was
originally created. The gap only shows up when that specific live query
fails for a reason unrelated to genuine inaccessibility.

Reproduced (`verified`, unit test at the command layer through the
reachable overwrite=True re-import path,
`tests/unit_tests/commands/databases/importers/v1/command_test.py::test_transient_schema_listing_failure_is_recovered_by_retry`):
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

This matches the reported workaround: editing the connection and re-saving
it re-runs the same kind of live schema discovery (via
`SyncPermissionsCommand`, triggered unconditionally by
`UpdateDatabaseCommand.run()`); by the time a human notices the problem and
acts on it, whatever transient condition affected the earlier attempt has
typically cleared, so the retry (a human-driven one, minutes or hours
later) succeeds and backfills the missing grant.

### Corrected claim (previous fix in this investigation was wrong)

An earlier revision of this investigation located a different, superficially
similar branch: `import_database()`
(`superset/commands/database/importers/v1/utils.py:118-121`) returns
immediately, without calling `add_permissions()`, when an existing database
is found and `overwrite=False`. A fix was drafted and a regression test
written against that branch by calling
`ImportDatabasesCommand._import()` directly.

That branch is real code, but **it is not reachable through the actual
import lifecycle**: `ImportDatabasesCommand.run()` calls `self.validate()`
first, which calls `_prevent_overwrite_existing_model()`
(`superset/commands/importers/v1/__init__.py:132,152-172`). That method
appends a `ValidationError` whenever an existing UUID is found and
`overwrite` was not requested, and `validate()` then raises
`CommandInvalidError` -- `_import()` is never called in that case. This is
directly confirmed by `tests/integration_tests/databases/api_tests.py`'s
`test_import_database_overwrite`, which asserts the API returns **422**
or exactly this scenario, with the error message `"Database already exists
and \`overwrite=true\` was not passed"`. The original regression test only
reached the dead branch because it called the internal `_import()` static
method directly, bypassing `run()`/`validate()` entirely -- something the
product never does. That fix and its test have been reverted; they are not
part of this change. Whether that unreachable branch is worth removing as
dead code, or whether some other internal caller could reach it, is noted
under "Latent Bugs Found" as a separate, later concern.

## Why It Wasn't Caught

Test gap: `tests/unit_tests/databases/commands/utils_test.py` /
`tests/unit_tests/commands/databases/utils_test.py` cover `add_permissions()`
tolerating a failure for *one catalog out of several* (`catalog2` fails,
`catalog1`/`catalog3` still succeed) -- but every existing test uses a
catalog-supporting, multi-catalog database. None exercised the much more
common single-catalog case (`supports_catalog=False`, e.g. Postgres,
MySQL, most schema-only connections), where there is only one "catalog"
(`None`) and a failure there discards *all* schema permissions for the
import, not a fraction of them. None of the existing tests asserted
anything about a schema that had not been granted before the failing call
-- only about catalogs that had never had schemas processed at all --
so the "old grant survives, new grant silently never happens, import still
succeeds" shape had no coverage.

## The Fix

`superset/commands/database/utils.py`, `add_permissions()` (the per-catalog
schema-listing loop, current lines 84-97): retry the live schema-listing
call once, immediately (no sleep/backoff), before giving up on a catalog.
This does not change which exceptions are tolerated (still the broad
`GenericDBException`/`Exception` catch, preserving the original protective
intent from PR #31437 -- a persistently unlistable catalog like AWS RDS
`rdsadmin` still fails both attempts and is still skipped, with the same
outcome as before) and does not add any latency to the common
(no-failure) case; it only adds one extra network round trip, and only for
a catalog that just failed. This is not a full fix for the theoretical
"provider is down for the whole request" case (still silently skipped, by
design, to avoid failing an otherwise-successful import over one
inaccessible catalog) but directly closes the transient-failure gap
confirmed by reproduction above.

Before:
```python
for catalog in catalogs:
    try:
        for schema in database.get_all_schema_names(catalog=catalog, cache=False):
            security_manager.add_permission_view_menu(...)
    except GenericDBException:  # pylint: disable=broad-except
        logger.warning("Error processing catalog '%s'", catalog)
        continue
```

After:
```python
for catalog in catalogs:
    for attempt in range(2):
        try:
            schemas = database.get_all_schema_names(catalog=catalog, cache=False)
        except GenericDBException:  # pylint: disable=broad-except
            if attempt:
                logger.warning("Error processing catalog '%s'", catalog)
            continue
        for schema in schemas:
            security_manager.add_permission_view_menu(...)
        break
```

`tests/unit_tests/databases/commands/utils_test.py::test_add_permissions_handle_failures`
is updated to reflect the new retry: a catalog whose schema listing fails
is now attempted twice before being skipped, so its `side_effect` list
needs an extra failing entry for the retry attempt.

## Latent Bugs Found

- The `import_database()` early-return for an existing database with
  `overwrite=False` (`superset/commands/database/importers/v1/utils.py:118-121`)
  is unreachable through `ImportDatabasesCommand`'s real lifecycle (see
  "Corrected claim" above), but it is still live code, and the internal
  `import_database()` function is not marked private/test-only. If any
  future or existing caller invokes `import_database()` directly (bypassing
  `ImportModelsCommand.validate()`), it would hit exactly the same
  no-permission-sync gap this investigation initially (mis)diagnosed. Worth
  a separate, later look at whether that branch should be removed as truly
  dead code or hardened, but out of scope here since it is not what this
  ticket's reported symptom traces to.
- `get_all_catalog_names()` (the catalog-enumeration call for
  catalog-supporting, multi-catalog-enabled databases, `superset/commands/database/utils.py`
  line 69) is not wrapped in any try/except inside `add_permissions()` at
  all -- an exception there propagates out of `add_permissions()` entirely,
  is not caught by `import_database()`'s
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
  Existing tests avoid this by asserting on `add_permission_view_menu` call
  arguments (via `mocker.patch`/`mocker.spy`) instead of persisted state;
  this fix's regression test follows the same pattern for the same reason.

## Prevention

Add test coverage for the single-catalog (`supports_catalog=False`) shape
of `add_permissions()`'s failure handling, not just the multi-catalog
shape -- this is now covered by
`test_transient_schema_listing_failure_is_recovered_by_retry`. More
generally: any test asserting that `add_permissions()` "tolerates a
failure and continues" should also assert what happens to schemas that
*needed a first-time grant* during the failing attempt, not just schemas
from catalogs that succeeded -- a passing "continues to the next catalog"
test can still hide "and this catalog's new schema never gets granted"
if nothing asserts on it directly.
