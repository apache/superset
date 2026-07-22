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


def test_security_api_trailing_slash_matches_route_ownership(client: Any) -> None:
    """Regression for #29934: sibling ``/api/v1/security/*`` endpoints respond to
    a misspelled (wrong trailing-slash) URL differently, and that difference is
    the *intended* behavior — a Werkzeug routing artifact of who owns each route,
    not a bug.

    Three routes live under the same ``/api/v1/security/`` prefix but are
    declared with different slash conventions because they come from different
    owners:

      * ``login``       -> ``@expose("/login")``        (no trailing slash)
        Flask-AppBuilder's own route. Superset does not own or register it, so
        it inherits FAB's no-trailing-slash convention. Werkzeug hard-404s a
        request that adds a stray trailing slash to a no-slash route (there is
        no canonical slashed URL to redirect to).
      * ``csrf_token``  -> ``@expose("/csrf_token/")``  (trailing slash)
      * ``guest_token`` -> ``@expose("/guest_token/")`` (trailing slash)
        Superset's own routes, whose trailing-slash URLs are the documented
        canonical URLs (the Embedded SDK depends on them). Werkzeug 308-redirects
        a request that omits the trailing slash to the canonical slashed URL.

    Unifying the two would either break the documented ``csrf_token`` /
    ``guest_token`` URLs the Embedded SDK relies on, or require patching FAB /
    an app-wide routing change. So the divergence is working-as-designed. This
    test pins that intended per-route contract so the behavior stays documented
    and any accidental future change is caught.
    """
    # Control: the canonical (no trailing slash) login route is registered and
    # reachable, so the 404 below is specific to the stray slash rather than
    # the route being missing entirely.
    response = client.open("/api/v1/security/login", method="POST")
    assert response.status_code != 404

    # FAB-owned no-trailing-slash route: adding a stray slash hard-404s because
    # there is no canonical slashed URL to redirect to.
    response = client.open(
        "/api/v1/security/login/", method="POST", follow_redirects=False
    )
    assert response.status_code == 404

    # Superset-owned canonical trailing-slash routes: omitting the trailing
    # slash 308-redirects to the documented canonical URL.
    response = client.open(
        "/api/v1/security/csrf_token", method="GET", follow_redirects=False
    )
    assert response.status_code == 308
    assert response.headers["Location"].endswith("/api/v1/security/csrf_token/")

    response = client.open(
        "/api/v1/security/guest_token", method="POST", follow_redirects=False
    )
    assert response.status_code == 308
    assert response.headers["Location"].endswith("/api/v1/security/guest_token/")


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
