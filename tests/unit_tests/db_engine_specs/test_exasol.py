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
import pytest
from flask import Flask
from flask_babel import Babel

from superset.db_engine_specs.exasol import ExasolEngineSpec
from superset.errors import SupersetErrorType


@pytest.mark.parametrize(
    "message, expected",
    [
        (
            "syntax error, unexpected FROM_ [line 1, column 8]",
            SupersetErrorType.SYNTAX_ERROR,
        ),
        (
            "table DEMO.MISSING does not exist [line 1, column 12]",
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
        ),
        (
            "insufficient privileges: SELECT on table PRIVATE_TABLE",
            SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
        ),
        (
            "column not found [line 1, column 58]",
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
        ),
        ("object AMBIGUOUS not found", SupersetErrorType.GENERIC_DB_ENGINE_ERROR),
        ("another server failure", SupersetErrorType.GENERIC_DB_ENGINE_ERROR),
    ],
)
def test_extract_errors(message: str, expected: SupersetErrorType) -> None:
    """Classify known messages without discarding the server diagnostic."""
    app = Flask(__name__)
    Babel(app)
    with app.app_context():
        errors = ExasolEngineSpec.extract_errors(Exception(message))
    assert len(errors) == 1
    assert errors[0].error_type == expected
    assert errors[0].message == message


def test_server_message_templates_are_not_translatable() -> None:
    """A passthrough placeholder contains no text for translators."""
    for template, _, _ in ExasolEngineSpec.custom_errors.values():
        assert type(template) is str
        assert template == "%(message)s"
