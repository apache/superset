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
Data Access Rules schemas for API serialization/deserialization.
"""

from marshmallow import fields, post_load, Schema, validates_schema, ValidationError

from superset.dashboards.schemas import UserSchema
from superset.data_access_rules.models import DataAccessRule

# Field descriptions for OpenAPI documentation
rule_description = """
A JSON document describing the access rule. The document should have two optional keys:
- `allowed`: List of entries describing what is allowed
- `denied`: List of entries describing what is denied

Each entry can specify:
- `database` (required): The database name
- `catalog` (optional): The catalog name
- `schema` (optional): The schema name
- `table` (optional): The table name
- `rls` (optional): Row-level security config with `predicate` and optional `group_key`
- `cls` (optional): Column-level security config mapping column names to actions

Example:
{
    "allowed": [
        {"database": "sales", "schema": "orders"},
        {"database": "sales", "schema": "orders", "table": "prices",
         "rls": {"predicate": "org_id = 123", "group_key": "org"}},
        {"database": "sales", "schema": "users", "table": "info",
         "cls": {"email": "mask", "ssn": "hide"}}
    ],
    "denied": [
        {"database": "sales", "schema": "internal"}
    ]
}

CLS actions: "hash", "nullify", "mask", "hide"
"""


class RoleSchema(Schema):
    """Schema for role information."""

    name = fields.String()
    id = fields.Integer()


class DataAccessRuleListSchema(Schema):
    """Schema for listing data access rules."""

    id = fields.Integer(metadata={"description": "Unique ID of the rule"})
    name = fields.String(metadata={"description": "Name of the rule"})
    description = fields.String(metadata={"description": "Description of the rule"})
    role_id = fields.Integer(metadata={"description": "ID of the associated role"})
    role = fields.Nested(RoleSchema)
    rule = fields.String(metadata={"description": rule_description})
    changed_on_delta_humanized = fields.Method("get_changed_on_delta_humanized")
    changed_by = fields.Nested(UserSchema(exclude=["username"]))

    def get_changed_on_delta_humanized(self, obj: DataAccessRule) -> str:
        return obj.changed_on_delta_humanized()


class DataAccessRuleShowSchema(Schema):
    """Schema for showing a single data access rule."""

    id = fields.Integer(metadata={"description": "Unique ID of the rule"})
    name = fields.String(metadata={"description": "Name of the rule"})
    description = fields.String(metadata={"description": "Description of the rule"})
    role_id = fields.Integer(metadata={"description": "ID of the associated role"})
    role = fields.Nested(RoleSchema)
    rule = fields.String(metadata={"description": rule_description})
    created_on = fields.DateTime()
    changed_on = fields.DateTime()
    created_by = fields.Nested(UserSchema(exclude=["username"]))
    changed_by = fields.Nested(UserSchema(exclude=["username"]))


class DataAccessRulePostSchema(Schema):
    """Schema for creating a data access rule."""

    name = fields.String(
        metadata={"description": "Name for this rule (optional)"},
        required=False,
        allow_none=True,
    )
    description = fields.String(
        metadata={"description": "Description of the rule (optional)"},
        required=False,
        allow_none=True,
    )
    role_id = fields.Integer(
        metadata={"description": "ID of the role this rule applies to"},
        required=True,
        allow_none=False,
    )
    rule = fields.String(
        metadata={"description": rule_description},
        required=True,
        allow_none=False,
    )

    @validates_schema
    def validate_rule_json(self, data: dict, **kwargs: dict) -> None:
        """Validate that the rule field contains valid JSON."""
        import json

        if rule := data.get("rule"):
            try:
                parsed = json.loads(rule)
                if not isinstance(parsed, dict):
                    raise ValidationError(
                        "Rule must be a JSON object", field_name="rule"
                    )

                # Validate structure
                allowed = parsed.get("allowed", [])
                denied = parsed.get("denied", [])

                if not isinstance(allowed, list):
                    raise ValidationError("'allowed' must be a list", field_name="rule")
                if not isinstance(denied, list):
                    raise ValidationError("'denied' must be a list", field_name="rule")

                # Validate entries
                for entry in allowed + denied:
                    if not isinstance(entry, dict):
                        raise ValidationError(
                            "Each entry must be an object", field_name="rule"
                        )
                    if "database" not in entry:
                        raise ValidationError(
                            "Each entry must have a 'database' field",
                            field_name="rule",
                        )

                    # Validate CLS actions if present
                    if cls_config := entry.get("cls"):
                        valid_actions = {"hash", "nullify", "mask", "hide"}
                        for col, action in cls_config.items():
                            if action.lower() not in valid_actions:
                                raise ValidationError(
                                    f"Invalid CLS action '{action}' for column '{col}'. "
                                    f"Valid actions: {valid_actions}",
                                    field_name="rule",
                                )
            except json.JSONDecodeError as ex:
                raise ValidationError(f"Invalid JSON: {ex}", field_name="rule") from ex

    @post_load
    def make_object(self, data: dict, **kwargs: dict) -> DataAccessRule:
        """Convert validated data to a DataAccessRule instance."""
        return DataAccessRule(**data)


class DataAccessRulePutSchema(Schema):
    """Schema for updating a data access rule."""

    name = fields.String(
        metadata={"description": "Name for this rule (optional)"},
        required=False,
        allow_none=True,
    )
    description = fields.String(
        metadata={"description": "Description of the rule (optional)"},
        required=False,
        allow_none=True,
    )
    role_id = fields.Integer(
        metadata={"description": "ID of the role this rule applies to"},
        required=False,
        allow_none=False,
    )
    rule = fields.String(
        metadata={"description": rule_description},
        required=False,
        allow_none=False,
    )

    @validates_schema
    def validate_rule_json(self, data: dict, **kwargs: dict) -> None:
        """Validate that the rule field contains valid JSON if provided."""
        import json

        if rule := data.get("rule"):
            try:
                parsed = json.loads(rule)
                if not isinstance(parsed, dict):
                    raise ValidationError(
                        "Rule must be a JSON object", field_name="rule"
                    )

                # Same validation as POST schema
                allowed = parsed.get("allowed", [])
                denied = parsed.get("denied", [])

                if not isinstance(allowed, list):
                    raise ValidationError("'allowed' must be a list", field_name="rule")
                if not isinstance(denied, list):
                    raise ValidationError("'denied' must be a list", field_name="rule")

                for entry in allowed + denied:
                    if not isinstance(entry, dict):
                        raise ValidationError(
                            "Each entry must be an object", field_name="rule"
                        )
                    if "database" not in entry:
                        raise ValidationError(
                            "Each entry must have a 'database' field",
                            field_name="rule",
                        )

                    if cls_config := entry.get("cls"):
                        valid_actions = {"hash", "nullify", "mask", "hide"}
                        for col, action in cls_config.items():
                            if action.lower() not in valid_actions:
                                raise ValidationError(
                                    f"Invalid CLS action '{action}' for column '{col}'. "
                                    f"Valid actions: {valid_actions}",
                                    field_name="rule",
                                )
            except json.JSONDecodeError as ex:
                raise ValidationError(f"Invalid JSON: {ex}", field_name="rule") from ex


class GroupKeysResponseSchema(Schema):
    """Schema for the group_keys endpoint response."""

    result = fields.List(
        fields.String(),
        metadata={"description": "List of unique group_key values used in RLS rules"},
    )
