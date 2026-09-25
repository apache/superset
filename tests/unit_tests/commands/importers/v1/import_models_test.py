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
"""Tests for ImportModelsCommand.validate() in superset/commands/importers/v1."""

import logging
from typing import Any
from unittest.mock import patch

import pytest
from marshmallow import fields, Schema
from marshmallow.exceptions import ValidationError

from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.v1 import ImportModelsCommand

METADATA = "version: 1.0.0\ntype: Thing\ntimestamp: '2021-01-01T00:00:00+00:00'\n"


class _ThingSchema(Schema):
    uuid = fields.UUID(required=True)
    name = fields.String(required=True)


class _ImportThingsCommand(ImportModelsCommand):
    model_name = "thing"
    prefix = "things/"
    schemas = {"things/": _ThingSchema()}


def _assert_only_warnings(caplog: pytest.LogCaptureFixture, fragment: str) -> None:
    matching = [r for r in caplog.records if fragment in r.getMessage()]
    assert matching, f"no log record containing {fragment!r}"
    assert all(r.levelno == logging.WARNING for r in matching)
    assert not [r for r in caplog.records if r.levelno >= logging.ERROR]


@patch.object(_ImportThingsCommand, "_get_uuids", return_value=set())
@patch("superset.commands.importers.v1.utils.db")
def test_validate_logs_per_file_failures_as_warning(
    mock_db: Any, mock_get_uuids: Any, caplog: pytest.LogCaptureFixture
) -> None:
    """Per-file validation failures are returned to the client as a 422
    (CommandInvalidError), so logging them is informational: WARNING, not
    ERROR."""
    mock_db.session.query.return_value.all.return_value = []
    contents = {
        "metadata.yaml": METADATA,
        "things/thing.yaml": "uuid: 6ff1d5b3-4b0f-4c6a-9d2f-9c8b7a6e5d4c\n",
    }

    caplog.set_level(logging.WARNING)
    with pytest.raises(CommandInvalidError) as excinfo:
        _ImportThingsCommand(contents).validate()

    assert excinfo.value.status == 422
    _assert_only_warnings(caplog, "Validation failed for things/thing.yaml")


@patch.object(_ImportThingsCommand, "_get_uuids", return_value=set())
@patch("superset.commands.importers.v1.load_configs")
def test_validate_logs_non_mapping_errors_as_warning(
    mock_load_configs: Any, mock_get_uuids: Any, caplog: pytest.LogCaptureFixture
) -> None:
    """ValidationErrors whose messages are not keyed by file name take the
    fallback branch, which is also logged at WARNING."""

    def _load_configs(
        contents: Any, schemas: Any, passwords: Any, exceptions: Any, *args: Any
    ) -> dict[str, Any]:
        exceptions.append(ValidationError("something is wrong"))
        return {}

    mock_load_configs.side_effect = _load_configs

    caplog.set_level(logging.WARNING)
    with pytest.raises(CommandInvalidError):
        _ImportThingsCommand({"metadata.yaml": METADATA}).validate()

    _assert_only_warnings(caplog, "Import validation error")
