# What is the `database` Attribute Used For?

The `database` attribute on the `Explorable` protocol is used in **3 main areas**. Here's a comprehensive breakdown:

---

## 1. 🕐 Time Granularity Options (`_get_timegrains`)

**File**: `superset/common/query_actions.py:63-78`

**Purpose**: Get available time grain options for time-series charts

```python
def _get_timegrains(query_context, query_obj, _):
    datasource = _get_datasource(query_context, query_obj)
    database = getattr(datasource, "database", None)
    grains = database.grains() if database else []
    return {
        "data": [
            {
                "name": grain.name,        # e.g., "5 minutes", "Hour", "Day"
                "function": grain.function, # e.g., "DATE_TRUNC('hour', {col})"
                "duration": grain.duration, # e.g., "PT5M" (ISO 8601 duration)
            }
            for grain in grains
        ]
    }
```

**What `database.grains()` does**:
- Returns database-specific SQL functions for time bucketing
- Each database has different datetime functions:
  - PostgreSQL: `DATE_TRUNC('hour', timestamp)`
  - MySQL: `DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')`
  - BigQuery: `TIMESTAMP_TRUNC(timestamp, HOUR)`

**For semantic layers**:
- If your semantic layer doesn't expose time grains, return `None` for database
- The UI will get an empty list `[]` and won't show time grain options
- If you DO want time grain controls, you'll need to provide this data another way

**Chart types that use this**:
- Time-series Line Chart
- Time-series Bar Chart
- Time-series Area Chart
- Any chart with temporal grouping

---

## 2. 💾 Cache Timeout Fallback (`get_cache_timeout`)

**File**: `superset/common/query_context.py:101-110`

**Purpose**: Determine how long to cache query results (fallback hierarchy)

```python
def get_cache_timeout(self) -> int | None:
    # Priority 1: Custom timeout for this specific query
    if self.custom_cache_timeout is not None:
        return self.custom_cache_timeout

    # Priority 2: Chart-level timeout
    if self.slice_ and self.slice_.cache_timeout is not None:
        return self.slice_.cache_timeout

    # Priority 3: Datasource-level timeout
    if self.datasource.cache_timeout is not None:
        return self.datasource.cache_timeout

    # Priority 4: Database-level default timeout
    if hasattr(self.datasource, "database") and self.datasource.database:
        return self.datasource.database.cache_timeout

    # Priority 5: System default
    return None
```

**Cache timeout cascade**:
1. Query-specific override
2. Chart configuration
3. Datasource configuration
4. **Database default** ← This is where `database` is used
5. System global default

**For semantic layers**:
- Return `None` for database
- Cache timeout will fall back to datasource-level or system default
- You can still set `cache_timeout` on your explorable directly

---

## 3. 🔐 Security & Access Control

**File**: `superset/security/manager.py` (multiple locations)

**Purpose**: Check if user has permission to access the underlying database

### 3a. Schema Access Check

```python
def can_access_schema(self, datasource: Explorable | BaseDatasource) -> bool:
    return (
        self.can_access_all_datasources()
        or (
            datasource.database
            and self.can_access_database(datasource.database)  # ← Database access check
        )
        or (
            hasattr(datasource, "catalog")
            and datasource.catalog
            and datasource.database
            and self.can_access_catalog(datasource.database, datasource.catalog)
        )
        or self.can_access("schema_access", datasource.schema_perm or "")
    )
```

**What this checks**:
- Does the user have permission to the database itself?
- Applies to SQL databases where schema is tied to database access
- If database is `None`, skips this check (relies on datasource-level perms)

### 3b. SQL Lab Query Security

```python
def raise_for_access(self, query=None, ...):
    if query and hasattr(query, "database"):
        database = query.database  # ← Get database to validate access

    if self.can_access_database(database):
        return  # User has database access, allow query
```

**What this does**:
- For SQL Lab queries, validates user can access the database
- Prevents users from querying databases they don't have permission to

**For semantic layers**:
- Return `None` for database
- Security relies on your explorable's `perm` and `schema_perm` attributes
- You'll handle authorization at the semantic layer level, not database level

---

## Summary: Do You Need It?

### ✅ You NEED `database` if:
- Your semantic layer wants to expose **time grain controls** in the UI
- You want to inherit **cache timeouts** from a database configuration
- Your semantic layer is a **thin wrapper over SQL databases** (similar to dbt)

### ❌ You DON'T need `database` if:
- Your semantic layer has its own time granularity logic
- You set `cache_timeout` directly on your explorable
- Your semantic layer handles its own authorization (not tied to SQL database perms)

---

## Recommendation for Your Semantic Layer

Based on typical semantic layer architectures, you should probably:

```python
@property
def database(self) -> None:
    """
    Return None - semantic layers handle time grains, caching,
    and security independently of SQL database objects.
    """
    return None
```

**Why None is fine**:

1. **Time Grains**: Your semantic layer likely has its own time dimension logic
   - You can expose time grains through your chart form data instead
   - Or implement a custom `get_time_grains()` method on your explorable

2. **Cache Timeout**: Set it directly on your explorable
   ```python
   @property
   def cache_timeout(self) -> int:
       return 3600  # 1 hour, or read from semantic layer config
   ```

3. **Security**: Your semantic layer has its own permission model
   - Use `perm` property: `f"semantic_layer:{view_name}"`
   - Use `schema_perm` if you have a schema concept
   - Database-level security doesn't apply

---

## Alternative: Provide a Minimal Database Proxy

If you DO want to support time grains but don't have a real SQL database:

```python
class SemanticLayerDatabaseProxy:
    """Minimal database-like object just for time grains."""

    def grains(self) -> tuple[TimeGrain, ...]:
        """Return semantic layer's time granularity options."""
        from superset.db_engine_specs.base import TimeGrain

        return (
            TimeGrain("Second", "toStartOfSecond({col})", "PT1S"),
            TimeGrain("Minute", "toStartOfMinute({col})", "PT1M"),
            TimeGrain("Hour", "toStartOfHour({col})", "PT1H"),
            TimeGrain("Day", "toStartOfDay({col})", "P1D"),
            # ... your semantic layer's supported grains
        )

    @property
    def cache_timeout(self) -> int:
        return 3600  # Fallback timeout

class YourSemanticLayerExplorable:
    @property
    def database(self) -> SemanticLayerDatabaseProxy:
        return SemanticLayerDatabaseProxy()
```

But this is **probably overkill** for most semantic layers. Returning `None` is cleaner.
