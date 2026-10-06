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

"""Semantic views refuse requests that carry applicable guest RLS (MVP)."""

from collections.abc import Callable
from unittest.mock import MagicMock, PropertyMock

import pandas as pd
import pyarrow as pa
import pytest
from flask import g
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, literal, select, union_all
from sqlalchemy.engine import Engine
from sqlalchemy.sql.selectable import Subquery
from superset_core.semantic_layers.types import Dimension, SemanticResult
from werkzeug.test import TestResponse

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.chart_data_timing import QueryAcquisitionResult
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import SupersetSecurityException
from superset.extensions import feature_flag_manager, security_manager
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.helpers import QueryResult
from superset.security.guest_token import GuestToken, GuestTokenRlsRule, GuestUser
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.utils import json


def set_guest(rules: list[GuestTokenRlsRule]) -> None:
    """Install an actual guest principal so rule selection stays unmocked."""
    token: GuestToken = {
        "user": {},
        "resources": [],
        "rls_rules": rules,
        "iat": 0,
        "exp": 1,
    }
    g.user = GuestUser(token=token, roles=[])


@pytest.fixture
def provider(mocker: MockerFixture) -> MagicMock:
    """The provider returns rows unless the request is refused."""
    implementation: MagicMock = MagicMock()
    implementation.features = frozenset()
    # An unversioned view, so value suggestions are served normally.
    implementation.selection_identity_version = None
    implementation.uid.return_value = "guest-rls-view"
    implementation.get_dimensions.return_value = {
        Dimension("category", "category", pa.string()),
    }
    implementation.get_metrics.return_value = set()
    implementation.get_table.return_value = SemanticResult(
        requests=[],
        results=pa.table({"category": ["a", "b"]}),
    )
    mocker.patch.object(
        SemanticView,
        "implementation",
        new_callable=PropertyMock,
        return_value=implementation,
    )
    return implementation


def view_query(view: SemanticView) -> QueryObject:
    """Construct a real query object without provider metadata resolution."""
    return QueryObject(datasource=view, columns=["category"], metrics=[], row_limit=10)


@pytest.mark.parametrize("scope", [None, "7", "99"])
def test_semantic_execution_rejects_applicable_guest_rls(
    provider: MagicMock,
    scope: str | None,
) -> None:
    """Global/matching clauses block execution; unrelated clauses do not."""
    set_guest([GuestTokenRlsRule(dataset=scope, clause="category = 'a'")])
    view: SemanticView = SemanticView(id=7, name="rows")
    query: QueryObject = view_query(view)
    if scope != "99":
        with pytest.raises(
            SupersetSecurityException, match="cannot enforce guest row-level"
        ):
            view.get_query_result(query)
        provider.get_table.assert_not_called()
        provider.get_dimensions.assert_not_called()
    else:
        result: QueryResult = view.get_query_result(query)
        assert list(result.df["category"]) == ["a", "b"]
        provider.get_table.assert_called_once()


@pytest.mark.parametrize("guest", [False, True])
def test_semantic_execution_without_guest_rls_is_unchanged(
    provider: MagicMock,
    guest: bool,
) -> None:
    """Non-guests and guests without RLS retain semantic execution."""
    if guest:
        set_guest([])
    view: SemanticView = SemanticView(id=7, name="rows")
    result: QueryResult = view.get_query_result(view_query(view))
    assert list(result.df["category"]) == ["a", "b"]
    provider.get_table.assert_called_once()


@pytest.mark.parametrize("entrypoint", ["model", "manager", "context"])
def test_semantic_access_grants_still_refuse_guest_rls(
    mocker: MockerFixture,
    entrypoint: str,
) -> None:
    """Dataset/layer/global read grants do not waive guest row restrictions."""
    set_guest([GuestTokenRlsRule(dataset=None, clause="category = 'a'")])
    view: SemanticView = SemanticView(id=7, name="rows", perm="view-perm")
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    )
    mocker.patch.object(security_manager, "can_access_schema", return_value=True)
    context: MagicMock = MagicMock(datasource=view, form_data=None, queries=[])
    check_access: Callable[[], None] = {
        "model": view.raise_for_access,
        "manager": lambda: security_manager.raise_for_access(datasource=view),
        "context": lambda: security_manager.raise_for_access(query_context=context),
    }[entrypoint]
    with pytest.raises(
        SupersetSecurityException, match="cannot enforce guest row-level"
    ):
        check_access()


@pytest.mark.parametrize("force_cached", [False, True])
@pytest.mark.parametrize("scope", [None, "7", "99", "absent"])
def test_semantic_cached_payload_rejected_before_cache_read(
    mocker: MockerFixture,
    provider: MagicMock,
    force_cached: bool,
    scope: str | None,
) -> None:
    """Worker execution and cache-only reads reject before touching cached rows."""
    set_guest(
        []
        if scope == "absent"
        else [GuestTokenRlsRule(dataset=scope, clause="category = 'a'")]
    )
    view: SemanticView = SemanticView(id=7, name="rows")
    query: QueryObject = view_query(view)
    view.semantic_layer = SemanticLayer(name="rls-layer")
    context: QueryContext = QueryContext(
        datasource=view,
        queries=[query],
        slice_=None,
        form_data=None,
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
        cache_values={},
    )
    cache: MagicMock = mocker.patch(
        "superset.common.query_context_processor.QueryCacheManager.get",
    )
    cache.return_value.is_loaded = True
    cache.return_value.is_cached = True
    cache.return_value.df = pd.DataFrame({"category": ["a", "b"]})
    cache.return_value.applied_filter_columns = []
    cache.return_value.applied_template_filters = []
    cache.return_value.rejected_filter_columns = []
    cache.return_value.sql_rowcount = 2
    cache.return_value.bq_memory_limited = False
    cache.return_value.bq_memory_limited_row_count = None
    mocker.patch.object(context._processor, "get_cache_timeout", return_value=300)
    if scope in (None, "7"):
        extra_cache_keys: MagicMock = mocker.patch.object(
            view,
            "get_extra_cache_keys",
            side_effect=AssertionError("Guest RLS must precede extra cache keys"),
        )
        with pytest.raises(
            SupersetSecurityException, match="cannot enforce guest row-level"
        ):
            context.get_df_payload_result(query, force_cached=force_cached)
        extra_cache_keys.assert_not_called()
        cache.assert_not_called()
        provider.uid.assert_not_called()
    else:
        result: QueryAcquisitionResult = context.get_df_payload_result(
            query,
            force_cached=force_cached,
        )
        assert list(result.payload["df"]["category"]) == ["a", "b"]
        assert result.payload["is_cached"] is True
        cache.assert_called_once()
    provider.get_table.assert_not_called()


@pytest.mark.parametrize("scope", [None, "7", "99"])
def test_sql_dataset_guest_rls_still_filters_rows(
    mocker: MockerFixture,
    scope: str | None,
) -> None:
    """Run the SQL predicate produced with real guest-rule selection in SQLite."""
    set_guest([GuestTokenRlsRule(dataset=scope, clause="category = 'a'")])
    table: SqlaTable = SqlaTable(
        id=7,
        table_name="rows",
        database=Database(database_name="rls-parity", sqlalchemy_uri="sqlite://"),
    )
    # Keep the same SQL control runnable on the base, which reads data["id"].
    mocker.patch.object(
        SqlaTable, "data", new_callable=PropertyMock, return_value={"id": 7}
    )
    mocker.patch.object(security_manager, "get_rls_filters", return_value=[])
    mocker.patch(
        "superset.connectors.sqla.models.is_feature_enabled", return_value=True
    )
    template: MagicMock = MagicMock()
    template.process_template.side_effect = lambda clause: clause
    mocker.patch.object(table, "get_template_processor", return_value=template)
    engine: Engine = create_engine("sqlite://")
    try:
        with engine.connect() as connection:
            rows: Subquery = union_all(
                select(literal("a").label("category")),
                select(literal("b").label("category")),
            ).subquery()
            result: list[str] = list(
                connection.execute(
                    select(rows.c.category).where(*table.get_sqla_row_level_filters()),
                ).scalars()
            )
        assert result == (["a", "b"] if scope == "99" else ["a"])
    finally:
        engine.dispose()


def test_scoped_guest_rule_selection_does_not_load_semantic_metadata(
    mocker: MockerFixture,
) -> None:
    """A scoped rule can be selected from the persisted ID alone."""
    rule: GuestTokenRlsRule = {"dataset": "7", "clause": "category = 'a'"}
    set_guest([rule])
    view: SemanticView = SemanticView(id=7, name="rows")
    metadata: PropertyMock = mocker.patch.object(
        SemanticView,
        "data",
        new_callable=PropertyMock,
        side_effect=AssertionError("Provider metadata must not be loaded"),
    )
    assert security_manager.get_guest_rls_filters(view) == [rule]
    metadata.assert_not_called()


@pytest.mark.parametrize("scope", [None, "7", "99"])
def test_guest_values_endpoint_rejects_rls_before_warm_cache(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    provider: MagicMock,
    scope: str | None,
) -> None:
    """The HTTP values route denies restricted guests before cached values or I/O."""
    set_guest([GuestTokenRlsRule(dataset=scope, clause="category = 'a'")])
    guest: GuestUser = g.user
    mocker.patch.object(
        feature_flag_manager,
        "is_feature_enabled",
        side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
    )
    # Replace token verification only; request loading and object guards stay real.
    loader: MagicMock = mocker.patch.object(
        security_manager,
        "get_guest_user_from_request",
        return_value=guest,
    )
    view: SemanticView = SemanticView(
        id=7,
        name="rows",
        semantic_layer=SemanticLayer(name="rls-layer"),
    )
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource", return_value=view
    )
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    )
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = ["a", "b"]
    response: TestResponse = client.get(
        "/api/v1/datasource/semantic_view/7/column/category/values/",
        headers={"X-GuestToken": "unit-test-token"},
    )
    loader.assert_called_once()
    if scope == "99":
        assert response.status_code == 200
        assert response.json["result"] == ["a", "b"]
        assert response.headers["X-Cache-Status"] == "HIT"
        cache.get.assert_called_once()
    else:
        assert response.status_code == 403
        assert "cannot enforce guest row-level" in response.json["message"]
        cache.get.assert_not_called()
        provider.uid.assert_not_called()
    provider.get_values.assert_not_called()


@pytest.mark.parametrize("with_rls", [False, True])
def test_embedding_enabled_native_filter_respects_guest_rls(
    mocker: MockerFixture,
    provider: MagicMock,
    with_rls: bool,
) -> None:
    """Real guest payload validation and a dashboard grant cannot waive RLS."""
    set_guest(
        [GuestTokenRlsRule(dataset=None, clause="category = 'a'")] if with_rls else []
    )
    mocker.patch(
        "superset.is_feature_enabled",
        side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
    )
    assert security_manager.is_guest_user()
    view: SemanticView = SemanticView(
        id=7, name="rows", semantic_layer=SemanticLayer(name="layer")
    )
    dashboard: Dashboard = Dashboard(
        id=20,
        json_metadata=json.dumps(
            {
                "native_filter_configuration": [
                    {
                        "id": "F1",
                        "targets": [
                            {
                                "datasetId": 7,
                                "datasourceType": "semantic_view",
                                "column": {"name": "category"},
                            }
                        ],
                    }
                ],
            }
        ),
    )
    mocker.patch.object(
        security_manager.session, "query"
    ).return_value.filter.return_value.one_or_none.return_value = dashboard
    mocker.patch.object(security_manager, "can_access_schema", return_value=False)
    mocker.patch.object(security_manager, "can_access", return_value=False)
    mocker.patch.object(security_manager, "is_editor", return_value=False)
    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    context: QueryContext = QueryContext(
        datasource=view,
        queries=[view_query(view)],
        slice_=None,
        form_data={
            "dashboardId": 20,
            "type": "NATIVE_FILTER",
            "native_filter_id": "F1",
        },
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
        cache_values={},
    )
    if with_rls:
        with pytest.raises(
            SupersetSecurityException, match="cannot enforce guest row-level"
        ):
            context.raise_for_access()
    else:
        context.raise_for_access()
    provider.get_table.assert_not_called()
