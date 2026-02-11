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

from superset.semantic_layers.schemas import SemanticViewPutSchema


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
