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

"""Opt-in pytest support for provider tests without a Superset application.

Load with ``pytest_plugins = ["superset_core.semantic_layers.testing"]``.
This module requires pytest; importing the provider SDK itself does not.
"""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import replace
from typing import NoReturn, TypeVar

import pyarrow as pa
import pytest
from pydantic import BaseModel

from superset_core.semantic_layers import decorators
from superset_core.semantic_layers.errors import (
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
    SemanticResultCompletenessError,
)
from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Metric,
    Operator,
    OrFilter,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView, SemanticViewFeature

_T = TypeVar("_T")


def _registration(
    id: str, name: str, description: str | None = None
) -> Callable[[_T], _T]:
    """Leave the decorated class intact without registering it with any host."""

    def decorate(provider: _T) -> _T:
        return provider

    return decorate


@pytest.fixture
def semantic_layer_registration(monkeypatch: pytest.MonkeyPatch) -> None:
    """Allow provider imports during a test without initializing a host.

    Request this fixture before importing modules that use ``@semantic_layer``;
    top-level provider imports in test modules run before fixtures. The fixture
    replaces only the SDK decorator, and pytest restores it after the test.
    Already-imported aliases are not patched. It does not emulate registration,
    namespacing, duplicate detection or extension lifecycle. Test those in a host
    integration lane. Use in isolated provider test processes, not a live host.
    """
    monkeypatch.setattr(decorators, "semantic_layer", _registration)


# Keep test data and provider construction in the provider's own fixtures. This
# suite consumes the real SDK types rather than a copy of a factory signature.
class SemanticProviderConformance:
    """Subclass in a ``Test...`` class and supply the documented provider fixtures.

    Query fixtures seed discriminating data and provide independent expected
    Arrow tables for identity, grain, NULL, grouped OR, and order-before-limit.
    Error fixtures call real provider methods against controlled backend outcomes.
    See the provider author guide for every fixture and the limits of this suite.
    """

    def test_catalog_identity(
        self, semantic_view: SemanticView, semantic_reloaded_view: SemanticView
    ) -> None:
        """Stable selections survive reloads without ambiguous catalog members."""
        assert semantic_view.uid()
        assert semantic_view.uid() == semantic_reloaded_view.uid()
        assert _catalog(semantic_view) == _catalog(semantic_reloaded_view)

    @pytest.mark.parametrize(
        "case", ["identity", "grain", "null", "not_null", "or", "order_limit"]
    )
    def test_query_outputs(
        self,
        case: str,
        semantic_view: SemanticView,
        semantic_query_cases: Mapping[str, tuple[SemanticQuery, pa.Table]],
    ) -> None:
        """Compare executed results, including column names and row order."""
        query: SemanticQuery
        expected: pa.Table
        query, expected = semantic_query_cases[case]
        assert expected.num_rows > 0, (
            f"{case} must distinguish a correct result from no data"
        )
        assert query.order or expected.num_rows == 1, (
            f"{case}: multi-row fixtures need explicit order"
        )
        assert set(query.dimensions) <= semantic_view.get_dimensions()
        assert set(query.metrics) <= semantic_view.get_metrics()
        if case == "grain":
            assert any(dimension.grain is not None for dimension in query.dimensions)
        elif case in {"null", "not_null"}:
            operator: Operator = (
                Operator.IS_NULL if case == "null" else Operator.IS_NOT_NULL
            )
            assert any(
                isinstance(item, Filter) and item.operator == operator
                for item in query.filters or set()
            )
        elif case == "or":
            assert any(isinstance(item, OrFilter) for item in query.filters or set())
        elif case == "order_limit":
            assert query.order
            assert query.limit is not None
            assert query.limit > 0
            full: SemanticResult = semantic_view.get_table(
                replace(query, limit=None, offset=None)
            )
            assert full.results.num_rows > query.limit, "seed more rows than the limit"
            assert full.results.slice(query.offset or 0, query.limit).equals(expected)
        result: SemanticResult = semantic_view.get_table(query)
        assert result.results.equals(expected), (
            f"{case}: expected {expected.to_pydict()}, got {result.results.to_pydict()}"
        )
        assert set(result.results.column_names) == {
            member.name for member in [*query.dimensions, *query.metrics]
        }

    @pytest.mark.parametrize("method", ["get_table", "get_values", "get_row_count"])
    @pytest.mark.parametrize("kind", ["refusal", "fault", "incomplete", "unverified"])
    def test_error_categories(
        self,
        method: str,
        kind: str,
        semantic_error_cases: Mapping[str, Callable[[], SemanticResult]],
    ) -> None:
        """Refusals and completeness are typed; operational faults stay faults."""
        operation: Callable[[], SemanticResult] = semantic_error_cases[
            f"{method}:{kind}"
        ]
        error: pytest.ExceptionInfo[Exception]
        # Operational fault classes are provider-owned; classify the caught error below.
        with pytest.raises(Exception) as error:  # noqa: PT011
            operation()
        if kind == "refusal":
            assert isinstance(error.value, SemanticQueryRejectedError)
            assert isinstance(error.value.code, SemanticQueryErrorCode)
        elif kind in {"incomplete", "unverified"}:
            assert isinstance(error.value, SemanticResultCompletenessError)
            assert error.value.reason == kind
        else:
            assert not isinstance(
                error.value,
                (SemanticQueryRejectedError, SemanticResultCompletenessError),
            )

    def test_advertised_capabilities(
        self,
        semantic_view: SemanticView,
        semantic_capability_cases: Mapping[str, tuple[SemanticQuery, pa.Table]],
    ) -> None:
        """Every advertised feature has a result-level witness in this lane."""
        feature: SemanticViewFeature | str
        for feature in semantic_view.features:
            name: str = (
                feature.value if isinstance(feature, SemanticViewFeature) else feature
            )
            query: SemanticQuery
            expected: pa.Table
            query, expected = semantic_capability_cases[name]
            assert expected.num_rows > 0
            assert query.order or expected.num_rows == 1, (
                f"{name}: multi-row fixtures need explicit order"
            )
            if name == "ROW_OFFSET":
                assert query.offset is not None
                assert query.offset > 0
                assert query.limit is not None
                assert query.limit > 0
            elif name in {"GROUP_LIMIT", "GROUP_OTHERS"}:
                assert query.group_limit is not None
                if name == "GROUP_OTHERS":
                    assert query.group_limit.group_others
            assert semantic_view.get_table(query).results.equals(expected), name

    def test_metadata_generation_and_unbound_bypass(
        self,
        semantic_make_view: Callable[[str | None], SemanticView],
        semantic_change_catalog: Callable[[], None],
    ) -> None:
        """Changed generations and unbound calls cannot reuse a stale catalog.

        The change fixture must add a member on each call. Factories and transport
        stay provider-owned; uncached legacy providers may report a None token.
        """
        first: SemanticView = semantic_make_view("generation-a")
        before: tuple[set[str], set[tuple[str, str | None]]] = _catalog(first)
        assert first.metadata_cache_token in {None, "generation-a"}
        semantic_change_catalog()
        second: SemanticView = semantic_make_view("generation-b")
        after: tuple[set[str], set[tuple[str, str | None]]] = _catalog(second)
        assert after != before
        assert second.metadata_cache_token in {None, "generation-b"}
        # A captured view must never claim a later discovery token.
        assert first.metadata_cache_token in {None, "generation-a"}
        semantic_change_catalog()
        unbound: SemanticView = semantic_make_view(None)
        assert _catalog(unbound) != after
        assert unbound.metadata_cache_token is None

    def test_imports_and_static_schema(
        self, semantic_provider_class: tuple[str, str]
    ) -> None:
        """Import in a fresh interpreter; reject host imports and schema I/O."""
        import os
        import subprocess
        import sys

        # Fixed interpreter/code; provider metadata is argv, never shell text.
        completed: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603
            [
                sys.executable,
                "-c",
                "from superset_core.semantic_layers.testing import _check_isolation; "
                "import sys; _check_isolation(*sys.argv[1:])",
                *semantic_provider_class,
            ],
            env={**os.environ, "PYTHONPATH": os.pathsep.join(sys.path)},
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        assert completed.returncode == 0, completed.stdout + completed.stderr

    # TODO: add the default chronological-order case after its SDK rule lands.


def _catalog(view: SemanticView) -> tuple[set[str], set[tuple[str, str | None]]]:
    """Validate exposed selection keys without treating private IDs as keys."""
    metrics: set[Metric] = view.get_metrics()
    dimensions: set[Dimension] = view.get_dimensions()
    names: set[str] = {metric.name for metric in metrics}
    variants: set[tuple[str, str | None]] = {
        (dimension.name, dimension.grain.representation if dimension.grain else None)
        for dimension in dimensions
    }
    assert len(names) == len(metrics), "duplicate metric selection names"
    assert len(variants) == len(dimensions), "duplicate dimension name/grain pairs"
    assert not names.intersection(dimension.name for dimension in dimensions)
    return names, variants


def _check_isolation(module_name: str, class_name: str) -> None:
    """Child-process check; it must never execute inside a running host."""
    import builtins
    import importlib
    import io
    import os
    import socket
    import sys
    from importlib.abc import MetaPathFinder
    from importlib.machinery import ModuleSpec
    from types import ModuleType

    attempted: list[str] = []

    class NoHost(MetaPathFinder):
        """Refuse host imports even when a provider catches ImportError."""

        def find_spec(
            self,
            fullname: str,
            path: Sequence[str] | None,
            target: ModuleType | None = None,
        ) -> ModuleSpec | None:
            if fullname.split(".")[0] in {"superset", "flask", "flask_appbuilder"}:
                attempted.append(fullname)
                raise ImportError(f"Provider imported host module {fullname}")
            return None

    def no_io(*args: object, **kwargs: object) -> NoReturn:
        attempted.append("schema I/O")
        raise AssertionError("Configuration schema attempted I/O")

    patch: pytest.MonkeyPatch
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(sys, "meta_path", [NoHost(), *sys.meta_path])
        patch.setattr(decorators, "semantic_layer", _registration)
        provider: type[SemanticLayer[BaseModel, SemanticView]] = getattr(
            importlib.import_module(module_name), class_name
        )
        # Imports are complete before blocking file access; importing dependency
        # modules is not provider discovery. Both no-configuration forms are checked.
        patch.setattr(builtins, "open", no_io)
        patch.setattr(io, "open", no_io)
        patch.setattr(os, "open", no_io)
        patch.setattr(socket, "create_connection", no_io)
        patch.setattr(socket, "getaddrinfo", no_io)
        patch.setattr(socket.socket, "connect", no_io)
        patch.setattr(socket.socket, "connect_ex", no_io)
        assert isinstance(provider.get_configuration_schema(), dict)
        assert isinstance(provider.get_configuration_schema(None), dict)
    assert not attempted, attempted
