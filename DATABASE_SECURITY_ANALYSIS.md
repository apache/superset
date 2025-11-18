# Database-Level Security Analysis

## TL;DR

The `database` attribute is used for **two SQL-specific security patterns**:

1. **Schema Access Check** (`can_access_schema`) - "If user can access the database, grant schema access"
2. **Implicit Datasource Access** (`get_user_datasources`) - "If user can access database, grant all tables in it"

Both are **SQL-only concepts** that don't apply to semantic layers.

---

## Usage #1: Schema Access Check

### Location
`superset/security/manager.py:544-567` - `can_access_schema()`

### What It Does
```python
def can_access_schema(self, datasource: BaseDatasource | Explorable) -> bool:
    """Can user access the schema for this datasource?"""

    database = getattr(datasource, "database", None)
    return (
        self.can_access_all_datasources()  # Admin/superuser
        or (
            database
            and self.can_access_database(database)  # ← DATABASE-LEVEL ACCESS
        )
        or (
            hasattr(datasource, "catalog")
            and datasource.catalog
            and database
            and self.can_access_catalog(database, datasource.catalog)  # ← CATALOG ACCESS
        )
        or self.can_access("schema_access", datasource.schema_perm or "")  # ← SCHEMA PERM
    )
```

### The Logic (SQL Permission Hierarchy)

Superset has a **permission hierarchy** for SQL datasources:

```
┌─────────────────────────────────────────┐
│ 1. All Datasource Access (Admin)       │ ← Superuser override
└─────────────────────────────────────────┘
              ↓ OR
┌─────────────────────────────────────────┐
│ 2. Database Access                      │ ← database = getattr(...)
│    Permission: [database].[database]    │    can_access_database(database)
│    Grants: All schemas in this database │
└─────────────────────────────────────────┘
              ↓ OR
┌─────────────────────────────────────────┐
│ 3. Catalog Access                       │ ← catalog-level permission
│    Permission: [database].[catalog]     │
│    Grants: All schemas in this catalog  │
└─────────────────────────────────────────┘
              ↓ OR
┌─────────────────────────────────────────┐
│ 4. Schema Access                        │ ← schema_perm
│    Permission: [database].[schema]      │    (from datasource.schema_perm)
│    Grants: This specific schema         │
└─────────────────────────────────────────┘
```

### Why Database Access Matters

**Example Scenario**:
```sql
-- Database: analytics_prod
-- Schema: sales
-- Table: orders

User has permission: [analytics_prod].[analytics_prod]
```

**Without database check**:
- User must get explicit permission to `[analytics_prod].[sales]` schema
- Need separate permission for `[analytics_prod].[marketing]` schema
- Tedious for large databases with many schemas

**With database check**:
- User has `database_access` to `analytics_prod`
- Automatically grants access to ALL schemas: sales, marketing, finance, etc.
- One permission → Many schemas (convenience)

### Where It's Called

`raise_for_access()` line 2443:
```python
def raise_for_access(self, datasource=None, query_context=None, ...):
    if query_context:
        datasource = query_context.datasource  # ← Could be Explorable!

    if not (
        self.can_access_schema(datasource)  # ← Checks database access
        or self.can_access("datasource_access", datasource.perm)
        or self.is_owner(datasource)
        or ...  # other checks
    ):
        raise SupersetSecurityException(...)
```

---

## Usage #2: Implicit Datasource Access

### Location
`superset/security/manager.py:804-833` - `get_user_datasources()`

### What It Does
```python
def get_user_datasources(self) -> list[BaseDatasource]:
    """Get all datasources the user can access."""

    user_datasources = set()

    # Step 1: Add datasources with explicit permission
    user_datasources.update(
        self.session.query(SqlaTable)
        .filter(get_dataset_access_filters(SqlaTable))  # ← Explicit perms
        .all()
    )

    # Step 2: Group all datasources by database
    all_datasources = SqlaTable.get_all_datasources()
    datasources_by_database: dict[Database, set[SqlaTable]] = defaultdict(set)
    for datasource in all_datasources:
        datasources_by_database[datasource.database].add(datasource)  # ← NEEDS database!

    # Step 3: Add datasources from databases user can access
    for database, datasources in datasources_by_database.items():
        if self.can_access_database(database):  # ← DATABASE-LEVEL ACCESS
            user_datasources.update(datasources)  # ← Grant ALL tables in database

    return list(user_datasources)
```

### The Logic (Implicit Permissions)

**Explicit Permission**:
```
User → Permission: [analytics_prod].[sales].[orders]
     → Can access: orders table only
```

**Implicit Permission (via database access)**:
```
User → Permission: [analytics_prod].[analytics_prod]
     → Can access: ALL tables in analytics_prod
       - sales.orders
       - sales.customers
       - marketing.campaigns
       - finance.transactions
       - ... (all tables in all schemas)
```

### Why This Matters

**Example Scenario**:
```
Database: analytics_prod (500 tables across 20 schemas)

Option A: Explicit permissions (without database check)
  - Admin must grant 500 individual table permissions
  - New table added → Must manually grant permission
  - Tedious and error-prone

Option B: Database-level permission (with database check)
  - Admin grants ONE database permission
  - User gets all 500 tables automatically
  - New table added → Automatically accessible
  - Much easier to manage
```

### Where It's Used

This method is called when populating datasource dropdowns, chart creation, etc. It determines which datasources appear in the UI for the user.

---

## Does This Apply to Semantic Layers?

### Short Answer: **NO**

Semantic layers don't have the SQL database → schema → table hierarchy:

```
SQL World:
  Database (analytics_prod)
    ├─ Schema (sales)
    │   ├─ Table (orders)
    │   └─ Table (customers)
    └─ Schema (marketing)
        └─ Table (campaigns)

Semantic Layer World:
  Semantic Layer (cube_cloud)
    ├─ View (sales_metrics)      ← No database/schema concept
    ├─ View (customer_360)
    └─ View (marketing_funnel)
```

**Semantic layer permissions**:
- Based on view/model names
- Or based on semantic layer roles
- Or based on data attributes (e.g., region, department)
- **NOT** based on database connections

---

## Current Implementation with `getattr`

```python
database = getattr(datasource, "database", None)
return (
    self.can_access_all_datasources()
    or (
        database  # ← None for semantic layers
        and self.can_access_database(database)
    )
    or self.can_access("schema_access", datasource.schema_perm or "")
)
```

### What Happens for Semantic Layers

```
1. database = getattr(datasource, "database", None)
   → database = None  (semantic layer doesn't have database)

2. Check: database and self.can_access_database(database)
   → None and ...
   → False  (short-circuits, database check skipped)

3. Falls through to: self.can_access("schema_access", datasource.schema_perm)
   → Uses datasource.schema_perm instead
```

**Result**: Semantic layers skip database checks and use their own `schema_perm` property.

---

## Alternative Approaches

### Option 1: Keep `getattr` (Current)

**Pros**:
- ✅ Works today
- ✅ No breaking changes
- ✅ Simple

**Cons**:
- ❌ Not type-safe (relies on runtime attribute check)
- ❌ Not explicit in protocol

### Option 2: Add `database` Back to Explorable (As Optional)

```python
@runtime_checkable
class Explorable(Protocol):
    @property
    def database(self) -> Any | None:
        """Database object (None for non-SQL explorables)."""
```

**Pros**:
- ✅ Type-safe
- ✅ Explicit in protocol

**Cons**:
- ❌ Semantic layers must implement it (return None)
- ❌ Leaky SQL abstraction back in protocol

### Option 3: Type Narrowing with `isinstance`

```python
def can_access_schema(self, datasource: BaseDatasource | Explorable) -> bool:
    # Type narrow for SQL datasources
    if isinstance(datasource, BaseDatasource):
        if self.can_access_database(datasource.database):
            return True

    # All explorables check schema_perm
    return (
        self.can_access_all_datasources()
        or self.can_access("schema_access", datasource.schema_perm or "")
    )
```

**Pros**:
- ✅ Type-safe (mypy understands isinstance)
- ✅ Explicit about SQL vs non-SQL
- ✅ No leaky abstraction in protocol

**Cons**:
- ❌ Couples security code to BaseDatasource class
- ❌ Every new SQL datasource type needs updating

### Option 4: New Protocol Method `can_grant_database_access()`

```python
@runtime_checkable
class Explorable(Protocol):
    def can_grant_database_access(self, security_manager) -> bool:
        """
        Whether database-level access should grant access to this explorable.

        SQL datasources return: security_manager.can_access_database(self.database)
        Semantic layers return: False
        """
```

Then in security manager:
```python
def can_access_schema(self, datasource: Explorable) -> bool:
    return (
        self.can_access_all_datasources()
        or datasource.can_grant_database_access(self)  # ← Explorable decides
        or self.can_access("schema_access", datasource.schema_perm or "")
    )
```

**Pros**:
- ✅ Clean protocol
- ✅ Each explorable decides its own logic
- ✅ Type-safe
- ✅ Extensible (new datasource types control their behavior)

**Cons**:
- ❌ Couples Explorable to security manager (dependency inversion)
- ❌ More complex

### Option 5: Make Security Check Explorable-Specific

```python
@runtime_checkable
class Explorable(Protocol):
    def has_schema_access(self, user) -> bool:
        """
        Whether the given user has schema-level access to this explorable.

        Implementations decide their own logic:
        - SQL: Check database/catalog/schema perms
        - Semantic: Check semantic layer roles
        """
```

**Pros**:
- ✅ Full control per explorable type
- ✅ Clean separation
- ✅ Each layer handles its own security model

**Cons**:
- ❌ Moves security logic into datasource (separation of concerns)
- ❌ Security manager loses centralized control

---

## My Recommendation

### **Option 3: Type Narrowing with `isinstance`**

This is the cleanest approach that doesn't pollute the protocol:

```python
def can_access_schema(self, datasource: BaseDatasource | Explorable) -> bool:
    """
    Check if user can access the schema for this datasource.

    For SQL datasources: Checks database → catalog → schema hierarchy
    For other explorables: Checks schema_perm only
    """
    # SQL-specific hierarchy checks
    if isinstance(datasource, BaseDatasource):
        if self.can_access_database(datasource.database):
            return True
        if hasattr(datasource, "catalog") and datasource.catalog:
            if self.can_access_catalog(datasource.database, datasource.catalog):
                return True

    # Universal checks (all explorables)
    return (
        self.can_access_all_datasources()
        or self.can_access("schema_access", datasource.schema_perm or "")
    )
```

**Why this is better**:
1. ✅ **Type-safe** - No `getattr`, mypy understands it
2. ✅ **Explicit** - Clear that database checks are SQL-only
3. ✅ **No protocol pollution** - Explorable stays clean
4. ✅ **Maintainable** - New SQL types inherit from BaseDatasource
5. ✅ **Semantic layers "just work"** - No special handling needed

**For `get_user_datasources()`**:
```python
def get_user_datasources(self) -> list[BaseDatasource]:
    """This method is SQL-specific anyway (SqlaTable.get_all_datasources())"""
    # Keep as-is, it's already SQL-specific
```

---

## Summary

### What `database` is Used For:
1. **can_access_schema()** - Grant schema access to users with database-level permissions
2. **get_user_datasources()** - Grant table access to users with database-level permissions

### Why It Exists:
- **Convenience**: One permission → Many resources
- **SQL Hierarchy**: Database → Schema → Table permission model
- **Implicit Grants**: Database access implies schema/table access

### Why Semantic Layers Don't Need It:
- No database/schema/table hierarchy
- Different permission model (views, roles, attributes)
- Use `perm` and `schema_perm` directly

### Recommended Fix:
**Use `isinstance(datasource, BaseDatasource)` instead of `getattr(datasource, "database", None)`**

This makes the SQL-specific logic explicit and keeps the Explorable protocol clean.

Want me to implement this change?
