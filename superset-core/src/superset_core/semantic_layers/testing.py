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

Load before test collection with ``pytest -p superset_core.semantic_layers.testing``.
Install ``apache-superset-core[testing]`` for pytest support; importing the
provider SDK itself does not require pytest.
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
    AdhocExpression,
    Dimension,
    Filter,
    Metric,
    null_placement,
    NullPlacement,
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
    """Set display metadata without registering the class with any host."""

    def decorate(provider: _T) -> _T:
        # The decorator adds metadata; the input type need not declare it.
        setattr(provider, "name", name)  # noqa: B010
        setattr(provider, "description", description)  # noqa: B010
        return provider

    return decorate


@pytest.fixture
def semantic_layer_registration(monkeypatch: pytest.MonkeyPatch) -> None:
    """Allow provider imports during a test without initializing a host.

    Request this fixture before importing modules that use ``@semantic_layer``;
    top-level provider imports in test modules run before fixtures. The fixture
    replaces only the SDK decorator, and pytest restores it after the test.
    Decorated classes retain their assigned name and description, as in the host.
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
    Arrow tables for identity, grain, NULL, grouped OR, order-before-limit and
    NULL placement.
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
        "case",
        [
            "identity",
            "grain",
            "null",
            "not_null",
            "or",
            "order_limit",
            "null_placement",
        ],
    )
    def test_query_outputs(
        self,
        case: str,
        semantic_view: SemanticView,
        semantic_query_cases: Mapping[str, tuple[SemanticQuery, pa.Table]],
    ) -> None:
        """Compare executed results, including column names and row order."""
        if case == "grain" and not any(
            dimension.grain is not None for dimension in semantic_view.get_dimensions()
        ):
            pytest.skip("grain: catalog declares no grain-bearing dimension")
        query: SemanticQuery
        expected: pa.Table
        assert case in semantic_query_cases, (
            f"semantic_query_cases has no {case!r} case; see the provider "
            "testing guide for the required cases"
        )
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
            _assert_normalized_or_witness(query)
        elif case == "order_limit":
            assert query.order
            assert query.limit is not None
            assert query.limit > 0
            full: SemanticResult = semantic_view.get_table(
                replace(query, limit=None, offset=None)
            )
            assert full.results.num_rows > query.limit, "seed more rows than the limit"
            _assert_result_equal(
                full.results.slice(query.offset or 0, query.limit), expected
            )
        elif case == "null_placement":
            _assert_null_placement_witness(query, semantic_view, expected)
        result: SemanticResult = semantic_view.get_table(query)
        _assert_result_equal(result.results, expected)
        assert set(result.results.column_names) == {
            d.name for d in query.dimensions
        } | {m.name for m in query.metrics}

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
                (TypeError, AttributeError, NameError, AssertionError, KeyError),
            ), f"Fault fixture raised a programming error: {error.value!r}"
            assert not isinstance(
                error.value,
                (SemanticQueryRejectedError, SemanticResultCompletenessError),
            )

    @pytest.mark.parametrize("feature", list(SemanticViewFeature))
    def test_advertised_capabilities(
        self,
        feature: SemanticViewFeature,
        semantic_view: SemanticView,
        semantic_capability_cases: Mapping[str, tuple[SemanticQuery, pa.Table]],
    ) -> None:
        """Exercise each representable advertised feature independently."""
        if feature == SemanticViewFeature.ADHOC_COLUMN_EXPRESSIONS:
            pytest.skip("ADHOC_COLUMN_EXPRESSIONS: no SDK query shape yet")
        if feature not in semantic_view.features:
            pytest.skip(f"Provider does not advertise {feature.value}")
        query: SemanticQuery
        expected: pa.Table
        query, expected = semantic_capability_cases[feature.value]
        assert expected.num_rows > 0
        assert query.order or expected.num_rows == 1, (
            f"{feature.value}: multi-row fixtures need explicit order"
        )
        if feature == SemanticViewFeature.ROW_OFFSET:
            assert query.offset is not None
            assert query.offset > 0
            assert query.limit is not None
            assert query.limit > 0
        elif feature in {
            SemanticViewFeature.GROUP_LIMIT,
            SemanticViewFeature.GROUP_OTHERS,
        }:
            assert query.group_limit is not None
            if feature == SemanticViewFeature.GROUP_OTHERS:
                assert query.group_limit.group_others
        elif feature == SemanticViewFeature.ADHOC_EXPRESSIONS_IN_ORDERBY:
            assert any(
                isinstance(member, AdhocExpression) for member, _ in query.order or []
            ), "ADHOC_EXPRESSIONS_IN_ORDERBY requires an AdhocExpression order key"
        _assert_result_equal(semantic_view.get_table(query).results, expected)

    def test_metadata_generation(
        self,
        semantic_make_view: Callable[[str], SemanticView],
        semantic_change_catalog: Callable[[], None],
    ) -> None:
        """Changed generations cannot reuse a stale catalog.

        The change fixture must add a member on each call. Factories and transport
        stay provider-owned; uncached legacy providers may report a None token.
        """
        first: SemanticView = semantic_make_view("generation-a")
        before: tuple[set[str], set[tuple[str, str | None]]] = _catalog(first)
        assert first.metadata_cache_token in {None, "generation-a"}
        semantic_change_catalog()
        second: SemanticView = semantic_make_view("generation-b")
        after: tuple[set[str], set[tuple[str, str | None]]] = _catalog(second)
        assert before[0] <= after[0], "Generation change must retain existing members"
        assert before[1] <= after[1], "Generation change must retain existing members"
        assert after != before, "Catalog change fixture must add a member"
        assert second.metadata_cache_token in {None, "generation-b"}
        # A captured view must never claim a later discovery token.
        assert first.metadata_cache_token in {None, "generation-a"}

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


def _assert_null_placement_witness(
    query: SemanticQuery, view: SemanticView, expected: pa.Table
) -> None:
    """Require NULL values of the first order key where its placement puts them.

    The host's default chronological order asks for NULL values last; a
    provider must honor a placement on any order key, before offset and limit.
    The page must keep different rows from the ones the opposite placement would.
    """
    assert query.order, "null_placement fixture requires an order"
    first: tuple[object, ...] = query.order[0]
    placement: NullPlacement | None = null_placement(first)
    assert placement is not None, (
        "null_placement fixture's first order key requires a NullPlacement"
    )
    member: object = first[0]
    assert isinstance(member, Dimension), (
        "null_placement fixture must order by a selected dimension"
    )
    assert member in query.dimensions, (
        "null_placement fixture must order by a selected dimension"
    )
    assert query.limit is not None
    assert query.limit > 0
    full: pa.Table = view.get_table(replace(query, limit=None, offset=None)).results
    values: list[object] = full.column(member.name).to_pylist()
    nulls: list[object] = [value for value in values if value is None]
    others: list[object] = [value for value in values if value is not None]
    assert nulls, "null_placement fixture requires NULL values of the order key"
    assert others, "null_placement fixture requires non-NULL values of the order key"
    placed: list[object] = (
        others + nulls if placement is NullPlacement.LAST else nulls + others
    )
    opposite: list[object] = (
        nulls + others if placement is NullPlacement.LAST else others + nulls
    )
    assert values == placed, (
        f"{member.name}: NULL values must sort {placement.value.lower()}, got {values}"
    )
    start: int = query.offset or 0
    stop: int = start + query.limit
    assert sorted(map(repr, placed[start:stop])) != sorted(
        map(repr, opposite[start:stop])
    ), (
        "null_placement fixture's page must keep different rows "
        "under the opposite placement"
    )
    _assert_result_equal(full.slice(start, query.limit), expected)


def _assert_normalized_or_witness(query: SemanticQuery) -> None:
    """Require the host's mixed-IN/NULL group and an outer comparison."""
    groups: list[OrFilter] = [
        item for item in query.filters or set() if isinstance(item, OrFilter)
    ]
    assert len(groups) == 1, "or fixture requires one normalized IN/NULL group"
    group: OrFilter = groups[0]
    membership: list[Filter] = [
        leaf for leaf in group.filters if leaf.operator == Operator.IN
    ]
    nulls: list[Filter] = [
        leaf for leaf in group.filters if leaf.operator == Operator.IS_NULL
    ]
    assert len(group.filters) == 2, "or fixture requires IN and IS_NULL leaves"
    assert len(membership) == 1, "or fixture requires IN and IS_NULL leaves"
    assert len(nulls) == 1, "or fixture requires IN and IS_NULL leaves"
    selected: Filter = membership[0]
    assert selected.column is not None, "or fixture leaves must select the same member"
    assert selected.column == nulls[0].column, (
        "or fixture leaves must select the same member"
    )
    assert isinstance(selected.value, frozenset), "or fixture IN requires a frozenset"
    assert len(selected.value) >= 2, (
        "or fixture IN requires at least two non-NULL values"
    )
    assert None not in selected.value, (
        "or fixture IN requires at least two non-NULL values"
    )
    assert any(
        isinstance(item, Filter)
        and item.type == selected.type
        and item.operator not in {Operator.IS_NULL, Operator.IS_NOT_NULL}
        for item in query.filters or set()
    ), "or fixture requires an outer AND comparison"


def _assert_result_equal(actual: pa.Table, expected: pa.Table) -> None:
    """Compare named typed columns and row order, not field order/nullability."""
    assert len(actual.column_names) == len(set(actual.column_names)), (
        "duplicate result columns"
    )
    assert set(actual.column_names) == set(expected.column_names), (
        f"Expected columns {expected.column_names}, got {actual.column_names}"
    )
    name: str
    for name in expected.column_names:
        assert actual.column(name).equals(expected.column(name)), (
            f"{name}: expected {expected.column(name).to_pylist()}, "
            f"got {actual.column(name).to_pylist()}; "
            f"expected schema {expected.schema}, got {actual.schema}"
        )


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
                raise ImportError(
                    f"Provider import graph reached host/framework module {fullname}"
                )
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
