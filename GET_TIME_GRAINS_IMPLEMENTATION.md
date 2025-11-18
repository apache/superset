# get_time_grains() Implementation Complete ✅

## Summary

Successfully replaced the `database` attribute approach with a cleaner `get_time_grains()` method on the `Explorable` protocol!

---

## Changes Made

### 1. **Added `get_time_grains()` to Explorable Protocol**
**File**: `superset/explorables/base.py`

```python
def get_time_grains(self) -> list[dict[str, Any]]:
    """
    Get available time granularities for temporal grouping.

    Returns a list of time grain options. Each dict contains:
    - name: Display name (e.g., "Hour", "Day", "Week")
    - function: How to apply the grain (implementation-specific)
    - duration: ISO 8601 duration (e.g., "PT1H", "P1D")

    Return empty list if not supported.
    """
```

**Benefits**:
- ✅ Clearer contract - explicit method vs. implicit attribute
- ✅ No SQL leakage - semantic layers define their own grains
- ✅ Better documentation with examples

### 2. **Updated `_get_timegrains()` Query Action**
**File**: `superset/common/query_actions.py`

**Before** (accessing database):
```python
def _get_timegrains(...):
    datasource = _get_datasource(query_context, query_obj)
    database = getattr(datasource, "database", None)
    grains = database.grains() if database else []
    return {
        "data": [
            {
                "name": grain.name,
                "function": grain.function,
                "duration": grain.duration,
            }
            for grain in grains
        ]
    }
```

**After** (using protocol method):
```python
def _get_timegrains(...):
    datasource = _get_datasource(query_context, query_obj)
    grains = datasource.get_time_grains()
    return {"data": grains}
```

**Benefits**:
- ✅ Simpler - just call the method
- ✅ No getattr() defensive coding
- ✅ Explorable handles the formatting

### 3. **Implemented in BaseDatasource**
**File**: `superset/connectors/sqla/models.py`

```python
def get_time_grains(self) -> list[dict[str, Any]]:
    """Delegate to database's time grain definitions."""
    return [
        {
            "name": grain.name,
            "function": grain.function,
            "duration": grain.duration,
        }
        for grain in (self.database.grains() or [])
    ]
```

**Benefits**:
- ✅ SQL datasources work unchanged
- ✅ Encapsulates database access
- ✅ Returns consistent format

---

## For Your Semantic Layer

Now you can define your own time grains without any SQL database dependency:

```python
class SemanticLayerExplorable:
    """Your semantic layer implementation."""

    def get_time_grains(self) -> list[dict[str, Any]]:
        """
        Return semantic layer's time dimensions.

        The 'function' can be whatever your semantic layer understands.
        It doesn't have to be SQL!
        """
        return [
            {
                "name": "Hour",
                "function": "hour",  # Your semantic layer's time grain ID
                "duration": "PT1H",
            },
            {
                "name": "Day",
                "function": "day",
                "duration": "P1D",
            },
            {
                "name": "Week",
                "function": "week",
                "duration": "P1W",
            },
            {
                "name": "Month",
                "function": "month",
                "duration": "P1M",
            },
            {
                "name": "Quarter",
                "function": "quarter",
                "duration": "P3M",
            },
            {
                "name": "Year",
                "function": "year",
                "duration": "P1Y",
            },
        ]

    # Still need these from before:
    @property
    def is_rls_supported(self) -> bool:
        return False

    @property
    def database(self) -> None:
        return None  # Still needed for cache timeout fallback & security

    @property
    def query_language(self) -> str | None:
        return "graphql"  # Or whatever your semantic layer uses
```

---

## How It Works

### Frontend Request Flow

1. **User opens dashboard with TimeGrain filter**
   ```
   Dashboard loads → TimeGrainFilterPlugin mounts
   ```

2. **Filter requests available grains**
   ```typescript
   // superset-frontend/src/filters/components/TimeGrain/buildQuery.ts
   buildQueryContext(formData, () => [
     {
       result_type: 'timegrains',  // Metadata request
       columns: [],
       metrics: [],
     },
   ])
   ```

3. **Backend processes request**
   ```python
   # superset/common/query_actions.py
   def _get_timegrains(query_context, query_obj, _):
       datasource = _get_datasource(query_context, query_obj)
       grains = datasource.get_time_grains()  # Your method!
       return {"data": grains}
   ```

4. **Frontend receives grains**
   ```json
   {
     "data": [
       {"name": "Hour", "function": "hour", "duration": "PT1H"},
       {"name": "Day", "function": "day", "duration": "P1D"},
       ...
     ]
   }
   ```

5. **UI populates dropdown**
   ```tsx
   <Select options={data.map(grain => grain.name)} />
   // Shows: ["Hour", "Day", "Week", "Month", ...]
   ```

6. **User selects grain**
   ```
   User clicks "Day" →
     extraFormData.time_grain_sqla = "P1D" →
       Sent with actual chart query
   ```

7. **Your semantic layer receives it**
   ```python
   def get_query_result(self, query_object: QueryObject):
       time_grain = query_object.extras.get("time_grain_sqla")
       # time_grain = "P1D" (the duration you returned)
       # Use it to group your data by day
       ...
   ```

---

## Key Differences from Before

| Aspect | Before (database attribute) | After (get_time_grains method) |
|--------|---------------------------|--------------------------------|
| **Protocol** | `@property database: Any \| None` | `def get_time_grains() -> list[dict]` |
| **SQL Coupling** | Tight - requires Database object | Loose - any explorable can provide |
| **Semantic Layer** | Must return `None` | Returns own time dimensions |
| **Type Safety** | `Any \| None` (vague) | `list[dict[str, Any]]` (clear) |
| **Documentation** | Implicit usage | Explicit with examples |
| **Flexibility** | SQL-specific | Implementation-agnostic |

---

## What About `database` Property?

We **kept** the `database` property because it's still used for:

1. **Cache Timeout Fallback** (`query_context.py:108`)
   - Priority: query → chart → datasource → **database** → system default
   - Your semantic layer can return `None` and rely on other levels

2. **Security/Schema Access** (`security/manager.py:556-563`)
   - Checks if user has database-level permissions
   - Your semantic layer returns `None` and uses `perm`/`schema_perm` instead

3. **Database-Specific Metadata** (various places)
   - SQL datasources use it for engine-specific features
   - Your semantic layer doesn't need it

**Updated documentation** to clarify that time grains are now handled separately.

---

## Testing

### ✅ Type Checking Passed
```bash
$ pre-commit run mypy --files superset/explorables/base.py \
    superset/common/query_actions.py superset/connectors/sqla/models.py

mypy...............................................................Passed
```

### 🧪 Recommended Manual Tests

1. **SQL Datasource** (existing functionality)
   ```
   - Create chart with SQL table
   - Add TimeGrain filter to dashboard
   - Verify grains appear: "Second", "Minute", "Hour", "Day", etc.
   - Select grain and verify chart groups correctly
   ```

2. **Your Semantic Layer**
   ```
   - Create chart with your semantic layer
   - Add TimeGrain filter
   - Verify YOUR grains appear (the ones you return)
   - Select grain and verify your layer handles it
   ```

3. **No Time Grains**
   ```python
   def get_time_grains(self) -> list[dict[str, Any]]:
       return []  # No time grains supported
   ```
   - Verify UI shows "No data" in dropdown
   - Chart still works without time grain

---

## Migration Guide for Other Semantic Layers

If you're building a semantic layer on top of Superset:

### Before
```python
class MySemanticLayer:
    @property
    def database(self) -> None:
        return None  # Can't provide time grains
```

### After
```python
class MySemanticLayer:
    def get_time_grains(self) -> list[dict[str, Any]]:
        """Define your own time dimensions!"""
        return [
            {"name": "Hour", "function": "hour_grain", "duration": "PT1H"},
            {"name": "Day", "function": "day_grain", "duration": "P1D"},
            # ... your semantic layer's supported granularities
        ]

    @property
    def database(self) -> None:
        return None  # Still needed for other features
```

---

## Summary

This change makes Superset's `Explorable` protocol **truly database-agnostic** for time grains:

- ✅ **SQL datasources**: Delegate to `database.grains()` (no change in behavior)
- ✅ **Semantic layers**: Define their own time dimensions independently
- ✅ **Type safety**: Clear method signature vs. vague `Any | None`
- ✅ **Documentation**: Explicit contract with examples
- ✅ **Backward compatible**: All existing code works unchanged

Your semantic layer can now provide time grain controls without any SQL database dependency! 🎉
