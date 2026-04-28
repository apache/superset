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
"""REST endpoint for the aggregated soft-deleted items listing."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from flask import Response
from flask_appbuilder.api import expose, protect, rison, safe

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.extensions import event_logger
from superset.deleted.dao import ALL_TYPES, DeletedDAO
from superset.deleted.schemas import (
    DeletedByUserSchema,
    get_deleted_schema,
    DeletedListItemSchema,
    DeletedListResponseSchema,
    SORT_COLUMNS,
)
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100


class DeletedRestApi(BaseSupersetApi):
    """Aggregated soft-deleted items listing — powers the frontend
    "Archive" view by unioning soft-deleted charts, dashboards, and
    datasets the caller is authorised to see.

    See ``specs/sc-103157-soft-deletes/spec.md`` User Story 4 and
    FR-014 – FR-017.
    """

    resource_name = "deleted"
    openapi_spec_tag = "Deleted"
    openapi_spec_component_schemas = (
        DeletedByUserSchema,
        DeletedListItemSchema,
        DeletedListResponseSchema,
    )
    allow_browser_login = True

    # FAB permission wiring. Row-level access is enforced inside the
    # DAO via each entity's base security filter (see FR-016); the
    # class-level permission is the minimum authenticated gate.
    class_permission_name = "Deleted"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    list_schema = DeletedListResponseSchema()

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_deleted_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_list",
        log_to_statsd=True,
    )
    def get_list(self, **kwargs: Any) -> Response:
        """Aggregated soft-deleted items listing.
        ---
        get:
          summary: List soft-deleted charts, dashboards, and datasets
          description: >
            Returns the union of soft-deleted charts, dashboards, and
            datasets the caller is authorised to see, in a single
            paginated response. Query parameters are passed via a
            rison-encoded ``q`` object, matching the convention used
            by the other Superset list endpoints. See
            sc-103157-soft-deletes User Story 4.
          parameters:
            - in: query
              name: q
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/get_deleted_schema'
          responses:
            200:
              description: Paginated list of soft-deleted items.
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/DeletedListResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
        """
        try:
            params = _parse_rison(kwargs.get("rison") or {})
        except ValueError as ex:
            return self.response_400(message=str(ex))

        rows, count = DeletedDAO.list_items(**params)
        payload = self.list_schema.dump({"result": rows, "count": count})
        return self.response(200, **payload)


def _parse_rison(args: dict[str, Any]) -> dict[str, Any]:
    """Normalise a rison-decoded query-string into DAO kwargs.

    Schema-level validation (allowed ``types`` / ``order_column`` /
    ``order_direction`` values, page bounds) is handled by
    ``@rison(get_deleted_schema)`` before this function runs.
    Remaining work: defaulting, ISO-date parsing, and trivial type
    coercions. Raises ``ValueError`` (translated to HTTP 400) on
    issues the JSON-schema can't express — malformed timestamps are
    the only realistic case.
    """
    types = args.get("types") or list(ALL_TYPES)
    search = args.get("search") or None

    deleted_from = _parse_iso_datetime(args.get("deleted_from"), "deleted_from")
    deleted_to = _parse_iso_datetime(args.get("deleted_to"), "deleted_to")

    order_column = args.get("order_column") or "deleted_at"
    order_direction = args.get("order_direction")
    if order_direction is None:
        order_direction = "desc" if order_column == "deleted_at" else "asc"

    page = int(args.get("page", 0))
    page_size = int(args.get("page_size", DEFAULT_PAGE_SIZE))
    if page_size > MAX_PAGE_SIZE:
        page_size = MAX_PAGE_SIZE

    return {
        "types": types,
        "search": search,
        "deleted_from": deleted_from,
        "deleted_to": deleted_to,
        "order_column": order_column,
        "order_direction": order_direction,
        "page": page,
        "page_size": page_size,
    }


def _parse_iso_datetime(value: str | None, field_name: str) -> datetime | None:
    if value is None or value == "":
        return None
    try:
        # ``fromisoformat`` in Python 3.11+ accepts the trailing ``Z``;
        # normalise defensively for older payloads.
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as ex:
        raise ValueError(f"Invalid ISO-8601 value for {field_name}: {value}") from ex


# Re-exported so callers (tests, docs generation) can reason about
# valid sort columns without reaching into dao internals.
__all__ = ["DEFAULT_PAGE_SIZE", "MAX_PAGE_SIZE", "SORT_COLUMNS", "DeletedRestApi"]
