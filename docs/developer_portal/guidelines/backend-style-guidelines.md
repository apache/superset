---
title: Overview
sidebar_position: 1
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

# Backend Style Guidelines

This is a list of statements that describe how we do backend development in Superset. While they might not be 100% true for all files in the repo, they represent the gold standard we strive towards for backend quality and style.

- We use a monolithic Python/Flask/Flask-AppBuilder backend, with small single-responsibility satellite services where necessary.
- Files are generally organized by feature or object type. Within each domain, we can have api controllers, models, schemas, commands, and data access objects (DAO).
  - See: [Proposal for Improving Superset's Python Code Organization](https://github.com/apache/superset/issues/9077)
- API controllers use Marshmallow Schemas to serialize/deserialize data.
- Authentication and authorization are controlled by the [security manager](https://github.com/apache/superset/blob/master/superset/security/manager).
- We use Pytest for unit and integration tests. These live in the `tests` directory.
- We add tests for every new piece of functionality added to the backend.
- We use pytest fixtures to share setup between tests.
- We use SQLAlchemy to access both Superset's application database, and users' analytics databases.
- We make changes backwards compatible whenever possible.
  - If a change cannot be made backwards compatible, it goes into a major release.
  - See: [Proposal For Semantic Versioning](https://github.com/apache/superset/issues/12566)
- We use Swagger for API documentation, with docs written inline on the API endpoint code.
- We prefer thin ORM models, putting shared functionality in other utilities.
- Several linters/checkers are used to maintain consistent code style and type safety: pylint, mypy, black, isort.
- `__init__.py` files are kept empty to avoid implicit dependencies.

## Code Organization

### Domain-Driven Structure

Organize code by business domain rather than technical layers:

```
superset/
├── dashboards/
│   ├── api.py          # API endpoints
│   ├── commands/       # Business logic
│   ├── dao.py          # Data access layer
│   ├── models.py       # Database models
│   └── schemas.py      # Serialization schemas
├── charts/
│   ├── api.py
│   ├── commands/
│   ├── dao.py
│   ├── models.py
│   └── schemas.py
```

### API Controllers

Use Flask-AppBuilder with Marshmallow schemas:

```python
from flask_appbuilder.api import BaseApi
from marshmallow import Schema, fields

class DashboardSchema(Schema):
    id = fields.Integer()
    dashboard_title = fields.String(required=True)
    created_on = fields.DateTime(dump_only=True)

class DashboardApi(BaseApi):
    resource_name = "dashboard"
    openapi_spec_tag = "Dashboards"

    @expose("/", methods=["GET"])
    @protect()
    @safe
    def get_list(self) -> Response:
        """Get a list of dashboards"""
        # Implementation
```

### Commands Pattern

Use commands for business logic:

```python
from typing import Optional
from superset.commands.base import BaseCommand
from superset.dashboards.dao import DashboardDAO

class CreateDashboardCommand(BaseCommand):
    def __init__(self, properties: Dict[str, Any]):
        self._properties = properties

    def run(self) -> Dashboard:
        self.validate()
        return DashboardDAO.create(self._properties)

    def validate(self) -> None:
        if not self._properties.get("dashboard_title"):
            raise ValidationError("Title is required")
```

### Data Access Objects (DAOs)

See: [DAO Style Guidelines and Best Practices](./backend/dao-style-guidelines)

## Testing

### Unit Tests

```python
import pytest
from unittest.mock import patch
from superset.dashboards.commands.create import CreateDashboardCommand

def test_create_dashboard_success():
    properties = {
        "dashboard_title": "Test Dashboard",
        "owners": [1]
    }

    command = CreateDashboardCommand(properties)
    dashboard = command.run()

    assert dashboard.dashboard_title == "Test Dashboard"

def test_create_dashboard_validation_error():
    properties = {}  # Missing required title

    command = CreateDashboardCommand(properties)

    with pytest.raises(ValidationError):
        command.run()
```

### Integration Tests

```python
import pytest
from superset.app import create_app
from superset.extensions import db

@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

def test_dashboard_api_create(app, auth_headers):
    with app.test_client() as client:
        response = client.post(
            "/api/v1/dashboard/",
            json={"dashboard_title": "Test Dashboard"},
            headers=auth_headers
        )
        assert response.status_code == 201
```

## Security

### Authorization Decorators

```python
from flask_appbuilder.security.decorators import has_access

class DashboardApi(BaseApi):
    @expose("/", methods=["POST"])
    @protect()
    @has_access("can_write", "Dashboard")
    def post(self) -> Response:
        """Create a new dashboard"""
        # Implementation
```

### Input Validation

```python
from marshmallow import Schema, fields, validate

class DashboardSchema(Schema):
    dashboard_title = fields.String(
        required=True,
        validate=validate.Length(min=1, max=500)
    )
    slug = fields.String(
        validate=validate.Regexp(r'^[a-z0-9-]+$')
    )
```

## Database Operations

### Use SQLAlchemy ORM

```python
from sqlalchemy import Column, Integer, String, Text
from superset.models.helpers import AuditMixinNullable

class Dashboard(Model, AuditMixinNullable):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True)
    dashboard_title = Column(String(500))
    position_json = Column(Text)

    def __repr__(self) -> str:
        return f"<Dashboard {self.dashboard_title}>"
```

### Database Migrations

```python
# migration file
def upgrade():
    op.add_column(
        "dashboards",
        sa.Column("new_column", sa.String(255), nullable=True)
    )

def downgrade():
    op.drop_column("dashboards", "new_column")
```

## Error Handling

### Custom Exceptions

```python
class SupersetException(Exception):
    """Base exception for Superset"""
    pass

class ValidationError(SupersetException):
    """Raised when validation fails"""
    pass

class SecurityException(SupersetException):
    """Raised when security check fails"""
    pass
```

### Error Responses

```python
from flask import jsonify
from werkzeug.exceptions import BadRequest

@app.errorhandler(ValidationError)
def handle_validation_error(error):
    return jsonify({
        "message": str(error),
        "error_type": "VALIDATION_ERROR"
    }), 400
```

## Type Hints and Documentation

### Use Type Hints

```python
from typing import List, Optional, Dict, Any
from superset.models.dashboard import Dashboard

def get_dashboards_by_owner(owner_id: int) -> List[Dashboard]:
    """Get all dashboards owned by a specific user"""
    return db.session.query(Dashboard).filter_by(owner_id=owner_id).all()

def create_dashboard(properties: Dict[str, Any]) -> Optional[Dashboard]:
    """Create a new dashboard with the given properties"""
    # Implementation
```

### API Documentation

```python
from flask_appbuilder.api import BaseApi
from flask_appbuilder.api.schemas import get_list_schema

class DashboardApi(BaseApi):
    @expose("/", methods=["GET"])
    @protect()
    @safe
    def get_list(self) -> Response:
        """Get a list of dashboards
        ---
        get:
          description: >-
            Get a list of dashboards
          parameters:
          - in: query
            schema:
              type: integer
            name: page_size
            description: Number of results per page
          responses:
            200:
              description: Success
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/DashboardListResponse'
        """
        # Implementation
```
