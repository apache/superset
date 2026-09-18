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
"""Pin concrete route contracts independently of the shared command bodies."""

from __future__ import annotations

import ast
import inspect
import re
from collections.abc import Callable
from importlib import import_module
from pathlib import Path
from types import ModuleType
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from apispec import APISpec, yaml_utils

from superset.utils import json

ROOT: Path = Path(__file__).resolve().parents[3]
ROUTES: tuple[tuple[str, str], ...] = (
    ("chart", "restore"),
    ("dashboard", "restore"),
    ("dataset", "restore"),
    ("chart", "purge"),
    ("dashboard", "purge"),
)


def _route_node(entity: str, action: str) -> ast.FunctionDef:
    """Read the concrete route without importing application dependencies."""
    tree: ast.Module = ast.parse(
        (ROOT / "superset" / f"{entity}s" / "api.py").read_text()
    )
    api_class: ast.ClassDef = next(
        node
        for node in tree.body
        if isinstance(node, ast.ClassDef) and node.name == f"{entity.title()}RestApi"
    )
    return next(
        node
        for node in api_class.body
        if isinstance(node, ast.FunctionDef) and node.name == action
    )


def _normalize_entity(value: Any, entity: str) -> Any:
    """Normalize only entity nouns and prose whitespace, not schema structure."""
    if isinstance(value, dict):
        return {key: _normalize_entity(item, entity) for key, item in value.items()}
    if isinstance(value, list):
        return [_normalize_entity(item, entity) for item in value]
    if isinstance(value, str):
        return re.sub(rf"\b{entity}\b", "entity", " ".join(value.split()), flags=re.I)
    return value


@pytest.mark.parametrize("entity,action", ROUTES)
def test_concrete_route_source_contract(entity: str, action: str) -> None:
    """Keep the complete ordered decorator declaration and noun-specific docs."""
    route: ast.FunctionDef = _route_node(entity, action)
    decorators: list[str] = [ast.unparse(node) for node in route.decorator_list]
    assert decorators == [
        f"expose('/<uuid>/{action}', methods=('POST',))",
        "protect()",
        "safe",
        "statsd_metrics",
        "event_logger.log_this_with_context(action=lambda self, *args, **kwargs: "
        f"f'{{self.__class__.__name__}}.{action}', log_to_statsd=False)",
    ]
    assert len(route.body) == 2
    assert ast.unparse(route.body[1]) == f"return self._{action}_soft_deleted(uuid)"
    operation: dict[str, Any] = yaml_utils.load_operations_from_docstring(
        ast.get_docstring(route)
    )["post"]
    reference: dict[str, Any] = yaml_utils.load_operations_from_docstring(
        ast.get_docstring(_route_node("chart", action))
    )["post"]
    assert _normalize_entity(operation, entity) == _normalize_entity(reference, "chart")


@pytest.fixture
def api_classes(app_context: None) -> dict[str, type[Any]]:
    """Load the actual APIs after the existing fixture initializes extensions."""
    return {
        entity: getattr(
            import_module(f"superset.{entity}s.api"), f"{entity.title()}RestApi"
        )
        for entity in ("chart", "dashboard", "dataset")
    }


@pytest.mark.parametrize("entity,action", ROUTES)
def test_wrapped_route_metadata(
    api_classes: dict[str, type[Any]], entity: str, action: str
) -> None:
    """Verify real FAB expose metadata and the ordered runtime wrapper chain."""
    route: Any = api_classes[entity].__dict__[action]
    assert route._urls == [(f"/<uuid>/{action}", ("POST",))]
    assert route._permission_name == action
    chain: list[str] = []
    while hasattr(route, "__wrapped__"):
        chain.append(route.__code__.co_qualname)
        route = route.__wrapped__
    assert chain == [
        "protect.<locals>._protect.<locals>.wraps",
        "safe.<locals>.wraps",
        "statsd_metrics.<locals>.decorate.<locals>.wraps",
        "AbstractEventLogger._wrapper.<locals>.wrapper",
    ]
    assert route.__qualname__ == f"{entity.title()}RestApi.{action}"


@pytest.mark.parametrize("entity,action", ROUTES)
def test_generated_openapi_operation(
    api_classes: dict[str, type[Any]], entity: str, action: str
) -> None:
    """Generate with FAB/APISpec and compare to the published operation exactly."""
    published: dict[str, Any] = json.loads(
        (ROOT / "docs/static/resources/openapi.json").read_text()
    )
    api: Any = object.__new__(api_classes[entity])
    route: Any = getattr(api, action)
    path: str = f"/api/v1/{entity}/{{uuid}}/{action}"
    operations: dict[str, Any] = {}
    api.operation_helper(path=path, operations=operations, methods=["POST"], func=route)
    operations["post"]["tags"] = [api.openapi_spec_tag]
    spec: APISpec = APISpec(
        title="route contract", version="1", openapi_version="3.0.2"
    )
    for name, component in published["components"]["responses"].items():
        spec.components.response(name, component)
    spec.path(path=path, operations=operations)
    generated: dict[str, Any] = spec.to_dict()["paths"][path]["post"]
    assert generated == published["paths"][path]["post"]
    reference: dict[str, Any] = dict(
        published["paths"][f"/api/v1/chart/{{uuid}}/{action}"]["post"]
    )
    reference.pop("tags")
    comparable: dict[str, Any] = dict(generated)
    comparable.pop("tags")
    assert _normalize_entity(comparable, entity) == _normalize_entity(
        reference, "chart"
    )


@pytest.mark.parametrize("entity,action", ROUTES)
@pytest.mark.parametrize(
    "outcome", ["success", "not_found", "forbidden", "failed", "unexpected"]
)
def test_command_response_mapping(
    api_classes: dict[str, type[Any]], entity: str, action: str, outcome: str
) -> None:
    """Keep success, exception precedence, logging and unexpected propagation."""
    api: Any = object.__new__(api_classes[entity])
    api.response = MagicMock()
    api.response_404 = MagicMock()
    api.response_403 = MagicMock()
    api.response_422 = MagicMock()
    api.soft_delete_logger = MagicMock()
    command: MagicMock = MagicMock()
    exceptions: ModuleType = import_module(f"superset.commands.{entity}.exceptions")
    failure_kind: str = "Restore" if action == "restore" else "Delete"
    error_types: dict[str, type[Exception]] = {
        "not_found": getattr(exceptions, f"{entity.title()}NotFoundError"),
        "forbidden": getattr(exceptions, f"{entity.title()}ForbiddenError"),
        "failed": getattr(exceptions, f"{entity.title()}{failure_kind}FailedError"),
        "unexpected": RuntimeError,
    }
    error: Exception | None = error_types[outcome]() if outcome != "success" else None
    command.return_value.run.side_effect = error
    original: Callable[..., Any] = inspect.unwrap(getattr(type(api), action))
    with (
        patch.object(type(api), "restore_command_cls", command),
        patch("superset.commands.purge.PurgeArchivedCommand", command),
    ):
        if outcome == "unexpected":
            with pytest.raises(RuntimeError):
                original(api, "entity-uuid")
        else:
            result: Any = original(api, "entity-uuid")
            response: MagicMock = {
                "success": api.response,
                "not_found": api.response_404,
                "forbidden": api.response_403,
                "failed": api.response_422,
            }[outcome]
            assert result is response.return_value
            if outcome == "success":
                response.assert_called_once_with(200, message="OK")
            elif outcome == "failed":
                response.assert_called_once_with(message=str(error))
            else:
                response.assert_called_once_with()
    if action == "restore":
        command.assert_called_once_with("entity-uuid")
    else:
        command.assert_called_once_with("entity-uuid", api.purge_binding)
    if outcome == "failed":
        verb: str = "restoring" if action == "restore" else "purging"
        api.soft_delete_logger.error.assert_called_once_with(
            f"Error {verb} model %s: %s", type(api).__name__, str(error), exc_info=True
        )
    else:
        api.soft_delete_logger.error.assert_not_called()


@pytest.mark.parametrize("entity", ["dashboard", "dataset"])
def test_restore_conflict_is_not_logged(
    api_classes: dict[str, type[Any]], entity: str
) -> None:
    """Keep the additional 422 legs ahead of the logged restore-failure leg."""
    api: Any = object.__new__(api_classes[entity])
    api.response_422 = MagicMock()
    api.soft_delete_logger = MagicMock()
    exceptions: ModuleType = import_module(f"superset.commands.{entity}.exceptions")
    conflict_name: str = {
        "dashboard": "DashboardSlugConflictError",
        "dataset": "DatasetLogicalDuplicateError",
    }[entity]
    error: Exception = getattr(exceptions, conflict_name)()
    with patch.object(type(api), "restore_command_cls") as command:
        command.return_value.run.side_effect = error
        result: Any = inspect.unwrap(type(api).restore)(api, "entity-uuid")
    assert result is api.response_422.return_value
    api.response_422.assert_called_once_with(message=str(error))
    api.soft_delete_logger.error.assert_not_called()


@pytest.mark.parametrize("entity,action", ROUTES)
def test_concrete_command_bindings(
    api_classes: dict[str, type[Any]], entity: str, action: str
) -> None:
    """Pin command identities without deriving expectations from API bindings."""
    api_class: type[Any] = api_classes[entity]
    if action == "restore":
        commands: ModuleType = import_module(f"superset.commands.{entity}.restore")
        assert api_class.restore_command_cls is getattr(
            commands, f"Restore{entity.title()}Command"
        )
    else:
        from superset.commands.purge import SoftDeleteBinding

        daos: ModuleType = import_module(f"superset.daos.{entity}")
        exceptions: ModuleType = import_module(f"superset.commands.{entity}.exceptions")
        expected: SoftDeleteBinding = SoftDeleteBinding(
            dao=getattr(daos, f"{entity.title()}DAO"),
            not_found=getattr(exceptions, f"{entity.title()}NotFoundError"),
            forbidden=getattr(exceptions, f"{entity.title()}ForbiddenError"),
            delete_failed=getattr(exceptions, f"{entity.title()}DeleteFailedError"),
        )
        assert api_class.purge_binding == expected
