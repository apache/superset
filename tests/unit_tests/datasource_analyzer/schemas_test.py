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
from marshmallow import ValidationError

from superset.datasource_analyzer.schemas import (
    DatasourceAnalyzerPostSchema,
    DatasourceAnalyzerResponseSchema,
)


def test_post_schema_valid_minimal() -> None:
    """Test POST schema with minimal valid data."""
    schema = DatasourceAnalyzerPostSchema()
    data = schema.load({"database_id": 1, "schema_name": "public"})

    assert data["database_id"] == 1
    assert data["schema_name"] == "public"
    assert data["catalog_name"] is None


def test_post_schema_valid_with_catalog() -> None:
    """Test POST schema with catalog_name."""
    schema = DatasourceAnalyzerPostSchema()
    data = schema.load(
        {
            "database_id": 1,
            "schema_name": "public",
            "catalog_name": "my_catalog",
        }
    )

    assert data["database_id"] == 1
    assert data["schema_name"] == "public"
    assert data["catalog_name"] == "my_catalog"


def test_post_schema_valid_with_null_catalog() -> None:
    """Test POST schema with explicit null catalog_name."""
    schema = DatasourceAnalyzerPostSchema()
    data = schema.load(
        {
            "database_id": 1,
            "schema_name": "public",
            "catalog_name": None,
        }
    )

    assert data["database_id"] == 1
    assert data["schema_name"] == "public"
    assert data["catalog_name"] is None


def test_post_schema_missing_database_id() -> None:
    """Test POST schema without required database_id."""
    schema = DatasourceAnalyzerPostSchema()

    with pytest.raises(ValidationError) as exc_info:
        schema.load({"schema_name": "public"})

    assert "database_id" in exc_info.value.messages


def test_post_schema_missing_schema_name() -> None:
    """Test POST schema without required schema_name."""
    schema = DatasourceAnalyzerPostSchema()

    with pytest.raises(ValidationError) as exc_info:
        schema.load({"database_id": 1})

    assert "schema_name" in exc_info.value.messages


def test_post_schema_invalid_database_id_type() -> None:
    """Test POST schema with invalid database_id type."""
    schema = DatasourceAnalyzerPostSchema()

    with pytest.raises(ValidationError) as exc_info:
        schema.load({"database_id": "not_an_int", "schema_name": "public"})

    assert "database_id" in exc_info.value.messages


def test_response_schema_dump() -> None:
    """Test response schema serialization."""
    schema = DatasourceAnalyzerResponseSchema()
    result = schema.dump({"run_id": "abc-123-def"})

    assert result["run_id"] == "abc-123-def"
