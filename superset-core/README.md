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

## 🏗️ Package Structure

```
src/superset_core/
├── common/
├── extensions/
├── mcp/
├── queries/
├── rest_api/
├── tasks/
└── __init__.py
```

## 🚀 Quick Start

### Basic Extension API

```python
from flask_appbuilder.api import expose, permission_name, protect, safe
from superset_core.rest_api.api import RestApi
from superset_core.rest_api.decorators import api


@api(id="dataset_references", name="Dataset References API")
class DatasetReferencesAPI(RestApi):

    @expose("/metadata", methods=("POST",))
    @protect()
    @safe
    @permission_name("read")
    def metadata(self) -> Response:
        # ... endpoint implementation
```

### Background Tasks

```python
from superset_core.tasks.decorators import task
from superset_core.tasks.types import TaskScope

@task(name="generate_report", scope=TaskScope.SHARED)
def generate_report(chart_id: int) -> None:
    # ... task implementation
```

### MCP Tools

```python
from superset_core.mcp.decorators import tool

@tool(name="my_tool", description="Custom business logic", tags=["extension"])
def my_extension_tool(param: str) -> dict:
    # ... tool implementation
```

### MCP Prompts

```python
from superset_core.mcp.decorators import prompt

@prompt(name="my_prompt", title="My Prompt", description="Interactive prompt", tags={"extension"})
async def my_prompt_handler(ctx: Context) -> str:
    # ... prompt implementation
```

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](https://github.com/apache/superset/blob/master/LICENSE.txt) for details.

## 🔗 Links

- [Community](https://superset.apache.org/community/)
- [GitHub Repository](https://github.com/apache/superset)
- [Extensions Documentation](https://superset.apache.org/developer-docs/extensions/overview)
