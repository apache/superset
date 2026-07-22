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
