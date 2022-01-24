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
from superset.datasets.commands.exceptions import (
    DatasetAccessDeniedError,
    DatasetNotFoundError,
)
from superset.key_value.commands.parameters import CommandParameters

dataset_find_by_id = "superset.datasets.dao.DatasetDAO.find_by_id"
chart_find_by_id = "superset.charts.dao.ChartDAO.find_by_id"
is_user_admin = "superset.charts.form_data.utils.is_user_admin"
is_owner = "superset.charts.form_data.utils.is_owner"
can_access_datasource = (
    "superset.security.SupersetSecurityManager.can_access_datasource"
)
can_access = "superset.security.SupersetSecurityManager.can_access"


def test_unsaved_chart_no_dataset_id(app_context: AppContext) -> None:
    from superset.charts.form_data.utils import check_access

    with raises(DatasetNotFoundError):
        cmd_params = CommandParameters(resource_id=0, actor=User(), query_params={})
        check_access(cmd_params)


def test_unsaved_chart_unknown_dataset_id(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.charts.form_data.utils import check_access

    with raises(DatasetNotFoundError):
        mocker.patch(dataset_find_by_id, return_value=None)
        cmd_params = CommandParameters(
            resource_id=0, actor=User(), query_params={"dataset_id": "1"}
        )
        check_access(cmd_params)


def test_unsaved_chart_unauthorized_dataset(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.charts.form_data import utils
    from superset.connectors.sqla.models import SqlaTable

    with raises(DatasetAccessDeniedError):
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=False)
        cmd_params = CommandParameters(
            resource_id=0, actor=User(), query_params={"dataset_id": "1"}
        )
        utils.check_access(cmd_params)


def test_unsaved_chart_authorized_dataset(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.charts.form_data.utils import check_access
    from superset.connectors.sqla.models import SqlaTable

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    cmd_params = CommandParameters(
        resource_id=0, actor=User(), query_params={"dataset_id": "1"}
    )
    assert check_access(cmd_params) == True


def test_saved_chart_unknown_chart_id(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.charts.form_data.utils import check_access
    from superset.connectors.sqla.models import SqlaTable

    with raises(ChartNotFoundError):
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=True)
        mocker.patch(chart_find_by_id, return_value=None)
        cmd_params = CommandParameters(
            resource_id=1, actor=User(), query_params={"dataset_id": "1"}
        )
        check_access(cmd_params)


def test_saved_chart_unauthorized_dataset(
    mocker: MockFixture, app_context: AppContext
) -> None:
    from superset.charts.form_data import utils
    from superset.connectors.sqla.models import SqlaTable

    with raises(DatasetAccessDeniedError):
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=False)
        cmd_params = CommandParameters(
            resource_id=1, actor=User(), query_params={"dataset_id": "1"}
        )
        utils.check_access(cmd_params)


def test_saved_chart_is_admin(mocker: MockFixture, app_context: AppContext) -> None:
    from superset.charts.form_data.utils import check_access
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_user_admin, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())
    cmd_params = CommandParameters(
        resource_id=1, actor=User(), query_params={"dataset_id": "1"}
    )
    assert check_access(cmd_params) == True


def test_saved_chart_is_owner(mocker: MockFixture, app_context: AppContext) -> None:
    from superset.charts.form_data.utils import check_access
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_user_admin, return_value=False)
    mocker.patch(is_owner, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())
    cmd_params = CommandParameters(
        resource_id=1, actor=User(), query_params={"dataset_id": "1"}
    )
    assert check_access(cmd_params) == True


def test_saved_chart_has_access(mocker: MockFixture, app_context: AppContext) -> None:
    from superset.charts.form_data.utils import check_access
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_user_admin, return_value=False)
    mocker.patch(is_owner, return_value=False)
    mocker.patch(can_access, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())
    cmd_params = CommandParameters(
        resource_id=1, actor=User(), query_params={"dataset_id": "1"}
    )
    assert check_access(cmd_params) == True


def test_saved_chart_no_access(mocker: MockFixture, app_context: AppContext) -> None:
    from superset.charts.form_data.utils import check_access
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    with raises(ChartAccessDeniedError):
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=True)
        mocker.patch(is_user_admin, return_value=False)
        mocker.patch(is_owner, return_value=False)
        mocker.patch(can_access, return_value=False)
        mocker.patch(chart_find_by_id, return_value=Slice())
        cmd_params = CommandParameters(
            resource_id=1, actor=User(), query_params={"dataset_id": "1"}
        )
        check_access(cmd_params)
