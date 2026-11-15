# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""The extension reaches the host only through ``superset_core``."""

from __future__ import annotations

import ast
from pathlib import Path

import superset_oss.artifacts

PACKAGE = Path(superset_oss.artifacts.__file__).parent


def imported_modules(path: Path) -> list[str]:
    """Every absolute module that ``path`` imports, at any depth."""
    modules = []
    for node in ast.walk(ast.parse(path.read_text(), str(path))):
        if isinstance(node, ast.Import):
            modules += [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            modules.append(node.module)
    return modules


def test_the_extension_imports_no_host_internals() -> None:
    host_imports = [
        f"{path.relative_to(PACKAGE)}: {module}"
        for path in sorted(PACKAGE.rglob("*.py"))
        for module in imported_modules(path)
        if module == "superset" or module.startswith("superset.")
    ]

    assert host_imports == []
