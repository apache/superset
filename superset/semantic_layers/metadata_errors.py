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
from __future__ import annotations

import logging
from collections.abc import Callable
from functools import wraps
from typing import Any

from flask_appbuilder.api import BaseApi
from flask_babel import gettext as t
from sqlalchemy.exc import SQLAlchemyError
from superset_core.semantic_layers.metadata import (
    MetadataRefreshError,
    MetadataRefreshErrorCategory,
)

from superset.semantic_layers.metadata_binding import metadata_refresh_enabled
from superset.superset_typing import FlaskResponse

logger: logging.Logger = logging.getLogger(__name__)


def metadata_error_response(
    api: BaseApi | type[BaseApi], error: MetadataRefreshError
) -> FlaskResponse:
    """Return only stable categories and actionable, localized safe messages."""
    errors: dict[str, tuple[int, str]] = {
        "unsupported": (
            422,
            str(t("This semantic layer does not support metadata sync.")),
        ),
        "configuration": (
            422,
            str(
                t("Complete the semantic layer configuration before syncing metadata.")
            ),
        ),
        "in_progress": (
            409,
            str(t("A metadata sync is already in progress. Try again shortly.")),
        ),
        "configuration_changed": (
            409,
            str(
                t(
                    "The semantic view or connection changed. "
                    "Reopen the editor and try again."
                )
            ),
        ),
        "upstream": (
            502,
            str(t("The semantic layer could not return its catalog. Try again later.")),
        ),
        "invalid_payload": (
            502,
            str(t("The semantic layer returned an invalid or oversized catalog.")),
        ),
        "deadline": (504, str(t("Metadata sync timed out. Try again later."))),
        "unavailable": (
            503,
            str(t("Shared metadata storage is unavailable. Try again later.")),
        ),
        "indeterminate": (
            503,
            str(
                t(
                    "Metadata sync could not be confirmed. "
                    "Reload fields before trying again."
                )
            ),
        ),
    }
    status: int
    message: str
    status, message = errors[error.category]
    return api.response(status, error=error.category, message=message)


def metadata_api_errors(
    func: Callable[..., FlaskResponse],
) -> Callable[..., FlaskResponse]:
    """Map typed discovery errors, preserving unrelated endpoint failures."""

    @wraps(func)
    def wrapped(self: BaseApi, *args: Any, **kwargs: Any) -> FlaskResponse:
        try:
            return func(self, *args, **kwargs)
        except MetadataRefreshError as error:
            log_metadata_failure(error.category, error)
            return metadata_error_response(self, error)

    return wrapped


def log_metadata_failure(
    category: MetadataRefreshErrorCategory, error: Exception
) -> None:
    """Keep the traceback and category without logging vendor text or cause chains."""
    safe_error: MetadataRefreshError = MetadataRefreshError(category)
    logger.warning(
        "Semantic metadata operation failed: %s",
        category,
        exc_info=(MetadataRefreshError, safe_error, error.__traceback__),
    )


def metadata_database_errors(
    func: Callable[..., FlaskResponse],
) -> Callable[..., FlaskResponse]:
    """Map database failures only on enabled semantic maintenance/discovery routes."""

    @wraps(func)
    def wrapped(self: BaseApi, *args: Any, **kwargs: Any) -> FlaskResponse:
        try:
            return func(self, *args, **kwargs)
        except SQLAlchemyError as error:
            if not metadata_refresh_enabled():
                raise
            log_metadata_failure("unavailable", error)
            return self.response(
                503,
                error="unavailable",
                message=t("Metadata database is unavailable. Try again later."),
            )

    return wrapped


def metadata_legacy_errors(
    func: Callable[..., FlaskResponse],
) -> Callable[..., FlaskResponse]:
    """Apply the REST error contract at legacy datasource HTTP boundaries."""

    @wraps(func)
    def wrapped(*args: Any, **kwargs: Any) -> FlaskResponse:
        try:
            return func(*args, **kwargs)
        except MetadataRefreshError as error:
            log_metadata_failure(error.category, error)
            return metadata_error_response(BaseApi, error)

    return wrapped
