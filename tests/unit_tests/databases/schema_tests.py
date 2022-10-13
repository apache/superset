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

# pylint: disable=import-outside-toplevel, invalid-name, unused-argument, redefined-outer-name

from typing import TYPE_CHECKING

import pytest
from marshmallow import fields, Schema, ValidationError
from pytest_mock import MockFixture

if TYPE_CHECKING:
    from superset.databases.schemas import DatabaseParametersSchemaMixin
    from superset.db_engine_specs.base import BasicParametersMixin


# pylint: disable=too-few-public-methods
class InvalidEngine:
    """
    An invalid DB engine spec.
    """


@pytest.fixture
def dummy_schema() -> "DatabaseParametersSchemaMixin":
    """
    Fixture providing a dummy schema.
    """
    from superset.databases.schemas import DatabaseParametersSchemaMixin

    class DummySchema(Schema, DatabaseParametersSchemaMixin):
        sqlalchemy_uri = fields.String()

    return DummySchema()


@pytest.fixture
def dummy_engine(mocker: MockFixture) -> None:
    """
    Fixture proving a dummy DB engine spec.
    """
    from superset.db_engine_specs.base import BasicParametersMixin

    class DummyEngine(BasicParametersMixin):
        engine = "dummy"
        default_driver = "dummy"

    mocker.patch("superset.databases.schemas.get_engine_spec", return_value=DummyEngine)


def test_database_parameters_schema_mixin(
    dummy_engine: None,
    dummy_schema: "Schema",
) -> None:
    from superset.models.core import ConfigurationMethod

    payload = {
        "engine": "dummy_engine",
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": 12345,
            "database": "dbname",
        },
    }
    result = dummy_schema.load(payload)
    assert result == {
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "sqlalchemy_uri": "dummy+dummy://username:password@localhost:12345/dbname",
    }


def test_database_parameters_schema_mixin_no_engine(
    dummy_schema: "Schema",
) -> None:
    from superset.models.core import ConfigurationMethod

    payload = {
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": 12345,
            "database": "dbname",
        },
    }
    try:
        dummy_schema.load(payload)
    except ValidationError as err:
        assert err.messages == {
            "_schema": [
                (
                    "An engine must be specified when passing individual parameters to "
                    "a database."
                ),
            ]
        }


def test_database_parameters_schema_mixin_invalid_engine(
    dummy_engine: None,
    dummy_schema: "Schema",
) -> None:
    from superset.models.core import ConfigurationMethod

    payload = {
        "engine": "dummy_engine",
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": 12345,
            "database": "dbname",
        },
    }
    try:
        dummy_schema.load(payload)
    except ValidationError as err:
        assert err.messages == {
            "_schema": ['Engine "dummy_engine" is not a valid engine.']
        }


def test_database_parameters_schema_no_mixin(
    dummy_engine: None,
    dummy_schema: "Schema",
) -> None:
    from superset.models.core import ConfigurationMethod

    payload = {
        "engine": "invalid_engine",
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": 12345,
            "database": "dbname",
        },
    }
    try:
        dummy_schema.load(payload)
    except ValidationError as err:
        assert err.messages == {
            "_schema": [
                (
                    'Engine spec "InvalidEngine" does not support '
                    "being configured via individual parameters."
                )
            ]
        }


def test_database_parameters_schema_mixin_invalid_type(
    dummy_engine: None,
    dummy_schema: "Schema",
) -> None:
    from superset.models.core import ConfigurationMethod

    payload = {
        "engine": "dummy_engine",
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": "badport",
            "database": "dbname",
        },
    }
    try:
        dummy_schema.load(payload)
    except ValidationError as err:
        assert err.messages == {"port": ["Not a valid integer."]}
