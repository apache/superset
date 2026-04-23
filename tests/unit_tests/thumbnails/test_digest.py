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
from __future__ import annotations

from contextlib import nullcontext
from typing import Any, TYPE_CHECKING
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from flask import current_app
from flask_appbuilder.security.sqla.models import User

from superset.connectors.sqla.models import BaseDatasource, SqlaTable
from superset.tasks.exceptions import InvalidExecutorError
from superset.tasks.types import Executor, ExecutorType, FixedExecutor
from superset.utils.core import DatasourceType, override_user

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

_DEFAULT_DASHBOARD_KWARGS: dict[str, Any] = {
    "id": 1,
    "dashboard_title": "My Title",
    "slices": [{"id": 1, "slice_name": "My Chart"}],
    "position_json": '{"a": "b"}',
    "css": "background-color: lightblue;",
    "json_metadata": '{"c": "d"}',
}

_DEFAULT_CHART_KWARGS = {
    "id": 2,
    "params": {"a": "b"},
}


def CUSTOM_DASHBOARD_FUNC(  # noqa: N802
    dashboard: Dashboard,
    executor_type: ExecutorType,
    executor: str,
) -> str:
    return f"{dashboard.id}.{executor_type.value}.{executor}"


def CUSTOM_CHART_FUNC(  # noqa: N802
    chart: Slice,
    executor_type: ExecutorType,
    executor: str,
) -> str:
    return f"{chart.id}.{executor_type.value}.{executor}"


def prepare_datasource_mock(
    datasource_conf: dict[str, Any], spec: type[BaseDatasource | SqlaTable]
) -> BaseDatasource | SqlaTable:
    datasource = MagicMock(spec=spec)
    datasource.id = 1
    datasource.type = DatasourceType.TABLE
    datasource.is_rls_supported = datasource_conf.get("is_rls_supported", False)
    datasource.get_sqla_row_level_filters = datasource_conf.get(
        "get_sqla_row_level_filters", MagicMock(return_value=[])
    )
    return datasource


@pytest.mark.parametrize(
    "dashboard_overrides,execute_as,has_current_user,use_custom_digest,rls_datasources,expected_result",
    [
        (
            None,
            [FixedExecutor("admin")],
            False,
            False,
            [],
            # SHA-256 hash with default HASH_ALGORITHM
            "73653fa5724a23c28fdf3bba4c7e8a4f6f3470f888b55c986d56e2553c38713e",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            False,
            [],
            # SHA-256 hash with default HASH_ALGORITHM
            "62d7d89c426fb4f11787095f309c573c69e5d47a92af9cad792b03ba60a1f1cd",
        ),
        (
            {
                "dashboard_title": "My Other Title",
            },
            [ExecutorType.CURRENT_USER],
            True,
            False,
            [],
            # SHA-256 hash with default HASH_ALGORITHM
            "62d7d89c426fb4f11787095f309c573c69e5d47a92af9cad792b03ba60a1f1cd",
        ),
        (
            {
                "id": 2,
            },
            [ExecutorType.CURRENT_USER],
            True,
            False,
            [],
            # SHA-256 hash with default HASH_ALGORITHM
            "b4004c6d418121e012a6b6d6e8566aca4907e4fb204beaced17d8f8e6f7ff2dd",
        ),
        (
            {
                "slices": [{"id": 2, "slice_name": "My Other Chart"}],
            },
            [ExecutorType.CURRENT_USER],
            True,
            False,
            [],
            # SHA-256 hash with default HASH_ALGORITHM
            "e1226d050fde6acda8cc6630d677a971362a87f2e1b4c35df76de4048b5787bc",
        ),
        (
            {
                "position_json": {"b": "c"},
            },
            [ExecutorType.CURRENT_USER],
            True,
            False,
            [],
            # SHA-256 hash with default HASH_ALGORITHM
            "6073a59a3b7428f03cc72db8de43b74e3f203cac4fb0c84216201924043e8b41",
        ),
        (
            {
                "css": "background-color: darkblue;",
            },
            [ExecutorType.CURRENT_USER],
            True,
            False,
            [],
            # SHA-256 hash with default HASH_ALGORITHM
            "7e3e9ca5bd1493022a3b97a449cf17c931263b4a9d99b1fcad2781766535c116",
        ),
        (
            {
                "json_metadata": {"d": "e"},
            },
            [ExecutorType.CURRENT_USER],
            True,
            False,
            [],
            # SHA-256 hash with default HASH_ALGORITHM
            "bb0f8d2a1a4e406528ca027b4252856a69037ec7272587026f720521210123fe",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            False,
            [
                {
                    "is_rls_supported": True,
                    "get_sqla_row_level_filters": MagicMock(return_value=["filter1"]),
                }
            ],
            # SHA-256 hash with default HASH_ALGORITHM
            "88c66714ce66ee9de15bfa82e5bb35479838190ca6662d3088a00802827c195c",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            False,
            [
                {
                    "is_rls_supported": True,
                    "get_sqla_row_level_filters": MagicMock(
                        return_value=["filter1", "filter2"]
                    ),
                },
                {
                    "is_rls_supported": True,
                    "get_sqla_row_level_filters": MagicMock(
                        return_value=["filter3", "filter4"]
                    ),
                },
            ],
            # SHA-256 hash with default HASH_ALGORITHM
            "1a686c28c9c866832428616a0f9bd12d5b2452ea20645113c86dd2be88980c42",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            False,
            [
                {
                    "is_rls_supported": False,
                    "get_sqla_row_level_filters": MagicMock(return_value=[]),
                },
                {
                    "is_rls_supported": True,
                    "get_sqla_row_level_filters": MagicMock(
                        return_value=["filter1", "filter2"]
                    ),
                },
            ],
            # SHA-256 hash with default HASH_ALGORITHM
            "f0d428a30a62b000fa92e87c7bb29c2c55bddc49abf8408d395502653e702cd6",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            False,
            False,
            [],
            None,
        ),
        (
            None,
            [ExecutorType.FIXED_USER],
            False,
            False,
            [],
            InvalidExecutorError(),
        ),
    ],
)
def test_dashboard_digest(
    dashboard_overrides: dict[str, Any] | None,
    execute_as: list[Executor],
    has_current_user: bool,
    use_custom_digest: bool,
    rls_datasources: list[dict[str, Any]],
    expected_result: str | Exception,
    app_context: None,
) -> None:
    from superset import security_manager
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.thumbnails.digest import get_dashboard_digest

    # Prepare dashboard and slices
    kwargs = {
        **_DEFAULT_DASHBOARD_KWARGS,
        **(dashboard_overrides or {}),
    }
    slices = [Slice(**slice_kwargs) for slice_kwargs in kwargs.pop("slices")]
    dashboard = Dashboard(**kwargs, slices=slices)

    # Mock datasources with RLS
    datasources = []
    for rls_source in rls_datasources:
        datasource = prepare_datasource_mock(rls_source, BaseDatasource)
        datasources.append(datasource)

    user: User | None = None
    if has_current_user:
        user = User(id=1, username="1")

    func = CUSTOM_DASHBOARD_FUNC if use_custom_digest else None

    with (
        patch.dict(
            current_app.config,
            {
                "THUMBNAIL_EXECUTORS": execute_as,
                "THUMBNAIL_DASHBOARD_DIGEST_FUNC": func,
            },
        ),
        patch.object(
            type(dashboard),
            "datasources",
            new_callable=PropertyMock,
            return_value=datasources,
        ),
        patch.object(security_manager, "find_user", return_value=user),
        override_user(user),
    ):
        cm = (
            pytest.raises(type(expected_result))
            if isinstance(expected_result, Exception)
            else nullcontext()
        )
        with cm:
            assert get_dashboard_digest(dashboard=dashboard) == expected_result


@pytest.mark.parametrize(
    "chart_overrides,execute_as,has_current_user,use_custom_digest,rls_datasource,expected_result",
    [
        (
            None,
            [FixedExecutor("admin")],
            False,
            False,
            None,
            # SHA-256 hash with default HASH_ALGORITHM
            "053d9488ff5da47d00d236084c34261d608f0fb006aceb0084738ccb6fe7a838",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            False,
            None,
            # SHA-256 hash with default HASH_ALGORITHM
            "d69f16940a8de1b35088a79424f40ed388f1a7a5f2a7692dd14bf77964fb6898",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            True,
            None,
            "2.current_user.1",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            False,
            {
                "is_rls_supported": True,
                "get_sqla_row_level_filters": MagicMock(return_value=["filter1"]),
            },
            # SHA-256 hash with default HASH_ALGORITHM
            "90a543199890b9b2a6583a27a2fed66948f907d28070437250e3b4d715e5bd3e",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            False,
            {
                "is_rls_supported": True,
                "get_sqla_row_level_filters": MagicMock(
                    return_value=["filter1", "filter2"]
                ),
            },
            # SHA-256 hash with default HASH_ALGORITHM
            "42fbf56bf1dcbdcd4a84d26ed159ade36ab2bffbab85230799d719ce779c3312",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            False,
            {
                "is_rls_supported": False,
                "get_sqla_row_level_filters": MagicMock(return_value=[]),
            },
            # SHA-256 hash with default HASH_ALGORITHM
            "d69f16940a8de1b35088a79424f40ed388f1a7a5f2a7692dd14bf77964fb6898",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            False,
            False,
            None,
            None,
        ),
        (
            None,
            [ExecutorType.FIXED_USER],
            False,
            False,
            None,
            InvalidExecutorError(),
        ),
    ],
)
def test_chart_digest(
    chart_overrides: dict[str, Any] | None,
    execute_as: list[Executor],
    has_current_user: bool,
    use_custom_digest: bool,
    rls_datasource: dict[str, Any] | None,
    expected_result: str | Exception,
    app_context: None,
) -> None:
    from superset import security_manager
    from superset.models.slice import Slice
    from superset.thumbnails.digest import get_chart_digest

    # Mock datasource with RLS if provided
    datasource = None
    if rls_datasource:
        datasource = prepare_datasource_mock(rls_datasource, SqlaTable)

    # Prepare chart with the datasource in the constructor
    kwargs = {
        **_DEFAULT_CHART_KWARGS,
        **(chart_overrides or {}),
    }
    chart = Slice(**kwargs)
    chart.table = datasource

    user: User | None = None
    if has_current_user:
        user = User(id=1, username="1")

    func = CUSTOM_CHART_FUNC if use_custom_digest else None

    with (
        patch.dict(
            current_app.config,
            {
                "THUMBNAIL_EXECUTORS": execute_as,
                "THUMBNAIL_CHART_DIGEST_FUNC": func,
            },
        ),
        patch.object(security_manager, "find_user", return_value=user),
        override_user(user),
    ):
        cm = (
            pytest.raises(type(expected_result))
            if isinstance(expected_result, Exception)
            else nullcontext()
        )
        with cm:
            assert get_chart_digest(chart=chart) == expected_result


def test_dashboard_digest_deterministic_datasource_order(
    app_context: None,
) -> None:
    """
    Test that different datasource orderings produce the same digest.

    dashboard.datasources returns a set, whose iteration order is
    non-deterministic across Python processes (due to PYTHONHASHSEED).
    The digest must sort datasources by ID to ensure stability.
    """
    from superset import security_manager
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.thumbnails.digest import get_dashboard_digest

    kwargs = {**_DEFAULT_DASHBOARD_KWARGS}
    slices = [Slice(**slice_kwargs) for slice_kwargs in kwargs.pop("slices")]
    dashboard = Dashboard(**kwargs, slices=slices)

    def make_datasource(ds_id: int) -> MagicMock:
        ds = MagicMock(spec=BaseDatasource)
        ds.id = ds_id
        ds.type = DatasourceType.TABLE
        ds.is_rls_supported = True
        ds.get_sqla_row_level_filters = MagicMock(return_value=[f"filter_ds_{ds_id}"])
        return ds

    ds_a = make_datasource(5)
    ds_b = make_datasource(3)
    ds_c = make_datasource(9)

    user = User(id=1, username="1")

    digests = []
    for ordering in [[ds_a, ds_b, ds_c], [ds_c, ds_a, ds_b], [ds_b, ds_c, ds_a]]:
        with (
            patch.dict(
                current_app.config,
                {
                    "THUMBNAIL_EXECUTORS": [ExecutorType.CURRENT_USER],
                    "THUMBNAIL_DASHBOARD_DIGEST_FUNC": None,
                },
            ),
            patch.object(
                type(dashboard),
                "datasources",
                new_callable=PropertyMock,
                return_value=ordering,
            ),
            patch.object(security_manager, "find_user", return_value=user),
            patch.object(security_manager, "prefetch_rls_filters", return_value=None),
            override_user(user),
        ):
            digests.append(get_dashboard_digest(dashboard=dashboard))

    assert digests[0] == digests[1] == digests[2]
    assert digests[0] is not None


def test_dashboard_digest_prefetches_rls_filters(
    app_context: None,
) -> None:
    """
    Test that _adjust_string_with_rls calls prefetch_rls_filters with
    table IDs from RLS-supporting datasources before iterating.
    """
    from superset import security_manager
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.thumbnails.digest import get_dashboard_digest

    kwargs = {**_DEFAULT_DASHBOARD_KWARGS}
    slices = [Slice(**slice_kwargs) for slice_kwargs in kwargs.pop("slices")]
    dashboard = Dashboard(**kwargs, slices=slices)

    datasources = []
    for ds_id, rls_supported in [(10, True), (20, True), (30, False)]:
        ds = MagicMock(spec=BaseDatasource)
        ds.id = ds_id
        ds.is_rls_supported = rls_supported
        ds.get_sqla_row_level_filters = MagicMock(return_value=[])
        datasources.append(ds)

    user = User(id=1, username="1")

    with (
        patch.dict(
            current_app.config,
            {
                "THUMBNAIL_EXECUTORS": [ExecutorType.CURRENT_USER],
                "THUMBNAIL_DASHBOARD_DIGEST_FUNC": None,
            },
        ),
        patch.object(
            type(dashboard),
            "datasources",
            new_callable=PropertyMock,
            return_value=datasources,
        ),
        patch.object(security_manager, "find_user", return_value=user),
        patch.object(security_manager, "prefetch_rls_filters") as mock_prefetch,
        override_user(user),
    ):
        get_dashboard_digest(dashboard=dashboard)
        # Should be called with only the RLS-supporting datasource IDs
        mock_prefetch.assert_called_once_with([10, 20])
