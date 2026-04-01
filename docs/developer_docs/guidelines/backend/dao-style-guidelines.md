---
title: DAO Style Guidelines and Best Practices
sidebar_position: 2
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# DAO Style Guidelines and Best Practices

A Data Access Object (DAO) is a pattern that provides an abstract interface to the SQLAlchemy Object Relational Mapper (ORM). The DAOs are critical as they form the building block of the application which are wrapped by the associated commands and RESTful API endpoints.

There are numerous inconsistencies and violations of the DRY principal within the codebase as it relates to DAOs and ORMs—unnecessary commits, non-ACID transactions, etc.—which makes the code unnecessarily complex and convoluted. Addressing the underlying issues with the DAOs _should_ help simplify the downstream operations and improve the developer experience.

To ensure consistency the following rules should be adhered to:

## Core Rules

1. **All database operations (including testing) should be defined within a DAO**, i.e., there should not be any explicit `db.session.add`, `db.session.merge`, etc. calls outside of a DAO.

2. **A DAO should use `create`, `update`, `delete`, `upsert` terms**—typical database operations which ensure consistency with commands—rather than action based terms like `save`, `saveas`, `override`, etc.

3. **Sessions should be managed via a [context manager](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#begin-once)** which auto-commits on success and rolls back on failure, i.e., there should be no explicit `db.session.commit` or `db.session.rollback` calls within the DAO.

4. **There should be a single atomic transaction representing the entirety of the operation**, i.e., when creating a dataset with associated columns and metrics either all the changes succeed when the transaction is committed, or all the changes are undone when the transaction is rolled back. SQLAlchemy supports [nested transactions](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#nested-transaction) via the `begin_nested` method which can be nested—inline with how DAOs are invoked.

5. **The database layer should adopt a "shift left" mentality** i.e., uniqueness/foreign key constraints, relationships, cascades, etc. should all be defined in the database layer rather than being enforced in the application layer.

6. **Exception-based validation**: Ask for forgiveness rather than permission. Try to perform the operation and rely on database constraints to verify that the model is acceptable, rather than pre-validating conditions.

7. **Bulk operations**: Provide bulk `create`, `update`, and `delete` methods where applicable for performance optimization.

8. **Sparse updates**: Updates should only modify explicitly defined attributes.

9. **Test transactions**: Tests should leverage nested transactions which should be rolled back on teardown, rather than deleting objects.

## DAO Implementation Examples

### Basic DAO Structure

```python
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from superset.extensions import db
from superset.models.dashboard import Dashboard

class DashboardDAO:
    """Data Access Object for Dashboard operations"""

    @classmethod
    def find_by_id(cls, dashboard_id: int) -> Optional[Dashboard]:
        """Find dashboard by ID"""
        return db.session.query(Dashboard).filter_by(id=dashboard_id).first()

    @classmethod
    def find_by_ids(cls, dashboard_ids: List[int]) -> List[Dashboard]:
        """Find dashboards by list of IDs"""
        return db.session.query(Dashboard).filter(
            Dashboard.id.in_(dashboard_ids)
        ).all()

    @classmethod
    def create(cls, properties: Dict[str, Any]) -> Dashboard:
        """Create a new dashboard"""
        with db.session.begin():
            dashboard = Dashboard(**properties)
            db.session.add(dashboard)
            db.session.flush()  # Get the ID
            return dashboard

    @classmethod
    def update(cls, dashboard: Dashboard, properties: Dict[str, Any]) -> Dashboard:
        """Update an existing dashboard"""
        with db.session.begin():
            for key, value in properties.items():
                setattr(dashboard, key, value)
            return dashboard

    @classmethod
    def delete(cls, dashboard: Dashboard) -> None:
        """Delete a dashboard"""
        with db.session.begin():
            db.session.delete(dashboard)
```

### Complex DAO Operations

```python
class DatasetDAO:
    """Data Access Object for Dataset operations"""

    @classmethod
    def create_with_columns_and_metrics(
        cls,
        dataset_properties: Dict[str, Any],
        columns: List[Dict[str, Any]],
        metrics: List[Dict[str, Any]]
    ) -> Dataset:
        """Create dataset with associated columns and metrics atomically"""
        with db.session.begin():
            # Create the dataset
            dataset = Dataset(**dataset_properties)
            db.session.add(dataset)
            db.session.flush()  # Get the dataset ID

            # Create columns
            for column_props in columns:
                column_props['dataset_id'] = dataset.id
                column = TableColumn(**column_props)
                db.session.add(column)

            # Create metrics
            for metric_props in metrics:
                metric_props['dataset_id'] = dataset.id
                metric = SqlMetric(**metric_props)
                db.session.add(metric)

            return dataset

    @classmethod
    def bulk_delete(cls, dataset_ids: List[int]) -> int:
        """Delete multiple datasets and return count"""
        with db.session.begin():
            count = db.session.query(Dataset).filter(
                Dataset.id.in_(dataset_ids)
            ).delete(synchronize_session=False)
            return count
```

### Query Methods

```python
class DashboardDAO:
    @classmethod
    def find_by_slug(cls, slug: str) -> Optional[Dashboard]:
        """Find dashboard by slug"""
        return db.session.query(Dashboard).filter_by(slug=slug).first()

    @classmethod
    def find_by_owner(cls, owner_id: int) -> List[Dashboard]:
        """Find all dashboards owned by a user"""
        return db.session.query(Dashboard).filter_by(
            created_by_fk=owner_id
        ).all()

    @classmethod
    def search(
        cls,
        query: str,
        page: int = 0,
        page_size: int = 25
    ) -> Tuple[List[Dashboard], int]:
        """Search dashboards with pagination"""
        base_query = db.session.query(Dashboard).filter(
            Dashboard.dashboard_title.ilike(f"%{query}%")
        )

        total_count = base_query.count()
        dashboards = base_query.offset(page * page_size).limit(page_size).all()

        return dashboards, total_count
```

### Error Handling in DAOs

```python
from sqlalchemy.exc import IntegrityError
from superset.exceptions import DAOCreateFailedError, DAODeleteFailedError

class DashboardDAO:
    @classmethod
    def create(cls, properties: Dict[str, Any]) -> Dashboard:
        """Create a new dashboard with error handling"""
        try:
            with db.session.begin():
                dashboard = Dashboard(**properties)
                db.session.add(dashboard)
                db.session.flush()
                return dashboard
        except IntegrityError as ex:
            raise DAOCreateFailedError(str(ex)) from ex

    @classmethod
    def delete(cls, dashboard: Dashboard) -> None:
        """Delete a dashboard with error handling"""
        try:
            with db.session.begin():
                db.session.delete(dashboard)
        except IntegrityError as ex:
            raise DAODeleteFailedError(
                f"Cannot delete dashboard {dashboard.id}: {str(ex)}"
            ) from ex
```

## Best Practices

### 1. Use Class Methods

All DAO methods should be class methods (`@classmethod`) rather than instance methods:

```python
# ✅ Good
class DashboardDAO:
    @classmethod
    def find_by_id(cls, dashboard_id: int) -> Optional[Dashboard]:
        return db.session.query(Dashboard).filter_by(id=dashboard_id).first()

# ❌ Avoid
class DashboardDAO:
    def find_by_id(self, dashboard_id: int) -> Optional[Dashboard]:
        return db.session.query(Dashboard).filter_by(id=dashboard_id).first()
```

### 2. Use Context Managers for Transactions

Always use context managers to ensure proper transaction handling:

```python
# ✅ Good - automatic commit/rollback
@classmethod
def create(cls, properties: Dict[str, Any]) -> Dashboard:
    with db.session.begin():
        dashboard = Dashboard(**properties)
        db.session.add(dashboard)
        return dashboard

# ❌ Avoid - manual commit/rollback
@classmethod
def create(cls, properties: Dict[str, Any]) -> Dashboard:
    try:
        dashboard = Dashboard(**properties)
        db.session.add(dashboard)
        db.session.commit()
        return dashboard
    except Exception:
        db.session.rollback()
        raise
```

### 3. Use Descriptive Method Names

Method names should clearly indicate the operation:

```python
# ✅ Good - clear CRUD operations
create()
update()
delete()
find_by_id()
find_by_slug()

# ❌ Avoid - ambiguous names
save()
remove()
get()
```

### 4. Type Hints

Always include type hints for parameters and return values:

```python
@classmethod
def find_by_ids(cls, dashboard_ids: List[int]) -> List[Dashboard]:
    """Find dashboards by list of IDs"""
    return db.session.query(Dashboard).filter(
        Dashboard.id.in_(dashboard_ids)
    ).all()
```

### 5. Batch Operations

Provide efficient batch operations when needed:

```python
@classmethod
def bulk_update_published_status(
    cls,
    dashboard_ids: List[int],
    published: bool
) -> int:
    """Update published status for multiple dashboards"""
    with db.session.begin():
        count = db.session.query(Dashboard).filter(
            Dashboard.id.in_(dashboard_ids)
        ).update(
            {Dashboard.published: published},
            synchronize_session=False
        )
        return count
```

## Testing DAOs

### Unit Tests for DAOs

```python
import pytest
from superset.dashboards.dao import DashboardDAO
from superset.models.dashboard import Dashboard

def test_dashboard_create(session):
    """Test creating a dashboard"""
    properties = {
        "dashboard_title": "Test Dashboard",
        "slug": "test-dashboard"
    }

    dashboard = DashboardDAO.create(properties)

    assert dashboard.id is not None
    assert dashboard.dashboard_title == "Test Dashboard"
    assert dashboard.slug == "test-dashboard"

def test_dashboard_find_by_slug(session):
    """Test finding dashboard by slug"""
    # Create test data
    dashboard = Dashboard(
        dashboard_title="Test Dashboard",
        slug="test-dashboard"
    )
    session.add(dashboard)
    session.commit()

    # Test the DAO method
    found_dashboard = DashboardDAO.find_by_slug("test-dashboard")

    assert found_dashboard is not None
    assert found_dashboard.dashboard_title == "Test Dashboard"

def test_dashboard_delete(session):
    """Test deleting a dashboard"""
    dashboard = Dashboard(dashboard_title="Test Dashboard")
    session.add(dashboard)
    session.commit()
    dashboard_id = dashboard.id

    DashboardDAO.delete(dashboard)

    deleted_dashboard = DashboardDAO.find_by_id(dashboard_id)
    assert deleted_dashboard is None
```

### Integration Tests

```python
def test_create_dataset_with_columns_atomic(app_context):
    """Test that creating dataset with columns is atomic"""
    dataset_properties = {"table_name": "test_table"}
    columns = [{"column_name": "col1"}, {"column_name": "col2"}]

    # This should succeed completely or fail completely
    dataset = DatasetDAO.create_with_columns_and_metrics(
        dataset_properties, columns, []
    )

    assert dataset.id is not None
    assert len(dataset.columns) == 2
```
