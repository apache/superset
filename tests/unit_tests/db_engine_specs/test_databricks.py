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
# pylint: disable=unused-argument, import-outside-toplevel, protected-access

import json

from superset.utils.core import GenericDataType
from tests.integration_tests.db_engine_specs.base_tests import assert_generic_types


def test_get_parameters_from_uri() -> None:
    """
    Test that the result from ``get_parameters_from_uri`` is JSON serializable.
    """
    from superset.db_engine_specs.databricks import (
        DatabricksNativeEngineSpec,
        DatabricksParametersType,
    )

    parameters = DatabricksNativeEngineSpec.get_parameters_from_uri(
        "databricks+connector://token:abc12345@my_hostname:1234/test"
    )
    assert parameters == DatabricksParametersType(
        {
            "access_token": "abc12345",
            "host": "my_hostname",
            "port": 1234,
            "database": "test",
            "encryption": False,
        }
    )
    assert json.loads(json.dumps(parameters)) == parameters


def test_build_sqlalchemy_uri() -> None:
    """
    test that the parameters are can correctly be compiled into a
    sqlalchemy_uri
    """
    from superset.db_engine_specs.databricks import (
        DatabricksNativeEngineSpec,
        DatabricksParametersType,
    )

    parameters = DatabricksParametersType(
        {
            "access_token": "abc12345",
            "host": "my_hostname",
            "port": 1234,
            "database": "test",
            "encryption": False,
        }
    )
    encrypted_extra = None
    sqlalchemy_uri = DatabricksNativeEngineSpec.build_sqlalchemy_uri(
        parameters, encrypted_extra
    )
    assert sqlalchemy_uri == (
        "databricks+connector://token:abc12345@my_hostname:1234/test"
    )


def test_parameters_json_schema() -> None:
    """
    test that the parameters schema can be converted to json
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    json_schema = DatabricksNativeEngineSpec.parameters_json_schema()

    assert json_schema == {
        "type": "object",
        "properties": {
            "access_token": {"type": "string"},
            "database": {"type": "string"},
            "encryption": {
                "description": "Use an encrypted connection to the database",
                "type": "boolean",
            },
            "host": {"type": "string"},
            "http_path": {"type": "string"},
            "port": {
                "description": "Database port",
                "format": "int32",
                "maximum": 65536,
                "minimum": 0,
                "type": "integer",
            },
        },
        "required": ["access_token", "database", "host", "http_path", "port"],
    }


def test_generic_type() -> None:
    """
    assert that generic types match
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    type_expectations = (
        # Numeric
        ("SMALLINT", GenericDataType.NUMERIC),
        ("INTEGER", GenericDataType.NUMERIC),
        ("BIGINT", GenericDataType.NUMERIC),
        ("DECIMAL", GenericDataType.NUMERIC),
        ("NUMERIC", GenericDataType.NUMERIC),
        ("REAL", GenericDataType.NUMERIC),
        ("DOUBLE PRECISION", GenericDataType.NUMERIC),
        ("MONEY", GenericDataType.NUMERIC),
        # String
        ("CHAR", GenericDataType.STRING),
        ("VARCHAR", GenericDataType.STRING),
        ("TEXT", GenericDataType.STRING),
        # Temporal
        ("DATE", GenericDataType.TEMPORAL),
        ("TIMESTAMP", GenericDataType.TEMPORAL),
        ("TIME", GenericDataType.TEMPORAL),
        # Boolean
        ("BOOLEAN", GenericDataType.BOOLEAN),
    )
    assert_generic_types(DatabricksNativeEngineSpec, type_expectations)
