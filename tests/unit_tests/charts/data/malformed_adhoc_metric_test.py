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
# pylint: disable=import-outside-toplevel

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm.session import Session
from sqlalchemy.pool import StaticPool

if TYPE_CHECKING:
    from superset.models.core import Database

# A Custom SQL ad-hoc metric exactly as Explore serializes it into a
# ``/api/v1/chart/data`` payload. Its auto-derived ``label`` is the SQL text
# itself, which is what makes the downstream failure mode so confusing.
CUSTOM_SQL_METRIC: dict[str, Any] = {
    "expressionType": "SQL",
    "sqlExpression": "count(DISTINCT product_line)",
    "label": "count(DISTINCT product_line)",
    "hasCustomLabel": False,
    "optionName": "metric_abc123",
}

# The same metric with ``expressionType`` absent. Every other key still marks it
# unambiguously as an ad-hoc definition rather than a reference to a metric
# saved on the dataset.
MALFORMED_ADHOC_METRIC: dict[str, Any] = {
    key: value for key, value in CUSTOM_SQL_METRIC.items() if key != "expressionType"
}


def _chart_data_payload(metric: Any) -> dict[str, Any]:
    return {
        "datasource": {"id": 1, "type": "table"},
        "queries": [
            {
                "columns": ["source", "target"],
                "metrics": [metric],
                "row_limit": 100,
            }
        ],
        "result_format": "json",
        "result_type": "full",
    }


def _load_metrics(payload: dict[str, Any]) -> Any:
    """Deserialize a chart data payload the way ``/api/v1/chart/data`` does."""
    from superset.charts.schemas import ChartDataQueryContextSchema

    with patch(
        "superset.common.query_context_factory.DatasourceDAO.get_datasource",
        return_value=MagicMock(),
    ):
        query_context = ChartDataQueryContextSchema().load(payload)
    return query_context.queries[0].metrics


@pytest.fixture
def database(mocker: MockerFixture, session: Session) -> Database:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    database = Database(database_name="db", sqlalchemy_uri="sqlite://")

    connection = engine.raw_connection()
    connection.execute("CREATE TABLE t (product_line TEXT, source TEXT, target TEXT)")
    connection.commit()

    # since we're using an in-memory SQLite database, make sure we always
    # return the same engine where the table was created
    @contextmanager
    def mock_get_sqla_engine(catalog=None, schema=None, **kwargs):
        yield engine

    mocker.patch.object(database, "get_sqla_engine", new=mock_get_sqla_engine)

    return database


def _table(database: Database) -> Any:
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    return SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[
            TableColumn(column_name="product_line"),
            TableColumn(column_name="source"),
            TableColumn(column_name="target"),
        ],
    )


def test_adhoc_metric_without_expression_type_is_not_read_as_a_saved_metric(
    app_context: Any,
) -> None:
    """
    An ad-hoc metric that is missing ``expressionType`` must not be silently
    reinterpreted as a reference to a metric saved on the dataset.

    ``QueryObject._set_metrics`` used to rewrite any metric ``dict`` that was
    not recognized as ad-hoc down to its ``label``, to support the legacy
    ``{"label": "saved_metric_name"}`` reference format. ``is_adhoc_metric``
    recognizes a metric solely by the presence of ``expressionType``, so an
    ad-hoc definition that lacks that one key used to be collapsed into a bare
    string. For a Custom SQL metric the label is the SQL text, so the request
    was then resolved as if the user had asked for a saved metric literally
    named ``count(DISTINCT product_line)``.

    ``ChartDataAdhocMetricSchema`` declares ``expressionType`` as required, but
    ``ChartDataQueryObjectSchema.metrics`` is a list of ``fields.Raw``, so that
    contract is never enforced at the API boundary. ``_set_metrics`` is the
    last point that can tell an ad-hoc-shaped dict apart from a legacy
    reference, so it must reject the malformed shape outright rather than
    guess.
    """
    from superset.exceptions import QueryObjectValidationError

    with pytest.raises(
        QueryObjectValidationError,
        match=r"Invalid ad-hoc metric count\(DISTINCT product_line\): "
        r"`expressionType` is missing",
    ):
        _load_metrics(_chart_data_payload(MALFORMED_ADHOC_METRIC))


def test_malformed_adhoc_metric_surfaces_as_a_missing_saved_metric(
    database: Database,
) -> None:
    """
    Downstream symptom of the coercion above: once the ad-hoc definition has
    been reduced to its label, metric resolution looks the label up among the
    dataset's saved metrics, fails, and reports the SQL text as a metric name.
    """
    from superset.exceptions import QueryObjectValidationError

    with pytest.raises(
        QueryObjectValidationError,
        match=r"Metric 'count\(DISTINCT product_line\)' does not exist",
    ):
        _table(database).get_sqla_query(
            columns=["source", "target"],
            metrics=["count(DISTINCT product_line)"],
            extras={},
            filter=[],
            granularity=None,
            is_timeseries=False,
        )


def test_legacy_label_only_metric_still_resolves_to_a_saved_metric_name(
    app_context: Any,
) -> None:
    """
    Guards the fix from over-correcting: a ``dict`` carrying only ``label`` is
    the documented legacy way to reference a metric saved on the dataset, and
    must keep collapsing to that name.
    """
    metrics = _load_metrics(_chart_data_payload({"label": "sum__num"}))

    assert metrics == ["sum__num"]


def test_well_formed_custom_sql_metric_is_preserved(
    app_context: Any,
    database: Database,
) -> None:
    """
    Guards the fix from over-correcting: with ``expressionType`` present the
    metric stays an ad-hoc definition and builds SQL without consulting the
    dataset's saved metrics.
    """
    metrics = _load_metrics(_chart_data_payload(CUSTOM_SQL_METRIC))

    assert metrics == [CUSTOM_SQL_METRIC]
    assert (
        _table(database).get_sqla_query(
            columns=["source", "target"],
            metrics=metrics,
            extras={},
            filter=[],
            granularity=None,
            is_timeseries=False,
        )
        is not None
    )
