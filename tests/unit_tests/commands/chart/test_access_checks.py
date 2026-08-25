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
"""Unit tests for per-object datasource access checks in chart create/update."""

from unittest.mock import MagicMock, patch

import pytest

from superset import security_manager
from superset.commands.chart.exceptions import ChartForbiddenError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database
from superset.models.sql_lab import SavedQuery


def _security_exception() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            message="Access denied",
            level=ErrorLevel.ERROR,
        )
    )


# ---------------------------------------------------------------------------
# CreateChartCommand
# ---------------------------------------------------------------------------


def test_create_chart_command_forbidden_when_no_datasource_access() -> None:
    """CreateChartCommand.validate() must raise ChartForbiddenError when the
    caller lacks access to the chart's datasource."""
    from superset.commands.chart.create import CreateChartCommand

    with patch(
        "superset.commands.chart.create.get_datasource_by_id",
        return_value=MagicMock(name="datasource"),
    ):
        with patch(
            "superset.commands.chart.create.security_manager.raise_for_access",
            side_effect=_security_exception(),
        ):
            with patch(
                "superset.commands.chart.create.populate_subjects",
                return_value=[],
            ):
                command = CreateChartCommand(
                    {
                        "slice_name": "test",
                        "viz_type": "bar",
                        "datasource_id": 1,
                        "datasource_type": "table",
                    }
                )
                with pytest.raises(ChartForbiddenError):
                    command.validate()


def test_create_chart_command_allowed_when_access_passes() -> None:
    """CreateChartCommand.validate() must not raise when the caller has access."""
    from superset.commands.chart.create import CreateChartCommand

    mock_datasource = MagicMock()
    mock_datasource.name = "test_table"

    with patch(
        "superset.commands.chart.create.get_datasource_by_id",
        return_value=mock_datasource,
    ):
        with patch("superset.commands.chart.create.security_manager.raise_for_access"):
            with patch(
                "superset.commands.chart.create.populate_subjects",
                return_value=[],
            ):
                with patch(
                    "superset.commands.chart.create.DashboardDAO.find_by_ids",
                    return_value=[],
                ):
                    command = CreateChartCommand(
                        {
                            "slice_name": "test",
                            "viz_type": "bar",
                            "datasource_id": 1,
                            "datasource_type": "table",
                        }
                    )
                    command.validate()  # should not raise


def test_create_chart_command_supports_saved_query_datasource() -> None:
    """CreateChartCommand.validate() must populate ``datasource_name`` for a
    ``saved_query`` datasource, which exposes ``label`` rather than ``name``.

    Regression test for https://github.com/apache/superset/issues/29697.
    """
    from superset.commands.chart.create import CreateChartCommand

    saved_query = SavedQuery(label="My saved query")

    with patch(
        "superset.commands.chart.create.get_datasource_by_id",
        return_value=saved_query,
    ):
        with patch("superset.commands.chart.create.security_manager.raise_for_access"):
            with patch(
                "superset.commands.chart.create.populate_subjects",
                return_value=[],
            ):
                with patch(
                    "superset.commands.chart.create.DashboardDAO.find_by_ids",
                    return_value=[],
                ):
                    command = CreateChartCommand(
                        {
                            "slice_name": "test",
                            "viz_type": "bar",
                            "datasource_id": 1,
                            "datasource_type": "saved_query",
                        }
                    )
                    command.validate()  # should not raise AttributeError

    assert command._properties["datasource_name"] == "My saved query"


def test_saved_query_exposes_perm_properties() -> None:
    """``SavedQuery`` must expose ``perm``/``schema_perm``/``catalog_perm`` so
    it can stand in for a generic datasource: ``Slice``'s ``before_insert``/
    ``before_update`` listener (``superset/models/slice.py::set_related_perm``)
    unconditionally reads all three off the resolved datasource when
    persisting a chart, regardless of ``datasource_type``.
    """
    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    saved_query = SavedQuery(
        id=1, label="My saved query", schema="main", database=database
    )

    assert saved_query.perm == "[my_db].[My saved query](id:1)"
    assert saved_query.schema_perm == "my_db.main"
    assert saved_query.catalog_perm is None


def test_saved_query_name_falls_back_when_label_is_none() -> None:
    """``label`` is a nullable column; ``name`` (typed ``str``) must not
    return ``None`` for a saved query that was persisted without one.
    """
    saved_query = SavedQuery(id=7, label=None)

    assert saved_query.name == "Saved query 7"


def test_raise_for_access_does_not_crash_on_saved_query_datasource(
    app_context: None,
) -> None:
    """``SecurityManager.raise_for_access(datasource=...)`` must not raise
    ``AttributeError`` for a ``saved_query`` datasource.

    Regression test for the ``datasource.perm`` lookup performed in the
    non-admin branch of ``raise_for_access`` (previously unreachable for
    ``SavedQuery`` since it had no ``perm`` attribute at all). Called for
    real, without mocking ``raise_for_access`` itself, per the follow-up
    review on https://github.com/apache/superset/issues/29697.
    """
    from flask import g

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    saved_query = SavedQuery(
        id=1, label="My saved query", schema="main", database=database
    )

    non_admin_user = MagicMock(is_anonymous=False, id=99, roles=[])
    g.user = non_admin_user
    try:
        with patch.object(
            security_manager, "can_access_all_datasources", return_value=False
        ):
            with patch.object(security_manager, "can_access", return_value=False):
                # A denied, non-admin caller must be rejected with the expected
                # security exception, not an AttributeError from a missing
                # `.perm`/`.schema_perm` attribute on SavedQuery.
                with pytest.raises(SupersetSecurityException):
                    security_manager.raise_for_access(datasource=saved_query)
    finally:
        del g.user


def test_slice_set_related_perm_does_not_crash_on_saved_query_datasource() -> None:
    """``Slice``'s ``before_insert``/``before_update`` listener
    (``set_related_perm``) unconditionally reads ``perm``/``catalog_perm``/
    ``schema_perm`` off the resolved datasource for *every* chart flush,
    independent of ``datasource_type`` — it must not crash for a
    ``saved_query``-backed chart either.
    """
    from superset.models.slice import set_related_perm, Slice

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    saved_query = SavedQuery(
        id=1, label="My saved query", schema="main", database=database
    )
    slice_ = Slice(datasource_type="saved_query", datasource_id=1)

    with patch("superset.models.slice.db") as mock_db:
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            saved_query  # noqa: E501
        )
        set_related_perm(MagicMock(), MagicMock(), slice_)

    assert slice_.perm == "[my_db].[My saved query](id:1)"
    assert slice_.schema_perm == "my_db.main"
    assert slice_.catalog_perm is None


def test_create_chart_command_delegates_editors_to_subjects() -> None:
    """CreateChartCommand.validate() must resolve editor subject IDs."""
    from superset.commands.chart.create import CreateChartCommand

    mock_datasource = MagicMock()
    mock_datasource.name = "test_table"

    with patch(
        "superset.commands.chart.create.get_datasource_by_id",
        return_value=mock_datasource,
    ):
        with patch("superset.commands.chart.create.security_manager.raise_for_access"):
            with patch(
                "superset.commands.chart.create.DashboardDAO.find_by_ids",
                return_value=[],
            ):
                with patch(
                    "superset.commands.chart.create.populate_subjects",
                    return_value=None,
                ) as populate_subjects:
                    command = CreateChartCommand(
                        {
                            "slice_name": "test",
                            "viz_type": "bar",
                            "datasource_id": 1,
                            "datasource_type": "table",
                            "editors": [7],
                        }
                    )
                    command.validate()

    properties, exceptions = populate_subjects.call_args.args
    assert properties["editors"] == [7]
    assert exceptions == []


# ---------------------------------------------------------------------------
# UpdateChartCommand
# ---------------------------------------------------------------------------


def test_update_chart_command_forbidden_when_no_datasource_access() -> None:
    """UpdateChartCommand.validate() must raise ChartForbiddenError when the
    caller lacks access to the new datasource."""
    from superset.commands.chart.update import UpdateChartCommand

    mock_chart = MagicMock()
    mock_chart.id = 1
    mock_chart.editors = []
    mock_chart.dashboards = []
    mock_chart.tags = []

    with patch(
        "superset.commands.chart.update.ChartDAO.find_by_id",
        return_value=mock_chart,
    ):
        with patch(
            "superset.commands.chart.update.security_manager.raise_for_editorship"
        ):
            with patch(
                "superset.commands.chart.update.compute_subjects",
                return_value=[],
            ):
                with patch("superset.commands.chart.update.validate_tags"):
                    with patch(
                        "superset.commands.chart.update.get_datasource_by_id",
                        return_value=MagicMock(name="datasource"),
                    ):
                        with patch(
                            "superset.commands.chart.update.security_manager.raise_for_access",
                            side_effect=_security_exception(),
                        ):
                            command = UpdateChartCommand(
                                1,
                                {
                                    "datasource_id": 2,
                                    "datasource_type": "table",
                                },
                            )
                            with pytest.raises(ChartForbiddenError):
                                command.validate()
