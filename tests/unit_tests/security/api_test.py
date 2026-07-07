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
from typing import Any

import pytest
from marshmallow import ValidationError

from superset.extensions import csrf
from superset.security.api import RlsRuleSchema


@pytest.mark.parametrize(
    "app",
    # Enable the Swagger UI / OpenAPI spec (opt-in, off by default) so the
    # OpenApi blueprint is registered and included in the exempt set below.
    [{"WTF_CSRF_ENABLED": True, "FAB_API_SWAGGER_UI": True}],
    indirect=True,
)
def test_csrf_exempt_blueprints(app_context: None) -> None:
    """
    Test that only FAB security API blueprints (which use token-based auth)
    are exempt from CSRF protection.
    """
    assert {blueprint.name for blueprint in csrf._exempt_blueprints} == {
        "SupersetGroupApi",
        "MenuApi",
        "SecurityApi",
        "OpenApi",
        "SupersetPermissionViewMenuApi",
        "SupersetRoleApi",
        "SupersetUserApi",
        "PermissionApi",
        "ViewMenuApi",
    }


@pytest.mark.parametrize(
    "app",
    [
        {
            "WTF_CSRF_ENABLED": True,
            "FAB_API_KEY_ENABLED": True,
        }
    ],
    indirect=True,
)
def test_csrf_exempt_blueprints_with_api_key(app: Any, app_context: None) -> None:
    """
    Test that ApiKeyApi blueprint is CSRF-exempt when FAB_API_KEY_ENABLED
    config is enabled.
    """
    assert "ApiKeyApi" in {blueprint.name for blueprint in csrf._exempt_blueprints}


def test_rls_rule_schema_accepts_dataset_scoped_rule() -> None:
    """A rule with an integer ``dataset`` and a ``clause`` loads unchanged."""
    result = RlsRuleSchema().load({"dataset": 41, "clause": "tenant_id = 1"})
    assert result == {"dataset": 41, "clause": "tenant_id = 1"}


def test_rls_rule_schema_accepts_global_rule() -> None:
    """A rule with no ``dataset`` (a global rule) is still valid."""
    result = RlsRuleSchema().load({"clause": "tenant_id = 1"})
    assert result == {"clause": "tenant_id = 1"}


def test_rls_rule_schema_rejects_unknown_scope_key() -> None:
    """
    A mistyped or legacy scope key (e.g. ``datasource`` instead of ``dataset``)
    used to be silently dropped, turning the rule into an unintended global rule.
    It now raises a ``ValidationError`` that names the offending field.
    """
    with pytest.raises(ValidationError) as exc_info:
        RlsRuleSchema().load(
            {"datasource": {"id": 41, "type": "table"}, "clause": "tenant_id = 1"}
        )
    assert "datasource" in exc_info.value.messages


def test_rls_rule_schema_rejects_unknown_fields() -> None:
    """Any unexpected field on an RLS rule is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        RlsRuleSchema().load(
            {"dataset": 41, "clause": "tenant_id = 1", "extra": "nope"}
        )
    assert "extra" in exc_info.value.messages


def test_rls_rule_schema_requires_clause() -> None:
    """``clause`` remains required."""
    with pytest.raises(ValidationError) as exc_info:
        RlsRuleSchema().load({"dataset": 41})
    assert "clause" in exc_info.value.messages


@pytest.mark.parametrize("dataset", [0, -1, False])
def test_rls_rule_schema_rejects_falsy_dataset(dataset: Any) -> None:
    """
    A falsy ``dataset`` (``0``, a negative id, or ``false`` which marshmallow
    coerces to ``0``) would read as falsy in ``get_guest_rls_filters`` and
    silently widen a scoped rule to every dataset. It is rejected at load time.
    """
    with pytest.raises(ValidationError) as exc_info:
        RlsRuleSchema().load({"dataset": dataset, "clause": "tenant_id = 1"})
    assert "dataset" in exc_info.value.messages
