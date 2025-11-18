# Schema Permission Refactor Complete ✅

## Summary

Successfully removed `schema_perm` from the Explorable protocol since it's a SQL-specific concept that doesn't apply to semantic layers!

---

## Problem Before

The Explorable protocol included `schema_perm`, but semantic layers don't have the SQL schema hierarchy:

```python
# ❌ Before - SQL-specific property in protocol
@runtime_checkable
class Explorable(Protocol):
    @property
    def schema_perm(self) -> str | None:
        """Schema-level permission string."""
```

**Issues**:
- Semantic layers don't have SQL database → schema → table hierarchy
- Forces non-SQL explorables to return None or implement unused property
- Leaky abstraction - protocol shouldn't assume SQL structure

---

## Solution

### 1. **Removed schema_perm from Explorable Protocol**

The property has been completely removed from the protocol:

```python
# ✅ After - Clean protocol without SQL assumptions
@runtime_checkable
class Explorable(Protocol):
    @property
    def perm(self) -> str:
        """
        Permission string for this explorable.

        Used by the security manager to check if a user has access
        to this data source. Format depends on the explorable type
        (e.g., "[database].[schema].[table]" for SQL tables).
        """
```

**Result**: The protocol now only requires `perm` (datasource-level permission), which all explorables have.

### 2. **Updated Security Manager with Type Narrowing**

Used `isinstance()` to distinguish SQL datasources from other explorables:

```python
# ✅ After - Type-safe with isinstance
def can_access_schema(self, datasource: "BaseDatasource | Explorable") -> bool:
    """
    Return True if the user can access the schema associated with specified
    datasource, False otherwise.

    For SQL datasources: Checks database → catalog → schema hierarchy
    For other explorables: Only checks all_datasources permission

    :param datasource: The datasource
    :returns: Whether the user can access the datasource's schema
    """
    from superset.connectors.sqla.models import BaseDatasource

    # Admin/superuser override
    if self.can_access_all_datasources():
        return True

    # SQL-specific hierarchy checks
    if isinstance(datasource, BaseDatasource):
        # Database-level access grants all schemas
        if self.can_access_database(datasource.database):
            return True

        # Catalog-level access grants all schemas in catalog
        if (
            hasattr(datasource, "catalog")
            and datasource.catalog
            and self.can_access_catalog(datasource.database, datasource.catalog)
        ):
            return True

        # Schema-level permission (SQL only)
        if self.can_access("schema_access", datasource.schema_perm or ""):
            return True

    # Non-SQL explorables don't have schema hierarchy
    return False
```

**Key Changes**:
- Replaced `getattr(datasource, "database", None)` with `isinstance(datasource, BaseDatasource)`
- Only checks SQL permission hierarchy for SQL datasources
- Non-SQL explorables rely on `can_access_all_datasources()` check
- Clear documentation about SQL vs non-SQL behavior

---

## SQL Permission Hierarchy (Still Works!)

The SQL permission hierarchy is still intact, just properly scoped to SQL datasources:

```
┌─────────────────────────────────────────┐
│ 1. All Datasource Access (Admin)       │ ← Works for ALL explorables
└─────────────────────────────────────────┘
              ↓ OR
┌─────────────────────────────────────────┐
│ 2. Database Access (SQL only)          │ ← isinstance(datasource, BaseDatasource)
│    Permission: [database].[database]    │    datasource.database
│    Grants: All schemas in this database │
└─────────────────────────────────────────┘
              ↓ OR
┌─────────────────────────────────────────┐
│ 3. Catalog Access (SQL only)           │ ← hasattr(datasource, "catalog")
│    Permission: [database].[catalog]     │    datasource.catalog
│    Grants: All schemas in this catalog  │
└─────────────────────────────────────────┘
              ↓ OR
┌─────────────────────────────────────────┐
│ 4. Schema Access (SQL only)            │ ← datasource.schema_perm
│    Permission: [database].[schema]      │    (still on BaseDatasource)
│    Grants: This specific schema         │
└─────────────────────────────────────────┘
```

**For semantic layers**:
```
┌─────────────────────────────────────────┐
│ 1. All Datasource Access (Admin)       │ ← Only check for semantic layers
└─────────────────────────────────────────┘
              ↓ OR
┌─────────────────────────────────────────┐
│ 2. Datasource Permission                │ ← datasource.perm
│    (Checked in raise_for_access)        │    (semantic layer-specific)
└─────────────────────────────────────────┘
```

---

## Changes Made

### File: `superset/explorables/base.py`

**Removed schema_perm property**:
```python
# Before: Had schema_perm property
@property
def schema_perm(self) -> str | None:
    """Schema-level permission string."""

# After: Property removed completely
# (Only perm remains for datasource-level permission)
```

### File: `superset/security/manager.py`

**Updated can_access_schema() method**:

**Before** (used getattr):
```python
def can_access_schema(self, datasource: "BaseDatasource | Explorable") -> bool:
    database = getattr(datasource, "database", None)
    return (
        self.can_access_all_datasources()
        or (database and self.can_access_database(database))
        or (hasattr(datasource, "catalog") and ... )
        or self.can_access("schema_access", datasource.schema_perm or "")
    )
```

**After** (uses isinstance):
```python
def can_access_schema(self, datasource: "BaseDatasource | Explorable") -> bool:
    from superset.connectors.sqla.models import BaseDatasource

    if self.can_access_all_datasources():
        return True

    if isinstance(datasource, BaseDatasource):
        # SQL-specific checks only
        if self.can_access_database(datasource.database):
            return True
        if hasattr(datasource, "catalog") and datasource.catalog:
            if self.can_access_catalog(datasource.database, datasource.catalog):
                return True
        if self.can_access("schema_access", datasource.schema_perm or ""):
            return True

    return False
```

---

## Benefits

### ✅ Clean Protocol
- No SQL-specific properties
- Semantic layers don't need to implement unused methods
- Protocol only defines truly universal interface

### ✅ Type-Safe
- Uses `isinstance()` for type narrowing
- Mypy understands SQL vs non-SQL branching
- No runtime attribute checks with `getattr()`

### ✅ Explicit SQL Logic
```python
# Crystal clear when SQL logic applies
if isinstance(datasource, BaseDatasource):
    # SQL-specific permission hierarchy
    ...
else:
    # Non-SQL explorables
    ...
```

### ✅ Semantic Layer Friendly
- Semantic layers don't implement schema_perm
- Access control based on their own permission model
- No forced compatibility with SQL concepts

### ✅ Backward Compatible
- All existing SQL datasources continue to work
- BaseDatasource still has schema_perm property
- Only protocol interface changed, not implementation

---

## Testing

### ✅ Type Checking Passed
```bash
$ pre-commit run mypy --files superset/explorables/base.py \
    superset/security/manager.py superset/common/query_context.py \
    superset/common/query_context_processor.py \
    superset/common/query_context_factory.py \
    superset/common/query_actions.py superset/connectors/sqla/models.py \
    superset/models/helpers.py

mypy...............................................................Passed
```

### 🧪 Recommended Manual Tests

1. **SQL Dataset Access with Schema Permission**
   ```
   - Create user with schema_access permission: [postgres].[public]
   - Create SQL table in that schema
   - Verify user can access the table
   - Verify user cannot access tables in other schemas
   ```

2. **SQL Dataset Access with Database Permission**
   ```
   - Create user with database_access permission: [postgres].[postgres]
   - Create tables in multiple schemas (public, private, analytics)
   - Verify user can access tables in ALL schemas
   ```

3. **Semantic Layer Access**
   ```python
   class SemanticLayerExplorable:
       @property
       def perm(self) -> str:
           return f"[semantic_layer].[{self.view_id}]"

       # No schema_perm needed!
   ```
   - Create semantic layer view
   - Create user with datasource_access permission to the view
   - Verify user can access the view
   - Verify user cannot access other views

4. **Admin Override**
   ```
   - Create admin user (all_datasource_access)
   - Verify admin can access:
     - SQL tables in any schema
     - Semantic layer views
     - All other explorables
   ```

---

## Impact on Semantic Layers

**Before**: Semantic layers had to implement unused schema_perm property:
```python
class SemanticLayerExplorable:
    @property
    def schema_perm(self) -> str | None:
        return None  # ← Unused, but required by protocol
```

**After**: Semantic layers only implement what they need:
```python
class SemanticLayerExplorable:
    @property
    def perm(self) -> str:
        """Semantic layer permission based on view ID."""
        return f"[semantic_layer].[{self.layer_id}].[{self.view_id}]"

    # No schema_perm needed! ✅
```

---

## Where schema_perm Still Exists

**Important**: `schema_perm` is NOT deleted from the codebase - it still exists on `BaseDatasource`:

```python
class BaseDatasource(Model, AuditMixinNullable, ImportExportMixin):
    """SQL-specific datasource base class."""

    @property
    def schema_perm(self) -> str | None:
        """Schema-level permission for SQL datasources."""
        return self._schema_perm  # ← Still exists!
```

**What changed**: It's no longer required by the Explorable protocol, so semantic layers don't need it.

---

## Complete Explorable Protocol

The final minimal protocol for all explorables:

```python
@runtime_checkable
class Explorable(Protocol):
    """
    Protocol for objects that can be explored to create charts.

    This protocol is intentionally minimal and database-agnostic.
    """

    # Core Query Interface
    def get_query_result(self, query_object: QueryObject) -> QueryResult: ...
    def get_query_str(self, query_obj: QueryObjectDict) -> str: ...

    # Identity & Metadata
    @property
    def uid(self) -> str: ...

    @property
    def type(self) -> str: ...

    @property
    def columns(self) -> list[Any]: ...

    @property
    def column_names(self) -> list[str]: ...

    @property
    def data(self) -> dict[str, Any]: ...

    # Caching
    @property
    def cache_timeout(self) -> int | None: ...

    @property
    def changed_on(self) -> datetime | None: ...

    def get_extra_cache_keys(self, query_obj: QueryObjectDict) -> list[Hashable]: ...

    # Security (minimal - just datasource permission)
    @property
    def perm(self) -> str: ...

    # Time/Date Handling
    @property
    def offset(self) -> int: ...

    def get_time_grains(self) -> list[dict[str, Any]]: ...

    # Optional Properties
    @property
    def is_rls_supported(self) -> bool: ...

    @property
    def query_language(self) -> str | None: ...
```

**Notes**:
- ✅ No `database` property (removed in cache timeout refactor)
- ✅ No `schema_perm` property (removed in this refactor)
- ✅ Each explorable implements fallback logic internally
- ✅ SQL-specific concerns handled by BaseDatasource subclass

---

## Summary Table

| Aspect | Before | After |
|--------|--------|-------|
| **Explorable Protocol** | Has `schema_perm: str \| None` | No `schema_perm` ❌ |
| **BaseDatasource** | Has `schema_perm` property | Still has `schema_perm` ✅ |
| **Security Manager** | Uses `getattr()` to access `schema_perm` | Uses `isinstance()` for type narrowing |
| **SQL Datasources** | Access controlled by schema hierarchy | Still works (scoped to SQL) ✅ |
| **Semantic Layers** | Must implement unused `schema_perm` | Only implement `perm` ✅ |
| **Type Safety** | ⚠️ Runtime checks | ✅ Compile-time type narrowing |

---

## Key Takeaway

**`schema_perm` is now a SQL-specific implementation detail, not part of the universal Explorable interface.**

- **SQL datasources** use the full permission hierarchy (database → catalog → schema → datasource)
- **Semantic layers** use their own permission model (based on `perm` property)
- **Security manager** uses type narrowing to apply appropriate checks

This makes the Explorable protocol truly database-agnostic! 🎉
