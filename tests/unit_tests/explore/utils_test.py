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
from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import User
from pytest import raises
from pytest_mock import MockFixture

from superset.charts.commands.exceptions import (
    ChartAccessDeniedError,
    ChartNotFoundError,
)
from superset.commands.exceptions import (
    DatasourceNotFoundValidationError,
    DatasourceTypeInvalidError,
    OwnersNotFoundValidationError,
    QueryNotFoundValidationError,
)
from superset.datasets.commands.exceptions import (
    DatasetAccessDeniedError,
    DatasetNotFoundError,
)
from superset.exceptions import SupersetSecurityException
from superset.utils.core import DatasourceType

dataset_find_by_id = "superset.datasets.dao.DatasetDAO.find_by_id"
query_find_by_id = "superset.queries.dao.QueryDAO.find_by_id"
chart_find_by_id = "superset.charts.dao.ChartDAO.find_by_id"
is_user_admin = "superset.explore.utils.is_user_admin"
is_owner = "superset.explore.utils.is_owner"
can_access_datasource = (
    "superset.security.SupersetSecurityManager.can_access_datasource"
)
can_access = "superset.security.SupersetSecurityManager.can_access"
raise_for_access = "superset.security.SupersetSecurityManager.raise_for_access"
query_datasources_by_name = (
    "superset.connectors.sqla.models.SqlaTable.query_datasources_by_name"
)


def test_unsaved_chart_no_dataset_id(app_context: AppContext) -> None:
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasourceNotFoundValidationError):
        check_chart_access(
            datasource_id=0,
            chart_id=0,
            actor=User(),
            datasource_type=DatasourceType.TABLE,
        )


def test_unsaved_chart_unknown_dataset_id(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasetNotFoundError):
        mocker.patch(dataset_find_by_id, return_value=None)
        check_chart_access(
            datasource_id=1,
            chart_id=0,
            actor=User(),
            datasource_type=DatasourceType.TABLE,
        )


def test_unsaved_chart_unknown_query_id(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.explore.utils import check_access as check_chart_access

    with raises(QueryNotFoundValidationError):
        mocker.patch(query_find_by_id, return_value=None)
        check_chart_access(
            datasource_id=1,
            chart_id=0,
            actor=User(),
            datasource_type=DatasourceType.QUERY,
        )


def test_unsaved_chart_unauthorized_dataset(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasetAccessDeniedError):
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=False)
        check_chart_access(
            datasource_id=1,
            chart_id=0,
            actor=User(),
            datasource_type=DatasourceType.TABLE,
        )


def test_unsaved_chart_authorized_dataset(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    check_chart_access(
        datasource_id=1,
        chart_id=0,
        actor=User(),
        datasource_type=DatasourceType.TABLE,
    )


def test_saved_chart_unknown_chart_id(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    with raises(ChartNotFoundError):
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=True)
        mocker.patch(chart_find_by_id, return_value=None)
        check_chart_access(
            datasource_id=1,
            chart_id=1,
            actor=User(),
            datasource_type=DatasourceType.TABLE,
        )


def test_saved_chart_unauthorized_dataset(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasetAccessDeniedError):
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=False)
        check_chart_access(
            datasource_id=1,
            chart_id=1,
            actor=User(),
            datasource_type=DatasourceType.TABLE,
        )


def test_saved_chart_is_admin(mocker: MockFixture, app_context: AppContext) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_user_admin, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())
    check_chart_access(
        datasource_id=1,
        chart_id=1,
        actor=User(),
        datasource_type=DatasourceType.TABLE,
    )


def test_saved_chart_is_owner(mocker: MockFixture, app_context: AppContext) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_user_admin, return_value=False)
    mocker.patch(is_owner, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())
    check_chart_access(
        datasource_id=1,
        chart_id=1,
        actor=User(),
        datasource_type=DatasourceType.TABLE,
    )


def test_saved_chart_has_access(mocker: MockFixture, app_context: AppContext) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_user_admin, return_value=False)
    mocker.patch(is_owner, return_value=False)
    mocker.patch(can_access, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())
    check_chart_access(
        datasource_id=1,
        chart_id=1,
        actor=User(),
        datasource_type=DatasourceType.TABLE,
    )


def test_saved_chart_no_access(mocker: MockFixture, app_context: AppContext) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    with raises(ChartAccessDeniedError):
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=True)
        mocker.patch(is_user_admin, return_value=False)
        mocker.patch(is_owner, return_value=False)
        mocker.patch(can_access, return_value=False)
        mocker.patch(chart_find_by_id, return_value=Slice())
        check_chart_access(
            datasource_id=1,
            chart_id=1,
            actor=User(),
            datasource_type=DatasourceType.TABLE,
        )


def test_dataset_has_access(mocker: MockFixture, app_context: AppContext) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_datasource_access

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_user_admin, return_value=False)
    mocker.patch(is_owner, return_value=False)
    mocker.patch(can_access, return_value=True)
    assert (
        check_datasource_access(
            datasource_id=1,
            datasource_type=DatasourceType.TABLE,
        )
        == True
    )


def test_query_has_access(mocker: MockFixture, app_context: AppContext) -> None:
    from superset.explore.utils import check_datasource_access
    from superset.models.sql_lab import Query

    mocker.patch(query_find_by_id, return_value=Query())
    mocker.patch(raise_for_access, return_value=True)
    mocker.patch(is_user_admin, return_value=False)
    mocker.patch(is_owner, return_value=False)
    mocker.patch(can_access, return_value=True)
    assert (
        check_datasource_access(
            datasource_id=1,
            datasource_type=DatasourceType.QUERY,
        )
        == True
    )


def test_query_no_access(mocker: MockFixture, client, app_context: AppContext) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_datasource_access
    from superset.models.core import Database
    from superset.models.sql_lab import Query

    with raises(SupersetSecurityException):
        mocker.patch(
            query_find_by_id,
            return_value=Query(database=Database(), sql="select * from foo"),
        )
        table = SqlaTable()
        table.owners = []
        mocker.patch(query_datasources_by_name, return_value=[table])
        mocker.patch(is_user_admin, return_value=False)
        mocker.patch(is_owner, return_value=False)
        mocker.patch(can_access, return_value=False)
        check_datasource_access(
            datasource_id=1,
            datasource_type=DatasourceType.QUERY,
        )
