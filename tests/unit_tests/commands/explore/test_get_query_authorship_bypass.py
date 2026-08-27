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

    mock_sm.raise_for_access.assert_called_once_with(
        query=query, allow_query_authorship_bypass=True
    )


def test_saved_chart_path_unaffected(mocker: MockerFixture) -> None:
    """A saved chart keeps going through the chart-based access check."""
    slc = Slice()
    mock_sm = mocker.patch("superset.commands.explore.get.security_manager")

    _authorize_datasource(SqlaTable(), slc)

    mock_sm.raise_for_access.assert_called_once_with(chart=slc)


def test_table_datasource_path_unaffected(mocker: MockerFixture) -> None:
    """A registered dataset keeps going through the generic datasource check."""
    dataset = SqlaTable()
    mock_sm = mocker.patch("superset.commands.explore.get.security_manager")

    _authorize_datasource(dataset, None)

    mock_sm.raise_for_access.assert_called_once_with(datasource=dataset)
