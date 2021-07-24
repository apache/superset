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

from unittest import mock

from marshmallow import fields, Schema, ValidationError

from superset.databases.schemas import DatabaseParametersSchemaMixin
from superset.db_engine_specs.base import BasicParametersMixin
from superset.models.core import ConfigurationMethod


class DummySchema(Schema, DatabaseParametersSchemaMixin):
    sqlalchemy_uri = fields.String()


class DummyEngine(BasicParametersMixin):
    engine = "dummy"
    default_driver = "dummy"


class InvalidEngine:
    pass


@mock.patch("superset.databases.schemas.get_engine_specs")
def test_database_parameters_schema_mixin(get_engine_specs):
    get_engine_specs.return_value = {"dummy_engine": DummyEngine}
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
    schema = DummySchema()
    result = schema.load(payload)
    assert result == {
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "sqlalchemy_uri": "dummy+dummy://username:password@localhost:12345/dbname",
    }


def test_database_parameters_schema_mixin_no_engine():
    payload = {
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": 12345,
            "dbname": "dbname",
        },
    }
    schema = DummySchema()
    try:
        schema.load(payload)
    except ValidationError as err:
        assert err.messages == {
            "_schema": [
                "An engine must be specified when passing individual parameters to a database."
            ]
        }


@mock.patch("superset.databases.schemas.get_engine_specs")
def test_database_parameters_schema_mixin_invalid_engine(get_engine_specs):
    get_engine_specs.return_value = {}
    payload = {
        "engine": "dummy_engine",
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": 12345,
            "dbname": "dbname",
        },
    }
    schema = DummySchema()
    try:
        schema.load(payload)
    except ValidationError as err:
        assert err.messages == {
            "_schema": ['Engine "dummy_engine" is not a valid engine.']
        }


@mock.patch("superset.databases.schemas.get_engine_specs")
def test_database_parameters_schema_no_mixin(get_engine_specs):
    get_engine_specs.return_value = {"invalid_engine": InvalidEngine}
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
    schema = DummySchema()
    try:
        schema.load(payload)
    except ValidationError as err:
        assert err.messages == {
            "_schema": [
                (
                    'Engine spec "InvalidEngine" does not support '
                    "being configured via individual parameters."
                )
            ]
        }


@mock.patch("superset.databases.schemas.get_engine_specs")
def test_database_parameters_schema_mixin_invalid_type(get_engine_specs):
    get_engine_specs.return_value = {"dummy_engine": DummyEngine}
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
    schema = DummySchema()
    try:
        schema.load(payload)
    except ValidationError as err:
        assert err.messages == {"port": ["Not a valid integer."]}
