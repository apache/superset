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

from superset.semantic_layers.schemas import (
    SemanticLayerPostSchema,
    SemanticLayerPutSchema,
    SemanticViewPutSchema,
)


def test_semantic_view_put_schema_both_fields() -> None:
    """Test loading both description and cache_timeout."""
    schema = SemanticViewPutSchema()
    result = schema.load({"description": "A description", "cache_timeout": 300})
    assert result == {"description": "A description", "cache_timeout": 300}


def test_semantic_view_put_schema_description_only() -> None:
    """Test loading with only description."""
    schema = SemanticViewPutSchema()
    result = schema.load({"description": "Just a description"})
    assert result == {"description": "Just a description"}


def test_semantic_view_put_schema_cache_timeout_only() -> None:
    """Test loading with only cache_timeout."""
    schema = SemanticViewPutSchema()
    result = schema.load({"cache_timeout": 600})
    assert result == {"cache_timeout": 600}


def test_semantic_view_put_schema_empty() -> None:
    """Test loading empty payload."""
    schema = SemanticViewPutSchema()
    result = schema.load({})
    assert result == {}


def test_semantic_view_put_schema_null_description() -> None:
    """Test that description accepts None."""
    schema = SemanticViewPutSchema()
    result = schema.load({"description": None})
    assert result == {"description": None}


def test_semantic_view_put_schema_null_cache_timeout() -> None:
    """Test that cache_timeout accepts None."""
    schema = SemanticViewPutSchema()
    result = schema.load({"cache_timeout": None})
    assert result == {"cache_timeout": None}


def test_semantic_view_put_schema_invalid_cache_timeout() -> None:
    """Test that non-integer cache_timeout raises ValidationError."""
    schema = SemanticViewPutSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"cache_timeout": "not_a_number"})
    assert "cache_timeout" in exc_info.value.messages


def test_semantic_view_put_schema_unknown_field() -> None:
    """Test that unknown fields raise ValidationError."""
    schema = SemanticViewPutSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"unknown_field": "value"})
    assert "unknown_field" in exc_info.value.messages


# =============================================================================
# SemanticLayerPostSchema tests
# =============================================================================


def test_post_schema_all_fields() -> None:
    """Test loading all fields."""
    schema = SemanticLayerPostSchema()
    result = schema.load({
        "name": "My Layer",
        "description": "A layer",
        "type": "snowflake",
        "configuration": {"account": "test"},
        "cache_timeout": 300,
    })
    assert result["name"] == "My Layer"
    assert result["type"] == "snowflake"
    assert result["configuration"] == {"account": "test"}
    assert result["cache_timeout"] == 300


def test_post_schema_required_fields_only() -> None:
    """Test loading with only required fields."""
    schema = SemanticLayerPostSchema()
    result = schema.load({
        "name": "My Layer",
        "type": "snowflake",
        "configuration": {"account": "test"},
    })
    assert result["name"] == "My Layer"
    assert "description" not in result
    assert "cache_timeout" not in result


def test_post_schema_missing_name() -> None:
    """Test that missing name raises ValidationError."""
    schema = SemanticLayerPostSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"type": "snowflake", "configuration": {}})
    assert "name" in exc_info.value.messages


def test_post_schema_missing_type() -> None:
    """Test that missing type raises ValidationError."""
    schema = SemanticLayerPostSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"name": "My Layer", "configuration": {}})
    assert "type" in exc_info.value.messages


def test_post_schema_missing_configuration() -> None:
    """Test that missing configuration raises ValidationError."""
    schema = SemanticLayerPostSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"name": "My Layer", "type": "snowflake"})
    assert "configuration" in exc_info.value.messages


def test_post_schema_null_description() -> None:
    """Test that description accepts None."""
    schema = SemanticLayerPostSchema()
    result = schema.load({
        "name": "My Layer",
        "type": "snowflake",
        "configuration": {},
        "description": None,
    })
    assert result["description"] is None


# =============================================================================
# SemanticLayerPutSchema tests
# =============================================================================


def test_put_schema_all_fields() -> None:
    """Test loading all fields."""
    schema = SemanticLayerPutSchema()
    result = schema.load({
        "name": "Updated",
        "description": "New desc",
        "configuration": {"account": "new"},
        "cache_timeout": 600,
    })
    assert result["name"] == "Updated"
    assert result["configuration"] == {"account": "new"}


def test_put_schema_empty() -> None:
    """Test loading empty payload."""
    schema = SemanticLayerPutSchema()
    result = schema.load({})
    assert result == {}


def test_put_schema_name_only() -> None:
    """Test loading with only name."""
    schema = SemanticLayerPutSchema()
    result = schema.load({"name": "New Name"})
    assert result == {"name": "New Name"}


def test_put_schema_configuration_only() -> None:
    """Test loading with only configuration."""
    schema = SemanticLayerPutSchema()
    result = schema.load({"configuration": {"key": "value"}})
    assert result == {"configuration": {"key": "value"}}


def test_put_schema_unknown_field() -> None:
    """Test that unknown fields raise ValidationError."""
    schema = SemanticLayerPutSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"unknown_field": "value"})
    assert "unknown_field" in exc_info.value.messages
