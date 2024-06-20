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
from pytest import raises
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
is_owner = "superset.security.SupersetSecurityManager.is_owner"
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

    with raises(DatasetNotFoundError):
        mocker.patch(dataset_find_by_id, return_value=None)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=0,
                datasource_type=DatasourceType.TABLE,
            )


def test_unsaved_chart_unknown_query_id(mocker: MockerFixture) -> None:
    from superset.explore.utils import check_access as check_chart_access

    with raises(QueryNotFoundValidationError):
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

    with raises(DatasetAccessDeniedError):
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

    with raises(ChartNotFoundError):
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

    with raises(DatasetAccessDeniedError):
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


def test_saved_chart_is_owner(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_owner, return_value=True)
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
    mocker.patch(is_owner, return_value=False)
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

    with raises(ChartAccessDeniedError):
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=True)
        mocker.patch(is_admin, return_value=False)
        mocker.patch(is_owner, return_value=False)
        mocker.patch(can_access, return_value=False)
        mocker.patch(chart_find_by_id, return_value=Slice())

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
    mocker.patch(is_owner, return_value=False)
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
    mocker.patch(is_owner, return_value=False)
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
    mocker.patch(is_owner, return_value=False)
    mocker.patch(can_access, return_value=False)

    with raises(SupersetSecurityException):
        check_datasource_access(
            datasource_id=1,
            datasource_type=DatasourceType.QUERY,
        )
