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

from importlib import import_module
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.base import BaseEngineSpec

# These extractors decode the URL database or split it into catalog/schema parts.
SCHEMA_EXTRACTORS = [
    ("couchbase", "CouchbaseEngineSpec", "schema%20name"),
    ("tdengine", "TDengineEngineSpec", "schema%20name"),
    ("mysql", "MySQLEngineSpec", "schema%20name"),
    ("singlestore", "SingleStoreSpec", "schema%20name"),
    ("hive", "HiveEngineSpec", "schema%20name"),
    ("drill", "DrillEngineSpec", "schema%20name"),
    ("snowflake", "SnowflakeEngineSpec", "catalog/schema%20name"),
    ("presto", "PrestoEngineSpec", "catalog/schema%20name"),
]


@pytest.fixture(params=SCHEMA_EXTRACTORS, ids=lambda item: item[0])
def schema_extractor(
    request: pytest.FixtureRequest,
) -> tuple[type[BaseEngineSpec], str]:
    """Load the concrete extractor without requiring its SQLAlchemy driver."""
    module_name, class_name, database = request.param
    module = import_module(f"superset.db_engine_specs.{module_name}")
    return getattr(module, class_name), database


@pytest.mark.parametrize("path", ["", "/"])
def test_schema_extractor_without_database(
    schema_extractor: tuple[type[BaseEngineSpec], str], path: str
) -> None:
    """A URI without a database has no configured schema, rather than an error."""
    spec, _ = schema_extractor
    assert (
        spec.get_schema_from_engine_params(make_url(f"{spec.engine}://host{path}"), {})
        is None
    )


def test_schema_extractor_decodes_database(
    schema_extractor: tuple[type[BaseEngineSpec], str],
) -> None:
    """The missing-database guard must preserve decoding of configured schemas."""
    spec, database = schema_extractor
    assert (
        spec.get_schema_from_engine_params(
            make_url(f"{spec.engine}://host/{database}"), {}
        )
        == "schema name"
    )


def test_schema_resolution_without_database(
    schema_extractor: tuple[type[BaseEngineSpec], str],
    mocker: MockerFixture,
) -> None:
    """Query-aware consumers must reach inspector fallback for a pathless URI."""
    spec, _ = schema_extractor
    mocker.patch.object(spec, "supports_dynamic_schema", False)
    default_schema = mocker.patch.object(
        spec, "get_default_schema", return_value="inspected"
    )
    database = MagicMock(sqlalchemy_uri=f"{spec.engine}://host")
    database.get_extra.return_value = {}
    query = MagicMock(schema="configured", catalog=None)

    assert spec.get_default_schema_for_query(database, query) == "inspected"
    default_schema.assert_called_once_with(database, None)


def test_schema_resolution_preserves_discovery_errors(
    schema_extractor: tuple[type[BaseEngineSpec], str],
    mocker: MockerFixture,
) -> None:
    """A missing URI database must not suppress failures from schema discovery."""
    spec, _ = schema_extractor
    mocker.patch.object(spec, "supports_dynamic_schema", False)
    mocker.patch.object(
        spec, "get_default_schema", side_effect=ValueError("schema discovery failed")
    )
    database = MagicMock(sqlalchemy_uri=f"{spec.engine}://host")
    database.get_extra.return_value = {}

    with pytest.raises(ValueError, match="schema discovery failed"):
        spec.get_default_schema_for_query(database, MagicMock(catalog=None))
