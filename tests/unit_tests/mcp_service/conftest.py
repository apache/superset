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

"""
MCP service test configuration.

Disables RBAC permission checks for integration tests.
RBAC logic is tested directly in test_auth_rbac.py.
"""

import importlib
import pkgutil
import sys

import pytest


def _restore_tool_submodule_attrs() -> None:
    """Make ``patch("...tool.<name>.<helper>")`` targets resolve on Python 3.10.

    Every ``superset.mcp_service.<domain>.tool`` package re-exports its tool
    function with ``from .<name> import <name>`` (see each package ``__init__``
    and its ``__all__``). That binding shadows the *submodule* attribute of the
    same name on the package object, so ``getattr(<...>.tool, "<name>")`` returns
    the function rather than the module.

    On Python 3.10, ``unittest.mock.patch("...tool.<name>.<helper>")`` resolves
    the target through that attribute and raises::

        AttributeError: <function <name>> does not have the attribute '<helper>'

    (Python 3.11+ tolerates the shadow.) Restoring each submodule attribute from
    ``sys.modules`` — which always holds the module regardless of the shadow —
    lets the string patch targets resolve to the module on every interpreter.

    This is safe: tools register via the ``@mcp.tool`` decorator at import time
    and are invoked by name, and nothing imports these as functions through the
    package attribute (``app.py`` imports them only for their registration side
    effect, ``# noqa: F401``).
    """
    mcp_service = importlib.import_module("superset.mcp_service")
    for domain in pkgutil.iter_modules(mcp_service.__path__):
        tool_pkg_name = f"superset.mcp_service.{domain.name}.tool"
        try:
            tool_pkg = importlib.import_module(tool_pkg_name)
        except ImportError:
            continue
        for submodule in pkgutil.iter_modules(tool_pkg.__path__):
            qualified = f"{tool_pkg_name}.{submodule.name}"
            importlib.import_module(qualified)
            setattr(tool_pkg, submodule.name, sys.modules[qualified])


_restore_tool_submodule_attrs()


@pytest.fixture(autouse=True)
def disable_mcp_rbac(app):
    """Disable RBAC permission checks for MCP integration tests.

    The RBAC permission logic is tested directly in test_auth_rbac.py.
    Integration tests use mock users that do not have real FAB roles,
    so we disable RBAC to let them exercise tool logic.
    """
    app.config["MCP_RBAC_ENABLED"] = False
    yield
    app.config.pop("MCP_RBAC_ENABLED", None)
