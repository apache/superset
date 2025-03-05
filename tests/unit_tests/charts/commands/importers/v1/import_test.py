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
# pylint: disable=unused-argument, import-outside-toplevel, unused-import, invalid-name

import copy
from collections.abc import Generator

import pytest
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.commands.chart.importers.v1.utils import import_chart
from superset.commands.exceptions import ImportFailedError
from superset.connectors.sqla.models import Database, SqlaTable
from superset.models.slice import Slice
from superset.utils.core import override_user
from tests.integration_tests.fixtures.importexport import chart_config


@pytest.fixture
def session_with_data(session: Session) -> Generator[Session, None, None]:
    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    dataset = SqlaTable(
        table_name="test_table",
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(dataset)
    session.flush()
    slice = Slice(
        id=1,
        datasource_id=dataset.id,
        datasource_type="table",
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
        uuid=chart_config["uuid"],
    )
    session.add(slice)
    session.flush()

    yield session
    session.rollback()


@pytest.fixture
def session_with_schema(session: Session) -> Generator[Session, None, None]:
    from superset.connectors.sqla.models import SqlaTable

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    yield session


def test_import_chart(mocker: MockerFixture, session_with_schema: Session) -> None:
    """
    Test importing a chart.
    """

    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    chart = import_chart(config)
    assert chart.slice_name == "Deck Path"
    assert chart.viz_type == "deck_path"
    assert chart.is_managed_externally is False
    assert chart.external_url is None

    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")


def test_import_chart_managed_externally(
    mocker: MockerFixture, session_with_schema: Session
) -> None:
    """
    Test importing a chart that is managed externally.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_chart"

    chart = import_chart(config)
    assert chart.is_managed_externally is True
    assert chart.external_url == "https://example.org/my_chart"

    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")


def test_import_chart_without_permission(
    mocker: MockerFixture,
    session_with_schema: Session,
) -> None:
    """
    Test importing a chart when a user doesn't have permissions to create.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=False
    )

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    with pytest.raises(ImportFailedError) as excinfo:
        import_chart(config)
    assert (
        str(excinfo.value)
        == "Chart doesn't exist and user doesn't have permission to create charts"
    )
    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")


def test_filter_chart_annotations(session: Session) -> None:
    """
    Test importing a chart.
    """
    from superset.commands.chart.importers.v1.utils import filter_chart_annotations
    from tests.integration_tests.fixtures.importexport import (
        chart_config_with_mixed_annotations,
    )

    config = copy.deepcopy(chart_config_with_mixed_annotations)
    filter_chart_annotations(config)
    params = config["params"]
    annotation_layers = params["annotation_layers"]

    assert len(annotation_layers) == 1
    assert all([al["annotationType"] == "FORMULA" for al in annotation_layers])


def test_import_existing_chart_without_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a chart when a user doesn't have permissions to modify.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_chart = mocker.patch.object(
        security_manager, "can_access_chart", return_value=False
    )

    slice = (
        session_with_data.query(Slice)
        .filter(Slice.uuid == chart_config["uuid"])
        .one_or_none()
    )

    user = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    with override_user(user):
        with pytest.raises(ImportFailedError) as excinfo:
            import_chart(chart_config, overwrite=True)
        assert (
            str(excinfo.value)
            == "A chart already exists and user doesn't have permissions to overwrite it"  # noqa: E501
        )

    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")
    mock_can_access_chart.assert_called_once_with(slice)


def test_import_existing_chart_without_owner_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a chart when a user doesn't have permissions to modify.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_chart = mocker.patch.object(
        security_manager, "can_access_chart", return_value=True
    )

    slice = (
        session_with_data.query(Slice)
        .filter(Slice.uuid == chart_config["uuid"])
        .one_or_none()
    )

    user = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Gamma")],
    )

    with override_user(user):
        with pytest.raises(ImportFailedError) as excinfo:
            import_chart(chart_config, overwrite=True)
        assert (
            str(excinfo.value)
            == "A chart already exists and user doesn't have permissions to overwrite it"
        )

    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")
    mock_can_access_chart.assert_called_once_with(slice)


def test_import_existing_chart_with_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a chart that exists when a user has access permission to that chart.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_chart = mocker.patch.object(
        security_manager, "can_access_chart", return_value=True
    )

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    slice = (
        session_with_data.query(Slice)
        .filter(Slice.uuid == config["uuid"])
        .one_or_none()
    )

    with override_user(admin):
        import_chart(config, overwrite=True)
    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")
    mock_can_access_chart.assert_called_once_with(slice)
