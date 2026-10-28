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
from unittest.mock import Mock

import pytest
from pytest_mock import MockerFixture

from superset.commands.explore.get import _authorize_datasource
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from superset.models.sql_lab import Query


def test_query_datasource_uses_authorship_bypass(mocker: MockerFixture) -> None:
    """
    Regression for #39296: ``superset.explore.utils.check_query_access``
    already applies the query-authorship bypass to the form-data POST that
    backs "Create Chart", but ``GetExploreCommand`` (the Explore page GET
    that follows it) called ``raise_for_access(datasource=...)`` directly.
    That routes a "query" datasource into ``raise_for_access``'s generic
    ``datasource=`` branch, which never looks at authorship at all -- so
    the same query author who just cleared the form-data check would still
    get a 403 the moment the Explore page itself loaded. A ``Query``
    datasource must instead be routed through
    ``raise_for_access(query=..., allow_query_authorship_bypass=True)``.
    """
    query = Query(id=1)
    mock_sm = mocker.patch("superset.commands.explore.get.security_manager")

    _authorize_datasource(query, None)

    # Editorship of a dataset named after a table the query reads is a decoy
    # any dataset creator can make, so it must not authorize the query.
    mock_sm.raise_for_access.assert_called_once_with(
        query=query,
        datasource=query,
        allow_query_authorship_bypass=True,
        allow_editorship=False,
    )


def test_query_datasource_still_reaches_extra_bypass_hook(
    app_context: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    ``EXTRA_RAISE_FOR_ACCESS_BYPASS`` callbacks only ever receive the
    resource under ``datasource`` (there is no ``query`` kwarg in that hook
    call), and before the authorship reroute the Explore GET handed them the
    SQL Lab ``Query`` that way. Rerouting through ``query=`` alone would
    leave that argument ``None`` and silently bypass a deployment's custom
    grant, so the Query must still arrive at the hook as ``datasource``.
    """
    from flask import current_app

    query = Query(id=1)
    bypass_mock = Mock(return_value=True)
    monkeypatch.setitem(
        current_app.config, "EXTRA_RAISE_FOR_ACCESS_BYPASS", bypass_mock
    )

    _authorize_datasource(query, None)

    assert bypass_mock.call_count == 1
    assert bypass_mock.call_args.kwargs["datasource"] is query


def test_saved_chart_path_unaffected(mocker: MockerFixture) -> None:
    """A saved chart keeps going through the chart-based access check."""
    slc = Slice(datasource_id=1, datasource_type="table")
    mock_sm = mocker.patch("superset.commands.explore.get.security_manager")

    _authorize_datasource(SqlaTable(id=1), slc)

    mock_sm.raise_for_access.assert_called_once_with(chart=slc)


def test_saved_chart_with_other_query_checks_the_query(
    mocker: MockerFixture,
) -> None:
    """
    ``form_data`` in the request overrides the chart's saved datasource, so
    ``?slice_id=<chart>&form_data={"datasource": "<id>__query"}`` resolves to
    a SQL Lab query the chart doesn't use. Access to the chart must not
    authorize it: the query goes through the same check as without a chart.
    """
    slc = Slice(datasource_id=1, datasource_type="table")
    query = Query(id=1)
    mock_sm = mocker.patch("superset.commands.explore.get.security_manager")

    _authorize_datasource(query, slc)

    assert mock_sm.raise_for_access.call_args_list == [
        mocker.call(chart=slc),
        mocker.call(
            query=query,
            datasource=query,
            allow_query_authorship_bypass=True,
            allow_editorship=False,
        ),
    ]


def test_saved_chart_with_other_dataset_checks_the_dataset(
    mocker: MockerFixture,
) -> None:
    """A dataset the chart doesn't use needs its own datasource check."""
    slc = Slice(datasource_id=1, datasource_type="table")
    dataset = SqlaTable(id=2)
    mock_sm = mocker.patch("superset.commands.explore.get.security_manager")

    _authorize_datasource(dataset, slc)

    assert mock_sm.raise_for_access.call_args_list == [
        mocker.call(chart=slc),
        mocker.call(datasource=dataset),
    ]


def test_explore_with_slice_denies_query_from_form_data(
    mocker: MockerFixture,
) -> None:
    """
    End to end through ``GetExploreCommand.run()``: a readable chart plus a
    ``form_data`` that points at another user's query is denied instead of
    returning the query's SQL.
    """
    from superset.commands.explore.get import GetExploreCommand
    from superset.commands.explore.parameters import CommandParameters
    from superset.exceptions import SupersetSecurityException

    slc = Slice(id=10, datasource_id=1, datasource_type="table")
    query = Query(id=7, sql="SELECT secret FROM public.customer_pii")
    mocker.patch(
        "superset.commands.explore.get.get_form_data",
        return_value=({"slice_id": 10, "datasource": "7__query"}, slc),
    )
    mocker.patch(
        "superset.commands.explore.get.DatasourceDAO.get_datasource",
        return_value=query,
    )
    mock_sm = mocker.patch(
        "superset.commands.explore.get.security_manager", new_callable=Mock
    )

    def raise_for_access(**kwargs: object) -> None:
        if "query" in kwargs:
            raise SupersetSecurityException(mocker.MagicMock())

    mock_sm.raise_for_access.side_effect = raise_for_access

    command = GetExploreCommand(
        CommandParameters(
            permalink_key=None,
            form_data_key=None,
            datasource_id=None,
            datasource_type=None,
            slice_id=10,
        )
    )
    with pytest.raises(SupersetSecurityException):
        command.run()

    mock_sm.raise_for_access.assert_any_call(chart=slc)


def test_table_datasource_path_unaffected(mocker: MockerFixture) -> None:
    """A registered dataset keeps going through the generic datasource check."""
    dataset = SqlaTable()
    mock_sm = mocker.patch("superset.commands.explore.get.security_manager")

    _authorize_datasource(dataset, None)

    mock_sm.raise_for_access.assert_called_once_with(datasource=dataset)
