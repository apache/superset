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
# pylint: disable=import-outside-toplevel, unused-argument, unused-import, invalid-name

import copy
import re
import uuid
from typing import Any
from unittest.mock import Mock, patch

import pytest
from flask import current_app
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db
from superset.commands.dataset.exceptions import (
    DatasetForbiddenDataURI,
)
from superset.commands.dataset.importers.v1.utils import validate_data_uri
from superset.commands.exceptions import ImportFailedError
from superset.utils import json
from superset.utils.core import override_user


def test_import_dataset(mocker: MockerFixture, session: Session) -> None:
    """
    Test importing a dataset.
    """
    from superset import security_manager
    from superset.commands.dataset.importers.v1.utils import import_dataset
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset_uuid = uuid.uuid4()
    config = {
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "catalog": "public",
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": {
            "answer": "42",
        },
        "filter_select_enabled": True,
        "fetch_values_predicate": "foo IN (1, 2)",
        "extra": {"warning_markdown": "*WARNING*"},
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "verbose_name": None,
                "metric_type": None,
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "extra": {"warning_markdown": None},
                "warning_text": None,
            }
        ],
        "columns": [
            {
                "column_name": "profit",
                "verbose_name": None,
                "is_dttm": None,
                "is_active": None,
                "type": "INTEGER",
                "groupby": None,
                "filterable": None,
                "expression": "revenue-expenses",
                "description": None,
                "python_date_format": None,
                "extra": {
                    "certified_by": "User",
                },
            }
        ],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    sqla_table = import_dataset(config)
    assert sqla_table.table_name == "my_table"
    assert sqla_table.main_dttm_col == "ds"
    assert sqla_table.description == "This is the description"
    assert sqla_table.default_endpoint is None
    assert sqla_table.offset == -8
    assert sqla_table.cache_timeout == 3600
    assert sqla_table.catalog == "public"
    assert sqla_table.schema == "my_schema"
    assert sqla_table.sql is None
    assert sqla_table.params == json.dumps(
        {"remote_id": 64, "database_name": "examples", "import_time": 1606677834}
    )
    assert sqla_table.template_params == json.dumps({"answer": "42"})
    assert sqla_table.filter_select_enabled is True
    assert sqla_table.fetch_values_predicate == "foo IN (1, 2)"
    assert sqla_table.extra == '{"warning_markdown": "*WARNING*"}'
    assert sqla_table.uuid == dataset_uuid
    assert len(sqla_table.metrics) == 1
    assert sqla_table.metrics[0].metric_name == "cnt"
    assert sqla_table.metrics[0].verbose_name is None
    assert sqla_table.metrics[0].metric_type is None
    assert sqla_table.metrics[0].expression == "COUNT(*)"
    assert sqla_table.metrics[0].description is None
    assert sqla_table.metrics[0].d3format is None
    assert sqla_table.metrics[0].extra == '{"warning_markdown": null}'
    assert sqla_table.metrics[0].warning_text is None
    assert len(sqla_table.columns) == 1
    assert sqla_table.columns[0].column_name == "profit"
    assert sqla_table.columns[0].verbose_name is None
    assert sqla_table.columns[0].is_dttm is False
    assert sqla_table.columns[0].is_active is True
    assert sqla_table.columns[0].type == "INTEGER"
    assert sqla_table.columns[0].groupby is True
    assert sqla_table.columns[0].filterable is True
    assert sqla_table.columns[0].expression == "revenue-expenses"
    assert sqla_table.columns[0].description is None
    assert sqla_table.columns[0].python_date_format is None
    assert sqla_table.columns[0].extra == '{"certified_by": "User"}'
    assert sqla_table.database.uuid == database.uuid
    assert sqla_table.database.id == database.id


def test_import_dataset_duplicate_column(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test importing a dataset with a column that already exists.
    """
    from superset import security_manager
    from superset.commands.dataset.importers.v1.utils import import_dataset
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    dataset_uuid = uuid.uuid4()

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")

    db.session.add(database)
    db.session.flush()

    dataset = SqlaTable(
        uuid=dataset_uuid, table_name="existing_dataset", database_id=database.id
    )
    column = TableColumn(column_name="existing_column")
    db.session.add(dataset)
    db.session.add(column)
    db.session.flush()

    config = {
        "table_name": dataset.table_name,
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": {
            "answer": "42",
        },
        "filter_select_enabled": True,
        "fetch_values_predicate": "foo IN (1, 2)",
        "extra": {"warning_markdown": "*WARNING*"},
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "verbose_name": None,
                "metric_type": None,
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "extra": {"warning_markdown": None},
                "warning_text": None,
            }
        ],
        "columns": [
            {
                "column_name": column.column_name,
                "verbose_name": None,
                "is_dttm": None,
                "is_active": None,
                "type": "INTEGER",
                "groupby": None,
                "filterable": None,
                "expression": "revenue-expenses",
                "description": None,
                "python_date_format": None,
                "extra": {
                    "certified_by": "User",
                },
            }
        ],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    sqla_table = import_dataset(config, overwrite=True)
    assert sqla_table.table_name == dataset.table_name
    assert sqla_table.main_dttm_col == "ds"
    assert sqla_table.description == "This is the description"
    assert sqla_table.default_endpoint is None
    assert sqla_table.offset == -8
    assert sqla_table.cache_timeout == 3600
    assert sqla_table.schema == "my_schema"
    assert sqla_table.sql is None
    assert sqla_table.params == json.dumps(
        {"remote_id": 64, "database_name": "examples", "import_time": 1606677834}
    )
    assert sqla_table.template_params == json.dumps({"answer": "42"})
    assert sqla_table.filter_select_enabled is True
    assert sqla_table.fetch_values_predicate == "foo IN (1, 2)"
    assert sqla_table.extra == '{"warning_markdown": "*WARNING*"}'
    assert sqla_table.uuid == dataset_uuid
    assert len(sqla_table.metrics) == 1
    assert sqla_table.metrics[0].metric_name == "cnt"
    assert sqla_table.metrics[0].verbose_name is None
    assert sqla_table.metrics[0].metric_type is None
    assert sqla_table.metrics[0].expression == "COUNT(*)"
    assert sqla_table.metrics[0].description is None
    assert sqla_table.metrics[0].d3format is None
    assert sqla_table.metrics[0].extra == '{"warning_markdown": null}'
    assert sqla_table.metrics[0].warning_text is None
    assert len(sqla_table.columns) == 1
    assert sqla_table.columns[0].column_name == column.column_name
    assert sqla_table.columns[0].verbose_name is None
    assert sqla_table.columns[0].is_dttm is False
    assert sqla_table.columns[0].is_active is True
    assert sqla_table.columns[0].type == "INTEGER"
    assert sqla_table.columns[0].groupby is True
    assert sqla_table.columns[0].filterable is True
    assert sqla_table.columns[0].expression == "revenue-expenses"
    assert sqla_table.columns[0].description is None
    assert sqla_table.columns[0].python_date_format is None
    assert sqla_table.columns[0].extra == '{"certified_by": "User"}'
    assert sqla_table.database.uuid == database.uuid
    assert sqla_table.database.id == database.id


def test_import_column_extra_is_string(mocker: MockerFixture, session: Session) -> None:
    """
    Test importing a dataset when the column extra is a string.
    """
    from superset import security_manager
    from superset.commands.dataset.importers.v1.utils import import_dataset
    from superset.connectors.sqla.models import SqlaTable
    from superset.datasets.schemas import ImportV1DatasetSchema
    from superset.models.core import Database

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset_uuid = uuid.uuid4()
    yaml_config: dict[str, Any] = {
        "version": "1.0.0",
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": {
            "answer": "42",
        },
        "filter_select_enabled": True,
        "fetch_values_predicate": "foo IN (1, 2)",
        "extra": '{"warning_markdown": "*WARNING*"}',
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "verbose_name": None,
                "metric_type": None,
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "extra": '{"warning_markdown": null}',
                "warning_text": None,
            }
        ],
        "columns": [
            {
                "column_name": "profit",
                "verbose_name": None,
                "is_dttm": False,
                "is_active": True,
                "type": "INTEGER",
                "groupby": False,
                "filterable": False,
                "expression": "revenue-expenses",
                "description": None,
                "python_date_format": None,
                "extra": '{"certified_by": "User"}',
            }
        ],
        "database_uuid": database.uuid,
    }

    # the Marshmallow schema should convert strings to objects
    schema = ImportV1DatasetSchema()
    dataset_config = schema.load(yaml_config)
    dataset_config["database_id"] = database.id
    sqla_table = import_dataset(dataset_config)

    assert sqla_table.metrics[0].extra == '{"warning_markdown": null}'
    assert sqla_table.columns[0].extra == '{"certified_by": "User"}'
    assert sqla_table.extra == '{"warning_markdown": "*WARNING*"}'


def test_import_dataset_extra_empty_string(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test importing a dataset when the extra field is an empty string.
    """
    from superset import security_manager
    from superset.commands.dataset.importers.v1.utils import import_dataset
    from superset.connectors.sqla.models import SqlaTable
    from superset.datasets.schemas import ImportV1DatasetSchema
    from superset.models.core import Database

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset_uuid = uuid.uuid4()
    yaml_config: dict[str, Any] = {
        "version": "1.0.0",
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "extra": " ",
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "expression": "COUNT(*)",
            }
        ],
        "columns": [
            {
                "column_name": "profit",
                "is_dttm": False,
                "is_active": True,
                "type": "INTEGER",
                "groupby": False,
                "filterable": False,
                "expression": "revenue-expenses",
            }
        ],
        "database_uuid": database.uuid,
    }

    schema = ImportV1DatasetSchema()
    dataset_config = schema.load(yaml_config)
    dataset_config["database_id"] = database.id
    sqla_table = import_dataset(dataset_config)

    assert sqla_table.extra is None  # noqa: E711


@patch("superset.commands.dataset.importers.v1.utils.request")
def test_import_column_allowed_data_url(
    request: Mock,
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing a dataset when using data key to fetch data from a URL.
    """
    import io

    from superset import security_manager
    from superset.commands.dataset.importers.v1.utils import import_dataset
    from superset.connectors.sqla.models import SqlaTable
    from superset.datasets.schemas import ImportV1DatasetSchema
    from superset.models.core import Database

    request.urlopen.return_value = io.StringIO("col1\nvalue1\nvalue2\n")

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset_uuid = uuid.uuid4()
    yaml_config: dict[str, Any] = {
        "version": "1.0.0",
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "schema": None,
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": None,
        "filter_select_enabled": True,
        "fetch_values_predicate": None,
        "extra": None,
        "uuid": dataset_uuid,
        "metrics": [],
        "columns": [
            {
                "column_name": "col1",
                "verbose_name": None,
                "is_dttm": False,
                "is_active": True,
                "type": "TEXT",
                "groupby": False,
                "filterable": False,
                "expression": None,
                "description": None,
                "python_date_format": None,
                "extra": None,
            }
        ],
        "database_uuid": database.uuid,
        "data": "https://some-external-url.com/data.csv",
    }

    # the Marshmallow schema should convert strings to objects
    schema = ImportV1DatasetSchema()
    dataset_config = schema.load(yaml_config)
    dataset_config["database_id"] = database.id
    _ = import_dataset(dataset_config, force_data=True)
    assert [("value1",), ("value2",)] == db.session.execute(
        "SELECT * FROM my_table"
    ).fetchall()


def test_import_dataset_managed_externally(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing a dataset that is managed externally.
    """
    from superset import security_manager
    from superset.commands.dataset.importers.v1.utils import import_dataset
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import dataset_config

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_config)
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_table"
    config["database_id"] = database.id

    sqla_table = import_dataset(config)
    assert sqla_table.is_managed_externally is True
    assert sqla_table.external_url == "https://example.org/my_table"


def test_import_dataset_without_owner_permission(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing a dataset that is managed externally.
    """
    from superset import security_manager
    from superset.commands.dataset.importers.v1.utils import import_dataset
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import dataset_config

    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    config = copy.deepcopy(dataset_config)
    config["database_id"] = database.id

    import_dataset(config)
    user = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Gamma")],
    )

    with override_user(user):
        with pytest.raises(ImportFailedError) as excinfo:
            import_dataset(config, overwrite=True)

        assert (
            str(excinfo.value)
            == "A dataset already exists and user doesn't have permissions to overwrite it"  # noqa: E501
        )

    # Assert that the can write to chart was checked
    mock_can_access.assert_called_with("can_write", "Dataset")


@pytest.mark.parametrize(
    "allowed_urls, data_uri, expected, exception_class",
    [
        ([r".*"], "https://some-url/data.csv", True, None),
        (
            [r"^https://.+\.domain1\.com\/?.*", r"^https://.+\.domain2\.com\/?.*"],
            "https://host1.domain1.com/data.csv",
            True,
            None,
        ),
        (
            [r"^https://.+\.domain1\.com\/?.*", r"^https://.+\.domain2\.com\/?.*"],
            "https://host2.domain1.com/data.csv",
            True,
            None,
        ),
        (
            [r"^https://.+\.domain1\.com\/?.*", r"^https://.+\.domain2\.com\/?.*"],
            "https://host1.domain2.com/data.csv",
            True,
            None,
        ),
        (
            [r"^https://.+\.domain1\.com\/?.*", r"^https://.+\.domain2\.com\/?.*"],
            "https://host1.domain3.com/data.csv",
            False,
            DatasetForbiddenDataURI,
        ),
        ([], "https://host1.domain3.com/data.csv", False, DatasetForbiddenDataURI),
        (["*"], "https://host1.domain3.com/data.csv", False, re.error),
    ],
)
def test_validate_data_uri(allowed_urls, data_uri, expected, exception_class):
    current_app.config["DATASET_IMPORT_ALLOWED_DATA_URLS"] = allowed_urls
    if expected:
        validate_data_uri(data_uri)
    else:
        with pytest.raises(exception_class):
            validate_data_uri(data_uri)
