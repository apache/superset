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

"""HTTP metadata boundaries preserve responses and sanitize typed failures."""

from __future__ import annotations

from collections.abc import Callable

import pytest
from flask import Flask
from flask_appbuilder.api import BaseApi
from sqlalchemy.exc import SQLAlchemyError
from superset_core.semantic_layers.metadata import MetadataRefreshError

from superset.semantic_layers.metadata_errors import (
    metadata_api_errors,
    metadata_database_errors,
    metadata_legacy_errors,
)
from superset.superset_typing import FlaskResponse


@pytest.mark.parametrize(
    "decorate", [metadata_api_errors, metadata_database_errors, metadata_legacy_errors]
)
def test_metadata_boundary_preserves_response_and_unrelated_errors(
    app: Flask,
    decorate: Callable[[Callable[..., FlaskResponse]], Callable[..., FlaskResponse]],
) -> None:
    """Forward arguments and the original response; do not disguise other errors."""
    api: BaseApi = BaseApi()
    unrelated: ValueError = ValueError("unrelated failure")
    caught: pytest.ExceptionInfo[ValueError]

    @decorate
    def endpoint(owner: BaseApi, value: str, *, suffix: str) -> FlaskResponse:
        """Return the supplied payload or raise the unrelated error."""
        assert owner is api
        if not value:
            raise unrelated
        return owner.response(201, message=value + suffix)

    with app.test_request_context():
        response: FlaskResponse = endpoint(api, "accepted", suffix="!")
        assert app.make_response(response).status_code == 201
        assert app.make_response(response).get_json() == {"message": "accepted!"}
        with pytest.raises(ValueError, match="unrelated failure") as caught:
            endpoint(api, "", suffix="!")
        assert caught.value is unrelated
    assert endpoint.__name__ == "endpoint"


@pytest.mark.parametrize("decorate", [metadata_api_errors, metadata_legacy_errors])
def test_metadata_boundary_returns_safe_category_without_vendor_details(
    app: Flask,
    caplog: pytest.LogCaptureFixture,
    decorate: Callable[[Callable[..., FlaskResponse]], Callable[..., FlaskResponse]],
) -> None:
    """REST and legacy adapters share the contract and suppress exception chains."""
    api: BaseApi = BaseApi()
    cause: ValueError = ValueError("vendor-secret")

    @decorate
    def endpoint(owner: BaseApi) -> FlaskResponse:
        """Simulate a categorized provider failure with a sensitive cause."""
        raise MetadataRefreshError("upstream") from cause

    with app.test_request_context():
        response: FlaskResponse = endpoint(api)
        assert app.make_response(response).status_code == 502
        assert app.make_response(response).get_json() == {
            "error": "upstream",
            "message": (
                "The semantic layer could not return its catalog. Try again later."
            ),
        }
    assert "Semantic metadata operation failed: upstream" in caplog.text
    assert "vendor-secret" not in caplog.text


@pytest.mark.parametrize("enabled", [False, True])
def test_metadata_database_boundary_only_maps_when_enabled(
    app: Flask, monkeypatch: pytest.MonkeyPatch, enabled: bool
) -> None:
    """Feature-off database failures retain their original exception identity."""
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_errors.metadata_refresh_enabled",
        lambda: enabled,
    )
    api: BaseApi = BaseApi()
    error: SQLAlchemyError = SQLAlchemyError("database-secret")
    caught: pytest.ExceptionInfo[SQLAlchemyError]

    @metadata_database_errors
    def endpoint(owner: BaseApi) -> FlaskResponse:
        """Simulate a database failure at the endpoint boundary."""
        raise error

    with app.test_request_context():
        if enabled:
            response: FlaskResponse = endpoint(api)
            assert app.make_response(response).status_code == 503
            assert app.make_response(response).get_json() == {
                "error": "unavailable",
                "message": "Metadata database is unavailable. Try again later.",
            }
        else:
            with pytest.raises(SQLAlchemyError) as caught:
                endpoint(api)
            assert caught.value is error
