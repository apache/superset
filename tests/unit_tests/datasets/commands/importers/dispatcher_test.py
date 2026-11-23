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
"""
The HTTP-reachable dataset import dispatcher must never fall through to
the legacy v0 importer, which matches datasets purely by
(table_name, schema, database) and overrides them without any ownership
check. Legacy YAML files remain importable via the dedicated
`legacy_import_datasources` CLI command, which uses the v0 command
directly.
"""

import pytest
from pytest_mock import MockerFixture


def test_dataset_import_dispatcher_excludes_v0() -> None:
    """POST /api/v1/dataset/import/ must not dispatch to the v0 importer."""
    from superset.commands.dataset.importers import v0
    from superset.commands.dataset.importers.dispatcher import command_versions

    assert v0.ImportDatasetsCommand not in command_versions


def test_dataset_import_dispatcher_propagates_refusal_without_error_log(
    mocker: MockerFixture,
) -> None:
    """A refused import (e.g. forbidden data URI) must propagate without
    being logged as an unexpected error."""
    from superset.commands.dataset.exceptions import DatasetForbiddenDataURI
    from superset.commands.dataset.importers import dispatcher

    command = mocker.MagicMock()
    command.return_value.run.side_effect = DatasetForbiddenDataURI()
    mocker.patch.object(dispatcher, "command_versions", [command])
    mock_logger = mocker.patch.object(dispatcher, "logger")

    with pytest.raises(DatasetForbiddenDataURI):
        dispatcher.ImportDatasetsCommand({}).run()

    mock_logger.exception.assert_not_called()
