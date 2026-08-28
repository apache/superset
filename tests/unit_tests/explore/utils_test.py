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
from flask_appbuilder.security.sqla.models import User
from pytest import raises  # noqa: PT013
from pytest_mock import MockerFixture

from superset.commands.chart.exceptions import (
    ChartAccessDeniedError,
    ChartNotFoundError,
)
from superset.commands.dataset.exceptions import (
    DatasetAccessDeniedError,
    DatasetNotFoundError,
)
from superset.commands.exceptions import (
    DatasourceNotFoundValidationError,
    QueryNotFoundValidationError,
)
from superset.exceptions import SupersetSecurityException
from superset.utils.core import DatasourceType, override_user

dataset_find_by_id = "superset.daos.dataset.DatasetDAO.find_by_id"
query_find_by_id = "superset.daos.query.QueryDAO.find_by_id"
chart_find_by_id = "superset.daos.chart.ChartDAO.find_by_id"
is_admin = "superset.security.SupersetSecurityManager.is_admin"
is_editor = "superset.security.SupersetSecurityManager.is_editor"
can_access_datasource = (
    "superset.security.SupersetSecurityManager.can_access_datasource"
)
can_access = "superset.security.SupersetSecurityManager.can_access"
raise_for_access = "superset.security.SupersetSecurityManager.raise_for_access"
query_datasources_by_name = (
    "superset.connectors.sqla.models.SqlaTable.query_datasources_by_name"
)


def test_unsaved_chart_no_dataset_id() -> None:
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasourceNotFoundValidationError):
        with override_user(User()):
            check_chart_access(
                datasource_id=0,
                chart_id=0,
                datasource_type=DatasourceType.TABLE,
            )


def test_unsaved_chart_unknown_dataset_id(mocker: MockerFixture) -> None:
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasetNotFoundError):  # noqa: PT012
        mocker.patch(dataset_find_by_id, return_value=None)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=0,
                datasource_type=DatasourceType.TABLE,
            )


def test_unsaved_chart_unknown_query_id(mocker: MockerFixture) -> None:
    from superset.explore.utils import check_access as check_chart_access

    with raises(QueryNotFoundValidationError):  # noqa: PT012
        mocker.patch(query_find_by_id, return_value=None)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=0,
                datasource_type=DatasourceType.QUERY,
            )


def test_unsaved_chart_unauthorized_dataset(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasetAccessDeniedError):  # noqa: PT012
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=False)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=0,
                datasource_type=DatasourceType.TABLE,
            )


def test_unsaved_chart_authorized_dataset(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)

    with override_user(User()):
        check_chart_access(
            datasource_id=1,
            chart_id=0,
            datasource_type=DatasourceType.TABLE,
        )


def test_saved_chart_unknown_chart_id(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    with raises(ChartNotFoundError):  # noqa: PT012
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=True)
        mocker.patch(chart_find_by_id, return_value=None)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=1,
                datasource_type=DatasourceType.TABLE,
            )


def test_saved_chart_unauthorized_dataset(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasetAccessDeniedError):  # noqa: PT012
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=False)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=1,
                datasource_type=DatasourceType.TABLE,
            )


def test_saved_chart_is_admin(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())

    with override_user(User()):
        check_chart_access(
            datasource_id=1,
            chart_id=1,
            datasource_type=DatasourceType.TABLE,
        )


def test_saved_chart_is_editor(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())

    with override_user(User()):
        check_chart_access(
            datasource_id=1,
            chart_id=1,
            datasource_type=DatasourceType.TABLE,
        )


def test_saved_chart_has_access(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())

    with override_user(User()):
        check_chart_access(
            datasource_id=1,
            chart_id=1,
            datasource_type=DatasourceType.TABLE,
        )


def test_saved_chart_no_access(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    with raises(ChartAccessDeniedError):  # noqa: PT012
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=True)
        mocker.patch(is_admin, return_value=False)
        mocker.patch(is_editor, return_value=False)
        mocker.patch(can_access, return_value=False)
        mocker.patch(chart_find_by_id, return_value=Slice())

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=1,
                datasource_type=DatasourceType.TABLE,
            )


def test_drill_by_access_without_can_explore(mocker: MockerFixture) -> None:
    """
    Regression for #27900: performing Drill By (and Drill to Detail) must not
    require the broad ``can explore on Superset`` permission.

    ``check_access`` is the backend access gate for the Drill By flow: it is
    invoked by ``CreateFormDataCommand`` when the client stores the drill
    ``form_data`` via ``ExploreFormDataRestApi`` (the endpoint commenters on the
    issue identified as drill-by-specific). This test grants the granular
    ``can read on Chart`` permission while *explicitly denying*
    ``can explore on Superset`` and asserts that access is still granted.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    def can_access_side_effect(permission: str, view_menu: str) -> bool:
        # The broad explore permission is denied; only the granular chart-read
        # permission is granted.
        if (permission, view_menu) == ("can_explore", "Superset"):
            return False
        return (permission, view_menu) == ("can_read", "Chart")

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, side_effect=can_access_side_effect)
    mocker.patch(chart_find_by_id, return_value=Slice())

    with override_user(User()):
        assert (
            check_chart_access(  # noqa: E712
                datasource_id=1,
                chart_id=1,
                datasource_type=DatasourceType.TABLE,
            )
            is True
        )


def test_drill_by_access_can_explore_is_not_the_gate(mocker: MockerFixture) -> None:
    """
    Regression for #27900: ``can explore on Superset`` is neither necessary nor
    sufficient for Drill By access. Here the user holds *only*
    ``can explore on Superset`` (the granular ``can read on Chart`` is denied and
    the user is not an owner/admin) and access must be refused, proving the gate
    is governed by the granular chart permission rather than ``can explore``.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    def can_access_side_effect(permission: str, view_menu: str) -> bool:
        # Only the broad explore permission is granted; the granular chart-read
        # permission is denied.
        return (permission, view_menu) == ("can_explore", "Superset")

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, side_effect=can_access_side_effect)
    mocker.patch(chart_find_by_id, return_value=Slice())

    with raises(ChartAccessDeniedError):  # noqa: PT012
        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=1,
                datasource_type=DatasourceType.TABLE,
            )


def test_dataset_has_access(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_datasource_access

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, return_value=True)
    assert (
        check_datasource_access(  # noqa: E712
            datasource_id=1,
            datasource_type=DatasourceType.TABLE,
        )
        is True
    )


def test_query_has_access(mocker: MockerFixture) -> None:
    from superset.explore.utils import check_datasource_access
    from superset.models.sql_lab import Query

    mocker.patch(query_find_by_id, return_value=Query())
    mocker.patch(raise_for_access, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, return_value=True)
    assert (
        check_datasource_access(  # noqa: E712
            datasource_id=1,
            datasource_type=DatasourceType.QUERY,
        )
        is True
    )


def test_query_no_access(mocker: MockerFixture, client) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_datasource_access
    from superset.models.sql_lab import Query

    database = mocker.MagicMock()
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    mocker.patch(
        query_find_by_id,
        return_value=Query(database=database, sql="select * from foo"),
    )
    mocker.patch(query_datasources_by_name, return_value=[SqlaTable()])
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, return_value=False)

    with raises(SupersetSecurityException):
        check_datasource_access(
            datasource_id=1,
            datasource_type=DatasourceType.QUERY,
        )
