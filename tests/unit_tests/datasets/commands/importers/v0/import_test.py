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
# pylint: disable=import-outside-toplevel, unused-argument

import pytest
from pytest_mock import MockerFixture

# A minimal unversioned dataset export carrying an embedded database connection.
DATA_WITH_DATABASE = {"databases": [{"database_name": "sample_db"}]}


def test_import_from_dict_requires_database_write(mocker: MockerFixture) -> None:
    """
    A user must hold database write permission to create/update the database
    connections embedded in a legacy dataset export.
    """
    from superset import security_manager
    from superset.commands.dataset.importers import v0
    from superset.commands.exceptions import ImportFailedError

    mocker.patch.object(v0, "get_user", return_value=object())
    can_access = mocker.patch.object(security_manager, "can_access", return_value=False)
    imported = mocker.patch.object(v0.Database, "import_from_dict")

    with pytest.raises(ImportFailedError):
        v0.import_from_dict(DATA_WITH_DATABASE)

    can_access.assert_called_once_with("can_write", "Database")
    imported.assert_not_called()


def test_import_from_dict_allows_database_write(mocker: MockerFixture) -> None:
    """
    A user holding database write permission proceeds to import the databases.
    """
    from superset import security_manager
    from superset.commands.dataset.importers import v0

    mocker.patch.object(v0, "get_user", return_value=object())
    mocker.patch.object(security_manager, "can_access", return_value=True)
    imported = mocker.patch.object(v0.Database, "import_from_dict", return_value=None)

    v0.import_from_dict(DATA_WITH_DATABASE)

    imported.assert_called_once()


def test_import_from_dict_skips_check_without_user(mocker: MockerFixture) -> None:
    """
    The command-line import paths run without a request user; the permission
    check is skipped so those paths keep working.
    """
    from superset import security_manager
    from superset.commands.dataset.importers import v0

    mocker.patch.object(v0, "get_user", return_value=None)
    can_access = mocker.patch.object(security_manager, "can_access")
    imported = mocker.patch.object(v0.Database, "import_from_dict", return_value=None)

    v0.import_from_dict(DATA_WITH_DATABASE)

    can_access.assert_not_called()
    imported.assert_called_once()


def test_validate_parser_error_raises_incorrect_version_error() -> None:
    """
    A YAML file malformed in a way that raises ``yaml.parser.ParserError``
    (an unterminated flow sequence) is reported as an invalid version.
    """
    from superset.commands.dataset.importers import v0
    from superset.commands.importers.exceptions import IncorrectVersionError

    command = v0.ImportDatasetsCommand({"broken.yaml": "[1, 2"})

    with pytest.raises(IncorrectVersionError):
        command.validate()


def test_validate_scanner_error_raises_incorrect_version_error() -> None:
    """
    A YAML file malformed in a way that raises ``yaml.scanner.ScannerError``
    (an unterminated quoted string) is a sibling of ``ParserError`` under
    ``yaml.YAMLError`` and must also be reported as an invalid version rather
    than propagating as a raw, uncaught exception.
    """
    from superset.commands.dataset.importers import v0
    from superset.commands.importers.exceptions import IncorrectVersionError

    command = v0.ImportDatasetsCommand({"broken.yaml": 'key: "unterminated string'})

    with pytest.raises(IncorrectVersionError):
        command.validate()


def test_a_v0_import_repairs_a_dangling_partition_mapping(
    mocker: MockerFixture,
) -> None:
    """
    `SqlaTable.export_fields` carries the mapping's columns, so this path
    imports them -- but it calls `SqlaTable.import_from_dict` directly and goes
    through neither `DatasetDAO.update` nor the v1 importer, so neither repair
    ran. An older bundle imported with ``--sync columns`` that omits the
    partition column deleted it and left `partition_column` naming it, which
    stops the pruning and fails every later edit of that dataset.
    """
    from superset.commands.dataset.importers import v0
    from superset.daos.dataset import DatasetDAO

    dataset = mocker.MagicMock()
    dataset.columns = [mocker.MagicMock(column_name="event_time")]
    mocker.patch.object(v0.SqlaTable, "import_from_dict", return_value=dataset)
    mocker.patch.object(v0.db.session, "flush")
    mocker.patch.object(
        v0.db.session, "query", return_value=mocker.MagicMock()
    ).return_value.filter_by.return_value.one.return_value = mocker.MagicMock(id=1)
    dangling = mocker.patch.object(DatasetDAO, "clear_dangling_partition_mapping")
    unmapped = mocker.patch.object(DatasetDAO, "clear_unmapped_partition_transforms")

    command = v0.ImportDatasetsCommand({}, sync_columns=True)
    command._configs = {  # noqa: SLF001
        "ds.yaml": [{"params": '{"database_name": "sample_db"}'}]
    }
    command.run()

    dangling.assert_called_once_with(dataset, {"event_time"})
    unmapped.assert_called_once_with(dataset)


def test_a_v0_database_bundle_repairs_its_datasets_too(mocker: MockerFixture) -> None:
    """
    `Database.export_children` carries ``tables``, so the database branch
    creates datasets as well as connections -- which is why
    `import_from_dict` reports what it wrote rather than the caller guessing.
    """
    from superset.commands.dataset.importers import v0
    from superset.daos.dataset import DatasetDAO

    dataset = mocker.MagicMock()
    dataset.columns = [mocker.MagicMock(column_name="ds")]
    db_obj = mocker.MagicMock(tables=[dataset])
    db_obj.sqlalchemy_uri = "postgresql://u@h/d"
    mocker.patch.object(v0, "get_user", return_value=None)
    mocker.patch.object(v0.Database, "import_from_dict", return_value=db_obj)
    mocker.patch.object(v0.db.session, "flush")
    dangling = mocker.patch.object(DatasetDAO, "clear_dangling_partition_mapping")
    unmapped = mocker.patch.object(DatasetDAO, "clear_unmapped_partition_transforms")

    command = v0.ImportDatasetsCommand({})
    command._configs = {"db.yaml": DATA_WITH_DATABASE}  # noqa: SLF001
    command.run()

    dangling.assert_called_once_with(dataset, {"ds"})
    unmapped.assert_called_once_with(dataset)
