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

# apache-superset-core

[![PyPI version](https://badge.fury.io/py/apache-superset-core.svg)](https://badge.fury.io/py/apache-superset-core)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

The official core package for building Apache Superset backend extensions and integrations. This package provides essential building blocks including base classes, API utilities, type definitions, and decorators for both the host application and extensions.

## 📦 Installation

```bash
pip install apache-superset-core
```

## 🏗️ Architecture

The package is organized into logical modules, each providing specific functionality:

- **`api`** - REST API base classes, models access, query utilities, and registration
- **`api.models`** - Access to Superset's database models (datasets, databases, etc.)
- **`api.query`** - Database query utilities and SQL dialect handling
- **`api.rest_api`** - Extension API registration and management
- **`api.types.rest_api`** - REST API base classes and type definitions

## 🚀 Quick Start

### Basic Extension Structure

```python
from flask import request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from superset_core.api import models, query, rest_api
from superset_core.api.types.rest_api import RestApi

class DatasetReferencesAPI(RestApi):
    """Example extension API demonstrating core functionality."""

    resource_name = "dataset_references"
    openapi_spec_tag = "Dataset references"
    class_permission_name = "dataset_references"

    @expose("/metadata", methods=("POST",))
    @protect()
    @safe
    @permission_name("read")
    def metadata(self) -> Response:
        """Get dataset metadata for tables referenced in SQL."""
        sql: str = request.json.get("sql")
        database_id: int = request.json.get("databaseId")

        # Access Superset's models using core APIs
        databases = models.get_databases(id=database_id)
        if not databases:
            return self.response_404()

        database = databases[0]
        dialect = query.get_sqlglot_dialect(database)

        # Access datasets to get owner information
        datasets = models.get_datasets()
        owners_map = {
            dataset.table_name: [
                f"{owner.first_name} {owner.last_name}"
                for owner in dataset.owners
            ]
            for dataset in datasets
        }

        # Process SQL and return dataset metadata
        return self.response(200, result=owners_map)

# Register the extension API
rest_api.add_extension_api(DatasetReferencesAPI)
```

## 🤝 Contributing

We welcome contributions! Please see the [Contributing Guide](https://github.com/apache/superset/blob/master/CONTRIBUTING.md) for details.

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](https://github.com/apache/superset/blob/master/LICENSE.txt) for details.

## 🔗 Links

- [Apache Superset](https://superset.apache.org/)
- [Documentation](https://superset.apache.org/docs/)
- [Community](https://superset.apache.org/community/)
- [GitHub Repository](https://github.com/apache/superset)
- [Extension Development Guide](https://superset.apache.org/docs/extensions/)

---

**Note**: This package is currently in release candidate status. APIs may change before the 1.0.0 release. Please check the [changelog](CHANGELOG.md) for breaking changes between versions.
