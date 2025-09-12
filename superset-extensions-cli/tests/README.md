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

# Licensed to the Apache Software Foundation (ASF) under one

# or more contributor license agreements. See the NOTICE file

# distributed with this work for additional information

# regarding copyright ownership. The ASF licenses this file

# to you under the Apache License, Version 2.0 (the

# "License"); you may not use this file except in compliance

# with the License. You may obtain a copy of the License at

#

# http://www.apache.org/licenses/LICENSE-2.0

#

# Unless required by applicable law or agreed to in writing,

# software distributed under the License is distributed on an

# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY

# KIND, either express or implied. See the License for the

# specific language governing permissions and limitations

# under the License.

# Superset CLI Tests

This directory contains tests for the superset-extensions-cli package, focusing on the `init` command and other CLI functionality.

## Test Structure

### Core Test Files

- **`test_cli_init.py`**: Comprehensive tests for the `init` command scaffolder
- **`test_templates.py`**: Unit tests for Jinja2 template rendering
- **`conftest.py`**: Pytest fixtures and configuration
- **`utils.py`**: Reusable testing utilities and helpers

### Test Categories

#### Unit Tests (`@pytest.mark.unit`)

- Template rendering functionality
- Individual function testing
- Input validation logic

#### Integration Tests (`@pytest.mark.integration`)

- Complete CLI command workflows
- End-to-end scaffolding processes

#### CLI Tests (`@pytest.mark.cli`)

- Click command interface testing
- User input simulation
- Command output verification

## Testing Approach for Scaffolders/Generators

The tests use these patterns for testing code generators:

### 1. Isolated Environment Testing

```python
@pytest.fixture
def isolated_filesystem(tmp_path):
    """Provide isolated temporary directory for each test."""
```

### 2. Click CLI Testing Framework

```python
from click.testing import CliRunner
runner = CliRunner()
result = runner.invoke(app, ["init"], input="...")
```

### 3. File Structure Validation

```python
from tests.utils import assert_file_structure, assert_directory_structure
assert_file_structure(extension_path, expected_files)
```

### 4. Template Content Verification

```python
from tests.utils import assert_json_content
assert_json_content(json_path, {"name": "expected_value"})
```

### 5. Parametrized Testing

```python
@pytest.mark.parametrize("include_frontend,include_backend", [
    (True, True), (True, False), (False, True), (False, False)
])
```

## Key Test Cases

### Init Command Tests

- ✅ Creates extension with both frontend and backend
- ✅ Creates frontend-only extensions
- ✅ Creates backend-only extensions
- ✅ Validates extension naming (alphanumeric + underscore only)
- ✅ Handles existing directory conflicts
- ✅ Verifies generated file content accuracy
- ✅ Tests custom version and license inputs
- ✅ Integration test for complete workflow

### Template Rendering Tests

- ✅ Extension.json template with various configurations
- ✅ Package.json template rendering
- ✅ Pyproject.toml template rendering
- ✅ Template validation with different names/versions/licenses
- ✅ JSON validity verification
- ✅ Whitespace and formatting checks

## Running Tests

### All tests

```bash
pytest
```

### Specific test categories

```bash
pytest -m unit          # Unit tests only
pytest -m integration   # Integration tests only
pytest -m cli           # CLI tests only
```

### With coverage

```bash
pytest --cov=superset_extensions_cli --cov-report=html
```

### Specific test files

```bash
pytest tests/test_cli_init.py
pytest tests/test_templates.py
```

## Reusable Testing Infrastructure

The testing infrastructure is designed for reusability:

### Test Utilities (`tests/utils.py`)

- `assert_file_exists()` / `assert_directory_exists()`
- `assert_file_structure()` / `assert_directory_structure()`
- `assert_json_content()` / `load_json_file()`
- `create_test_extension_structure()` - Helper for expected structures

### Fixtures (`tests/conftest.py`)

- `cli_runner` - Click CLI runner
- `isolated_filesystem` - Temporary directory with cleanup
- `extension_params` - Default extension parameters
- `cli_input_*` - Pre-configured user inputs

This infrastructure can be easily extended for testing additional CLI commands like `build`, `bundle`, `dev`, and `validate`.

## Best Practices Implemented

1. **Isolation**: Each test runs in its own temporary directory
2. **Comprehensive Coverage**: Tests cover happy paths, edge cases, and error conditions
3. **Realistic Testing**: Uses actual Click CLI runner with realistic user input
4. **Content Verification**: Validates both file existence and content accuracy
5. **Template Testing**: Separates template rendering logic from CLI integration
6. **Reusable Components**: Utilities and fixtures designed for extension
7. **Clear Documentation**: Well-documented test cases and helper functions
8. **Type Safety**: Uses modern Python type annotations with `from __future__ import annotations`
