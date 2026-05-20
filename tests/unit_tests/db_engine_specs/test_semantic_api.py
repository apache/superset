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

# pylint: disable=import-outside-toplevel

from typing import Any
from unittest.mock import MagicMock, patch

from sqlalchemy.engine.url import make_url

from superset.utils import json


def _columns() -> list[dict[str, Any]]:
    return [
        {
            "name": "region",
            "type": "TEXT",
            "nullable": True,
            "default": None,
            "comment": "dimension",
        },
        {
            "name": "total_revenue",
            "type": "FLOAT",
            "nullable": True,
            "default": None,
            "comment": "metric",
            "computed": {"sqltext": "total_revenue", "persisted": True},
        },
    ]


def test_engine_spec_identity() -> None:
    """
    The engine and dialect names line up with the shillelagh dialect.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    assert SemanticAPIEngineSpec.engine == "semanticapi"
    assert SemanticAPIEngineSpec.engine_name == "Semantic Layer API"
    assert "semanticapi://" in SemanticAPIEngineSpec.sqlalchemy_uri_placeholder


def test_select_star_returns_warning() -> None:
    """
    Data preview is replaced with a single-row warning message.
    """
    from superset.db_engine_specs.semantic_api import (
        SELECT_STAR_MESSAGE,
        SemanticAPIEngineSpec,
    )

    sql = SemanticAPIEngineSpec.select_star()
    assert sql.startswith("SELECT '")
    assert sql.endswith("' AS warning")
    # The single-quote escape is preserved verbatim.
    assert SELECT_STAR_MESSAGE.replace("'", "''") in sql


def test_get_columns_filters_metrics() -> None:
    """
    Only non-computed columns (dimensions) flow through ``get_columns``.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    inspector = MagicMock()
    inspector.get_columns.return_value = _columns()

    table = MagicMock()
    table.table = "sales"
    table.schema = None

    columns = SemanticAPIEngineSpec.get_columns(inspector, table)
    assert [c["name"] for c in columns] == ["region"]
    assert columns[0]["column_name"] == "region"


def test_adjust_engine_params_folds_extra_into_url() -> None:
    """
    ``additional_configuration`` from ``connect_args`` ends up on the URL query.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    uri, connect_args = SemanticAPIEngineSpec.adjust_engine_params(
        make_url("sqlite://"),
        {"additional_configuration": {"workspace": "acme"}, "other": 1},
    )
    assert "additional_configuration" not in connect_args
    assert connect_args["other"] == 1
    assert json.loads(uri.query["additional_configuration"]) == {"workspace": "acme"}


def test_adjust_engine_params_string_passthrough() -> None:
    """
    A pre-serialised string config is forwarded verbatim.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    uri, _ = SemanticAPIEngineSpec.adjust_engine_params(
        make_url("sqlite://"),
        {"additional_configuration": '{"workspace":"acme"}'},
    )
    assert uri.query["additional_configuration"] == '{"workspace":"acme"}'


def test_adjust_engine_params_no_extra() -> None:
    """
    Without ``additional_configuration`` the URL is untouched.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    uri, connect_args = SemanticAPIEngineSpec.adjust_engine_params(
        make_url("sqlite://"),
        {"other": 1},
    )
    assert uri.query == {}
    assert connect_args == {"other": 1}


def test_supports_oauth2_flag() -> None:
    """
    The engine spec advertises OAuth2 support and treats ``UnauthenticatedError``
    as the trigger to start the dance.
    """
    from shillelagh.exceptions import UnauthenticatedError

    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec
    from superset.exceptions import OAuth2TokenRefreshError

    assert SemanticAPIEngineSpec.supports_oauth2 is True
    assert UnauthenticatedError in SemanticAPIEngineSpec.oauth2_exception
    assert OAuth2TokenRefreshError in SemanticAPIEngineSpec.oauth2_exception
    assert SemanticAPIEngineSpec.encrypted_extra_sensitive_fields == {
        "$.oauth2_client_info.secret": "OAuth2 Client Secret",
    }


def test_needs_oauth2_for_unauthenticated() -> None:
    """
    ``UnauthenticatedError`` with a logged-in user starts the dance.
    """
    from shillelagh.exceptions import UnauthenticatedError

    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    fake_g = MagicMock()
    fake_g.user = MagicMock()
    with patch("superset.db_engine_specs.semantic_api.g", fake_g):
        assert (
            SemanticAPIEngineSpec.needs_oauth2(UnauthenticatedError("expired")) is True
        )


def test_needs_oauth2_ignores_unrelated_exceptions() -> None:
    """
    Unrelated exception types don't trigger the dance.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    fake_g = MagicMock()
    fake_g.user = MagicMock()
    with patch("superset.db_engine_specs.semantic_api.g", fake_g):
        assert SemanticAPIEngineSpec.needs_oauth2(RuntimeError("boom")) is False


def test_needs_oauth2_requires_user_context() -> None:
    """
    Outside a request (no ``g.user``) the dance is not started.
    """
    from shillelagh.exceptions import UnauthenticatedError

    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    class _NoUserG:
        def __bool__(self) -> bool:
            return True

    with patch("superset.db_engine_specs.semantic_api.g", _NoUserG()):
        assert (
            SemanticAPIEngineSpec.needs_oauth2(UnauthenticatedError("expired")) is False
        )


def test_impersonate_user_injects_access_token() -> None:
    """
    With a cached OAuth2 token the URL gains ``?access_token=…``.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    url, engine_kwargs = SemanticAPIEngineSpec.impersonate_user(
        database=MagicMock(),
        username=None,
        user_token="demo-access-token",
        url=make_url("sqlite://"),
        engine_kwargs={"connect_args": {}},
    )
    assert url.query["access_token"] == "demo-access-token"
    assert engine_kwargs == {"connect_args": {}}


def test_impersonate_user_without_token_is_a_noop() -> None:
    """
    Without a token, neither the URL nor engine_kwargs are changed.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    original_url = make_url("sqlite://")
    url, engine_kwargs = SemanticAPIEngineSpec.impersonate_user(
        database=MagicMock(),
        username=None,
        user_token=None,
        url=original_url,
        engine_kwargs={},
    )
    assert url is original_url
    assert engine_kwargs == {}


def test_build_sqlalchemy_uri_minimum() -> None:
    """
    Just host → ``semanticapi://host/``.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    assert (
        SemanticAPIEngineSpec.build_sqlalchemy_uri(
            {"host": "localhost"},
        )
        == "semanticapi://localhost"
    )


def test_build_sqlalchemy_uri_full() -> None:
    """
    Host, port, secure, ``additional_configuration`` and OAuth client info all
    round-trip cleanly. The OAuth2 URIs get auto-filled from host:port.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    encrypted_extra = {
        "oauth2_client_info": {"id": "demo-client", "secret": "demo-secret"},
    }
    uri = SemanticAPIEngineSpec.build_sqlalchemy_uri(
        {
            "host": "h",
            "port": 8000,
            "secure": True,
            "additional_configuration": {"workspace": "acme"},
        },
        encrypted_extra,
    )
    parsed = make_url(uri)
    assert parsed.host == "h"
    assert parsed.port == 8000
    assert parsed.query["secure"] == "true"
    assert json.loads(parsed.query["additional_configuration"]) == {"workspace": "acme"}

    oauth2 = encrypted_extra["oauth2_client_info"]
    assert oauth2["authorization_request_uri"] == "https://h:8000/authorize"
    assert oauth2["token_request_uri"] == "https://h:8000/token"
    assert oauth2["scope"] == ""


def test_build_sqlalchemy_uri_oauth_uri_overrides_preserved() -> None:
    """
    Existing OAuth URIs are left alone (no clobbering of explicit overrides).
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    encrypted_extra = {
        "oauth2_client_info": {
            "id": "x",
            "secret": "y",
            "authorization_request_uri": "https://idp/authorize",
            "token_request_uri": "https://idp/token",
        },
    }
    SemanticAPIEngineSpec.build_sqlalchemy_uri({"host": "h"}, encrypted_extra)
    oauth2 = encrypted_extra["oauth2_client_info"]
    assert oauth2["authorization_request_uri"] == "https://idp/authorize"
    assert oauth2["token_request_uri"] == "https://idp/token"


def test_build_sqlalchemy_uri_additional_configuration_string() -> None:
    """
    A pre-serialised ``additional_configuration`` string is forwarded as-is.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    uri = SemanticAPIEngineSpec.build_sqlalchemy_uri(
        {"host": "h", "additional_configuration": '{"x":1}'},
    )
    assert make_url(uri).query["additional_configuration"] == '{"x":1}'


def test_get_parameters_from_uri_roundtrip() -> None:
    """
    A URL produced by ``build_sqlalchemy_uri`` is parsed back to the same parameters.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    encrypted_extra = {"oauth2_client_info": {"id": "x", "secret": "y"}}
    uri = SemanticAPIEngineSpec.build_sqlalchemy_uri(
        {
            "host": "h",
            "port": 8000,
            "secure": True,
            "additional_configuration": {"workspace": "acme"},
        },
        encrypted_extra,
    )
    params = SemanticAPIEngineSpec.get_parameters_from_uri(uri, encrypted_extra)
    assert params["host"] == "h"
    assert params["port"] == 8000
    assert params["secure"] is True
    assert params["additional_configuration"] == {"workspace": "acme"}
    assert params["oauth2_client_info"]["id"] == "x"


def test_get_parameters_from_uri_invalid_additional_configuration() -> None:
    """
    Garbage in ``additional_configuration`` doesn't blow up — set to None.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    params = SemanticAPIEngineSpec.get_parameters_from_uri(
        "semanticapi://h/?additional_configuration=not-json",
    )
    assert params["additional_configuration"] is None


def test_validate_parameters_missing_host() -> None:
    """
    A missing host produces a clear validation error.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    errors = SemanticAPIEngineSpec.validate_parameters({"parameters": {}})
    assert len(errors) == 1
    assert errors[0].extra["missing"] == ["host"]


def test_validate_parameters_happy() -> None:
    """
    With a host, no errors are reported.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    assert (
        SemanticAPIEngineSpec.validate_parameters(
            {"parameters": {"host": "localhost"}},
        )
        == []
    )


def test_parameters_json_schema_exposes_fields() -> None:
    """
    ``parameters_json_schema`` advertises every form field so the frontend
    can render it.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    schema = SemanticAPIEngineSpec.parameters_json_schema()
    properties = schema["properties"]
    assert set(properties).issuperset(
        {"host", "port", "secure", "additional_configuration", "oauth2_client_info"},
    )
    # oauth2_client_info is marked as encrypted so the frontend stores it in
    # ``encrypted_extra``.
    assert properties["oauth2_client_info"].get("x-encrypted-extra") is True


def test_get_metrics_extracts_computed() -> None:
    """
    Computed columns become Superset metric definitions.
    """
    from superset.db_engine_specs.semantic_api import SemanticAPIEngineSpec

    inspector = MagicMock()
    inspector.get_columns.return_value = _columns()

    table = MagicMock()
    table.table = "sales"
    table.schema = None

    metrics = SemanticAPIEngineSpec.get_metrics(MagicMock(), inspector, table)
    assert metrics == [
        {
            "metric_name": "total_revenue",
            "expression": "total_revenue",
            "description": "metric",
        },
    ]
