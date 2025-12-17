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
Unit tests for Data Access Rules schemas.
"""

import json

import pytest
from marshmallow import ValidationError

from superset.data_access_rules.schemas import (
    DataAccessRulePostSchema,
    DataAccessRulePutSchema,
)


def test_post_schema_valid_rule():
    """Test that valid rule JSON is accepted."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": json.dumps(
            {
                "allowed": [{"database": "mydb", "schema": "public"}],
                "denied": [],
            }
        ),
    }
    result = schema.load(data)
    assert result["role_id"] == 1
    assert "allowed" in json.loads(result["rule"])


def test_post_schema_complex_rule():
    """Test that complex rule with RLS and CLS is accepted."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": json.dumps(
            {
                "allowed": [
                    {"database": "mydb", "schema": "public"},
                    {
                        "database": "mydb",
                        "schema": "orders",
                        "table": "items",
                        "rls": {"predicate": "org_id = 123", "group_key": "org"},
                    },
                    {
                        "database": "mydb",
                        "schema": "users",
                        "table": "info",
                        "cls": {"email": "mask", "ssn": "hide", "name": "hash"},
                    },
                ],
                "denied": [{"database": "mydb", "schema": "internal"}],
            }
        ),
    }
    result = schema.load(data)
    assert result["role_id"] == 1


def test_post_schema_invalid_json():
    """Test that invalid JSON is rejected."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": "not valid json",
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(data)
    assert "Invalid JSON" in str(exc_info.value)


def test_post_schema_rule_not_object():
    """Test that non-object rule is rejected."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": json.dumps(["not", "an", "object"]),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(data)
    assert "must be a JSON object" in str(exc_info.value)


def test_post_schema_allowed_not_list():
    """Test that non-list 'allowed' is rejected."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": json.dumps({"allowed": "not a list", "denied": []}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(data)
    assert "'allowed' must be a list" in str(exc_info.value)


def test_post_schema_denied_not_list():
    """Test that non-list 'denied' is rejected."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": json.dumps({"allowed": [], "denied": "not a list"}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(data)
    assert "'denied' must be a list" in str(exc_info.value)


def test_post_schema_entry_not_object():
    """Test that non-object entry is rejected."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": json.dumps({"allowed": ["not an object"], "denied": []}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(data)
    assert "must be an object" in str(exc_info.value)


def test_post_schema_entry_missing_database():
    """Test that entry without 'database' is rejected."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": json.dumps({"allowed": [{"schema": "public"}], "denied": []}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(data)
    assert "'database' field" in str(exc_info.value)


def test_post_schema_invalid_cls_action():
    """Test that invalid CLS action is rejected."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": json.dumps(
            {
                "allowed": [
                    {
                        "database": "mydb",
                        "schema": "public",
                        "cls": {"email": "invalid_action"},
                    }
                ],
                "denied": [],
            }
        ),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(data)
    assert "Invalid CLS action" in str(exc_info.value)


def test_post_schema_missing_role_id():
    """Test that missing role_id is rejected."""
    schema = DataAccessRulePostSchema()
    data = {
        "rule": json.dumps({"allowed": [], "denied": []}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(data)
    assert "role_id" in str(exc_info.value)


def test_post_schema_missing_rule():
    """Test that missing rule is rejected."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(data)
    assert "rule" in str(exc_info.value)


def test_put_schema_partial_update():
    """Test that PUT schema allows partial updates."""
    schema = DataAccessRulePutSchema()

    # Only updating role_id
    data = {"role_id": 2}
    result = schema.load(data)
    assert result == {"role_id": 2}

    # Only updating rule
    data = {"rule": json.dumps({"allowed": [{"database": "newdb"}], "denied": []})}
    result = schema.load(data)
    assert "rule" in result


def test_put_schema_validates_rule_if_provided():
    """Test that PUT schema validates rule if provided."""
    schema = DataAccessRulePutSchema()
    data = {
        "rule": "invalid json",
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(data)
    assert "Invalid JSON" in str(exc_info.value)


def test_post_schema_empty_allowed_denied():
    """Test that empty allowed and denied lists are valid."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": json.dumps({"allowed": [], "denied": []}),
    }
    result = schema.load(data)
    assert result["role_id"] == 1


def test_post_schema_cls_all_valid_actions():
    """Test all valid CLS actions are accepted."""
    schema = DataAccessRulePostSchema()
    data = {
        "role_id": 1,
        "rule": json.dumps(
            {
                "allowed": [
                    {
                        "database": "mydb",
                        "schema": "public",
                        "cls": {
                            "col1": "hash",
                            "col2": "HASH",  # Case insensitive
                            "col3": "nullify",
                            "col4": "NULLIFY",
                            "col5": "mask",
                            "col6": "MASK",
                            "col7": "hide",
                            "col8": "HIDE",
                        },
                    }
                ],
                "denied": [],
            }
        ),
    }
    result = schema.load(data)
    assert result["role_id"] == 1
