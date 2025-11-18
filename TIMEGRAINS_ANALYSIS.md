# Time Grains Analysis: Where Are They Used?

## TL;DR - You're Right! 🎯

**Yes, you could move time grain logic into `get_query_result()`** - but there's a reason it's separate. Let me explain:

---

## Current Architecture

### 1. **Separate API Endpoint for Time Grains**

Time grains are fetched via a **separate, lightweight API call** before the user even builds a query:

```
User opens Dashboard →
  Frontend requests timegrains (result_type: 'timegrains') →
    Backend calls _get_timegrains() →
      Returns list of available time grains →
        Frontend populates TimeGrain dropdown
```

This is **not part of query execution** - it's metadata discovery!

### 2. **Two Different Flows**

#### Flow A: Get Available Time Grains (Metadata)
```
POST /api/v1/chart/data
{
  "datasource": { "id": 123, "type": "table" },
  "queries": [{
    "result_type": "timegrains",  ← Just get the list
    "columns": [],
    "metrics": []
  }]
}

Response:
{
  "data": [
    { "name": "Second", "function": "DATE_TRUNC('second', {col})", "duration": "PT1S" },
    { "name": "Minute", "function": "DATE_TRUNC('minute', {col})", "duration": "PT1M" },
    { "name": "Hour", "function": "DATE_TRUNC('hour', {col})", "duration": "PT1H" },
    ...
  ]
}
```

#### Flow B: Execute Query with Time Grain (Actual Query)
```
POST /api/v1/chart/data
{
  "datasource": { "id": 123, "type": "table" },
  "queries": [{
    "result_type": "full",  ← Actually run the query
    "columns": ["country"],
    "metrics": ["count"],
    "extras": {
      "time_grain_sqla": "PT1H"  ← User selected "Hour" from dropdown
    }
  }]
}
```

---

## Why Separate?

### Reason 1: **Performance - Lightweight Metadata Request**

Getting time grains doesn't execute any query:
- No database round-trip
- No data processing
- Just returns a static list from `database.grains()`

If this was in `get_query_result()`, you'd need to:
1. Execute a dummy query just to get metadata
2. Or add complex logic to detect "metadata-only" requests

### Reason 2: **UI Needs Metadata Before Query**

The TimeGrain filter component needs the list of grains **before** the user can build a query:

```tsx
// Frontend flow:
1. User adds a TimeGrain filter to dashboard
2. Component calls buildQuery() with result_type: 'timegrains'
3. Gets back list of available grains
4. Populates dropdown: ["Second", "Minute", "Hour", "Day", ...]
5. User selects "Hour"
6. NOW the actual chart query runs with time_grain_sqla: "PT1H"
```

If time grains were in `get_query_result()`, you'd have a chicken-and-egg problem:
- Need to execute a query to get time grains
- But can't build the query without knowing available time grains!

### Reason 3: **Result Type Pattern**

Superset uses `result_type` for different kinds of data requests:

| Result Type | Purpose | Executes Query? |
|-------------|---------|-----------------|
| `timegrains` | Get available time granularities | ❌ No |
| `columns` | Get column metadata | ❌ No |
| `query` | Get SQL string (no execution) | ❌ No |
| `samples` | Get sample rows | ✅ Yes |
| `full` | Get complete results | ✅ Yes |
| `results` | Get results (no metadata) | ✅ Yes |

Time grains are **metadata**, not query results.

---

## Could You Move It to `get_query_result()`?

### Option 1: Special Case in `get_query_result()`

```python
def get_query_result(self, query_object: QueryObject) -> QueryResult:
    # Special case: if result_type is 'timegrains', return metadata
    if query_object.result_type == ChartDataResultType.TIMEGRAINS:
        grains = self.get_time_grains()  # Your semantic layer logic
        return QueryResult(
            df=pd.DataFrame(grains),  # Convert to DataFrame
            query="",
            duration=0,
            status=QueryStatus.SUCCESS
        )

    # Normal query execution
    return self._execute_query(query_object)
```

**Pros**:
- All logic in one place
- No need for `database` attribute

**Cons**:
- Mixes metadata retrieval with query execution
- `get_query_result()` now has two responsibilities
- Still need to return a DataFrame for metadata (awkward)

### Option 2: Add `get_time_grains()` to Explorable Protocol

```python
@runtime_checkable
class Explorable(Protocol):
    # ... existing methods ...

    def get_time_grains(self) -> list[dict[str, Any]]:
        """
        Return available time granularities for this explorable.

        :return: List of dicts with keys: name, function, duration
        """
```

Then `_get_timegrains()` becomes:

```python
def _get_timegrains(query_context, query_obj, _):
    datasource = _get_datasource(query_context, query_obj)

    # Try new protocol method first
    if hasattr(datasource, 'get_time_grains'):
        grains = datasource.get_time_grains()
    # Fallback to database.grains() for SQL datasources
    elif database := getattr(datasource, "database", None):
        grains = [
            {"name": g.name, "function": g.function, "duration": g.duration}
            for g in database.grains()
        ]
    else:
        grains = []

    return {"data": grains}
```

**Pros**:
- Clean separation of concerns
- Semantic layers can provide their own time grains
- No `database` dependency needed

**Cons**:
- Adds another method to the protocol

---

## My Recommendation

### **Option 2: Add `get_time_grains()` to Explorable**

This is the cleanest solution:

1. **Remove `database` from Explorable protocol**
2. **Add `get_time_grains()` instead**:

```python
@runtime_checkable
class Explorable(Protocol):
    # ... existing methods ...

    def get_time_grains(self) -> list[dict[str, Any]]:
        """
        Get available time granularities for temporal grouping.

        Returns a list of time grain options, each with:
        - name: Display name (e.g., "Hour", "Day", "Week")
        - function: How to apply the grain (implementation-specific)
        - duration: ISO 8601 duration string (e.g., "PT1H", "P1D")

        Return empty list if time grains are not supported.

        :return: List of time grain dictionaries
        """
```

3. **For SQL datasources**, delegate to database:
```python
class BaseDatasource:
    def get_time_grains(self) -> list[dict[str, Any]]:
        return [
            {"name": g.name, "function": g.function, "duration": g.duration}
            for g in self.database.grains()
        ]
```

4. **For semantic layers**, return your own:
```python
class SemanticLayerExplorable:
    def get_time_grains(self) -> list[dict[str, Any]]:
        return [
            {"name": "Hour", "function": "hour", "duration": "PT1H"},
            {"name": "Day", "function": "day", "duration": "P1D"},
            {"name": "Week", "function": "week", "duration": "P1W"},
            {"name": "Month", "function": "month", "duration": "P1M"},
        ]
```

---

## Why This is Better

### ✅ Cleaner Protocol
- `database` attribute was a leaky abstraction (SQL-specific)
- `get_time_grains()` is a clear contract for all explorables

### ✅ Semantic Layer Control
- Your semantic layer defines its own time dimensions
- No dependency on SQL database concepts

### ✅ Maintains Performance
- Still a separate, lightweight call
- No query execution needed
- UI gets metadata instantly

### ✅ Backward Compatible
- SQL datasources just delegate to `database.grains()`
- Existing code works unchanged

---

## Summary

**Your intuition was correct!** The `database` attribute is indeed a bit awkward. Here's what we should do:

1. ❌ Don't move time grains into `get_query_result()` (mixes metadata with execution)
2. ✅ Replace `database: Any | None` with `get_time_grains() -> list[dict]` in Explorable
3. ✅ Keep the separate `result_type: 'timegrains'` flow (it's actually elegant)
4. ✅ This gives semantic layers full control over their time dimensions

Want me to implement this change? It would involve:
- Removing `database` from Explorable protocol
- Adding `get_time_grains()` method
- Updating `_get_timegrains()` in query_actions.py
- Updating BaseDatasource to implement the new method
