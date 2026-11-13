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
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.exceptions import ImportFailedError, ImportRefusedError


def test_a_refused_bundle_is_not_logged_as_an_error(mocker: MockerFixture) -> None:
    """
    A bundle refused for what it contains is the client's to fix, so it is not
    logged with a traceback; the error handler reports it as a warning.
    """
    from superset.commands.database.importers import dispatcher

    command: MagicMock = mocker.MagicMock()
    command.return_value.run.side_effect = ImportRefusedError("refused")
    mocker.patch.object(dispatcher, "command_versions", [command])
    logger: MagicMock = mocker.patch.object(dispatcher, "logger")

    with pytest.raises(ImportRefusedError):
        dispatcher.ImportDatabasesCommand({}).run()

    logger.exception.assert_not_called()


def test_an_unexpected_import_failure_is_still_logged(mocker: MockerFixture) -> None:
    from superset.commands.database.importers import dispatcher

    command: MagicMock = mocker.MagicMock()
    command.return_value.run.side_effect = ImportFailedError("broken")
    mocker.patch.object(dispatcher, "command_versions", [command])
    logger: MagicMock = mocker.patch.object(dispatcher, "logger")

    with pytest.raises(ImportFailedError):
        dispatcher.ImportDatabasesCommand({}).run()

    logger.exception.assert_called_once()
