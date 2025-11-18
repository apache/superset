# Consolidating Chart Abstractions Under `Explorable`

## Current State: Three Overlapping Abstractions

### 1. `Explorable` Protocol (New - Minimal Interface)
**Location**: `superset/explorables/base.py`

**Core Methods** (currently defined):
- `get_query_result(query_object)` - Execute queries
- `get_query_str(query_obj)` - Get query string without executing
- `get_extra_cache_keys(query_obj)` - Cache key components
- Properties: `uid`, `type`, `columns`, `column_names`, `data`, `cache_timeout`, `changed_on`, `perm`, `schema_perm`, `offset`

**Design Philosophy**: Minimal, focused on query execution and metadata

### 2. `ExploreMixin` (Legacy - Base for Chart Creation)
**Location**: `superset/models/helpers.py:763`

**Key Characteristics**:
- Tightly coupled to SQLAlchemy (`sqla_aggregations`, `get_sqla_row_level_filters`)
- Many SQL-specific methods (`_process_sql_expression`, `_process_select_expression`)
- Database-specific properties: `database`, `catalog`, `schema`, `sql`, `db_engine_spec`
- Over 30+ methods and properties

**Problem**: Too SQLAlchemy-specific for semantic layers

### 3. `BaseDatasource` (SQLAlchemy Model)
**Location**: `superset/connectors/sqla/models.py:165`

**Key Characteristics**:
- Concrete SQLAlchemy model (not a mixin/protocol)
- Direct database columns: `id`, `description`, `cache_timeout`, `perm`, etc.
- Inherits from `AuditMixinNullable`, `ImportExportMixin`
- Owns `columns: list[TableColumn]`, `metrics: list[SqlMetric]`

**Problem**: Cannot be inherited by non-SQLAlchemy datasources

---

## Recommended Consolidation Strategy

### Phase 1: Extend `Explorable` Protocol (Minimal Additions)

Add **only** what's absolutely necessary for the current codebase to work. Based on the mypy errors and usage patterns:

```python
@runtime_checkable
class Explorable(Protocol):
    """Minimal interface for explorable data sources."""

    # === EXISTING (keep as-is) ===
    def get_query_result(self, query_object: QueryObject) -> QueryResult: ...
    def get_query_str(self, query_obj: QueryObjectDict) -> str: ...
    def get_extra_cache_keys(self, query_obj: QueryObjectDict) -> list[Hashable]: ...

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

    @property
    def cache_timeout(self) -> int | None: ...

    @property
    def changed_on(self) -> datetime | None: ...

    @property
    def perm(self) -> str: ...

    @property
    def schema_perm(self) -> str | None: ...

    @property
    def offset(self) -> int: ...

    # === NEW ADDITIONS (based on actual usage) ===

    # Security & Access Control
    @property
    def is_rls_supported(self) -> bool:
        """Whether this explorable supports Row Level Security."""
        ...

    # Optional: For SQL-based datasources only
    # These return None for semantic layers
    @property
    def database(self) -> Database | None:
        """Database connection (None for non-SQL explorables)."""
        ...

    @property
    def query_language(self) -> str | None:
        """Query language for syntax highlighting (e.g., 'sql', 'graphql')."""
        ...
```

### Phase 2: Make `BaseDatasource` Implement `Explorable`

Add explicit implementation to show it conforms:

```python
class BaseDatasource(AuditMixinNullable, ImportExportMixin, Explorable):
    """SQL-based datasource that implements Explorable protocol."""

    # All existing code stays the same
    # The protocol just formalizes what's already there

    @property
    def is_rls_supported(self) -> bool:
        return True  # Already exists as class attribute

    @property
    def database(self) -> Database | None:
        # Subclasses implement this (SqlaTable has it)
        raise NotImplementedError()

    @property
    def query_language(self) -> str | None:
        return self.query_language  # Already exists
```

### Phase 3: Deprecate `ExploreMixin` (Gradual Migration)

**Strategy**: Don't fight the legacy code. Instead:

1. **Keep ExploreMixin for now** - It's only used by `BaseDatasource` subclasses
2. **Make BaseDatasource inherit from Explorable** instead
3. **Move SQL-specific methods** from ExploreMixin into `BaseDatasource` (where they belong)
4. **Eventually delete ExploreMixin** once everything is on `Explorable`

---

## What to Add to `Explorable`? Decision Framework

### ✅ **Add if**:
- Used in >5 places in query execution path
- Applies to ALL explorables (SQL tables, saved queries, semantic layers)
- Simple property/method (no complex logic)

### ❌ **Don't add if**:
- Only applies to SQL datasources (put in `BaseDatasource` instead)
- Implementation-specific (SQLAlchemy, Jinja templates, etc.)
- Complex business logic (use helper classes instead)

---

## Handling the Mypy Errors

For methods that need SQL-specific attributes (like `database`, `catalog`):

### Option A: Make them optional on `Explorable`
```python
@property
def database(self) -> Database | None:
    """Database (None for non-SQL explorables)."""
    ...
```

**Pros**: Simple, backward compatible
**Cons**: Semantic layers return None, caller must handle

### Option B: Keep them off `Explorable`, use type narrowing
```python
# In security/manager.py
def can_access_schema(self, datasource: Explorable | BaseDatasource) -> bool:
    # Type narrow when needed
    if isinstance(datasource, BaseDatasource):
        database = datasource.database
        catalog = datasource.catalog
    else:
        # Semantic layers don't have schemas in the traditional sense
        return True  # Or handle differently
```

**Pros**: Cleaner protocol, explicit about what's SQL-specific
**Cons**: More isinstance checks

### Recommendation: **Option A for now, Option B long-term**

Start with Option A (add optional `database`, `query_language`) because:
- Gets the code working quickly
- Semantic layers can return `None`
- Later, refactor security methods to properly handle non-SQL explorables

---

## Minimal Changes Needed Right Now

Based on the mypy errors, add these to `Explorable`:

```python
# In superset/explorables/base.py

@runtime_checkable
class Explorable(Protocol):
    # ... existing methods ...

    # ADD THESE:
    @property
    def is_rls_supported(self) -> bool:
        """Whether RLS is supported."""
        ...

    @property
    def database(self) -> Any | None:  # Use Any to avoid circular import
        """Database object (None for non-SQL explorables)."""
        ...

    @property
    def query_language(self) -> str | None:
        """Language for syntax highlighting."""
        ...
```

Then update your semantic layer implementation to return:
```python
class SemanticLayerExplorable:
    @property
    def is_rls_supported(self) -> bool:
        return False  # Or True if you support it

    @property
    def database(self) -> None:
        return None

    @property
    def query_language(self) -> str | None:
        return "graphql"  # Or whatever makes sense
```

---

## Long-term Vision

```
Current:
┌─────────────────┐  ┌──────────────┐  ┌─────────────┐
│  ExploreMixin   │  │BaseDatasource│  │ Explorable  │
│  (SQL-heavy)    │  │(SQLAlchemy)  │  │ (Protocol)  │
└────────┬────────┘  └──────┬───────┘  └──────┬──────┘
         │                  │                  │
         └──────────────────┴──────────────────┘
                    Confusing!

Target:
                 ┌─────────────┐
                 │ Explorable  │ ← Minimal protocol
                 │ (Protocol)  │
                 └──────┬──────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
┌────────▼────────┐         ┌──────────▼─────────┐
│ BaseDatasource  │         │ SemanticExplorable │
│ (SQL Tables)    │         │ (Your Layer)       │
└─────────────────┘         └────────────────────┘
```

---

## Action Items

1. **Add 3 properties to `Explorable`**: `is_rls_supported`, `database`, `query_language` (all optional/None for semantic layers)

2. **Update your semantic layer** to implement these (return None/False where appropriate)

3. **Fix security manager methods** to handle None values gracefully:
   ```python
   if database := getattr(datasource, "database", None):
       # SQL-specific logic
   ```

4. **File issues to track**:
   - Deprecate ExploreMixin
   - Move SQL methods from ExploreMixin to BaseDatasource
   - Refactor security manager for non-SQL explorables

This gives you a working system today while paving the way for a cleaner architecture tomorrow.
