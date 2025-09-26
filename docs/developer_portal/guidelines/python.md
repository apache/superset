---
title: Python Guidelines
sidebar_position: 3
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

# Python Guidelines

🚧 **Coming Soon** 🚧

Python coding standards for Superset backend development.

## Topics to be covered:

- PEP 8 compliance
- Type hints requirements
- MyPy configuration
- Black formatter settings
- Import organization
- Docstring standards
- Error handling patterns
- Async/await usage
- SQLAlchemy best practices
- Flask patterns

## Key Requirements

1. **Type hints required** - All new code needs type annotations
2. **MyPy compliant** - Must pass `pre-commit run mypy`
3. **Black formatted** - Use Black for consistent formatting
4. **Comprehensive docstrings** - All public functions/classes
5. **SQLAlchemy typing** - Proper model annotations

## Quick Examples

```python
# ✅ Good - with type hints
def calculate_total(items: list[float]) -> float:
    """Calculate the sum of all items.

    :param items: List of numeric values
    :return: Sum of all items
    """
    return sum(items)

# ❌ Bad - missing type hints
def calculate_total(items):
    return sum(items)
```

---

*This documentation is under active development. Check back soon for updates!*
