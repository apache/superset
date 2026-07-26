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
"""Shared handlers for the ``/versions/`` and ``/activity/`` REST endpoints.

Each ``ChartRestApi`` / ``DashboardRestApi`` / ``DatasetRestApi`` carries
the same read endpoint methods — ``list_versions`` and ``get_version`` —
plus the ``activity`` endpoint on each resource. The bodies are
byte-for-byte identical apart from the model class and the
``security_manager.raise_for_access`` kwarg. Extracting the bodies here
lets each per-resource method collapse to a single delegation call, while
the OpenAPI docstring + FAB decorators stay at the method site where they
belong.

(The restore endpoint ships in a later PR; only the read + activity
endpoints are wired here.)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from flask import current_app, Response
from flask_appbuilder import Model

from superset.daos.version import VersionDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import db, security_manager
from superset.versioning.etag import set_version_etag_by_uuid
from superset.versioning.schemas import VersionListItemSchema

#: Serializer for version rows (list items and the ``_version`` block of a
#: single-version snapshot — same shape). Dumping through marshmallow
#: instead of handing raw dicts to ``jsonify`` keeps ``issued_at``
#: ISO-8601 (Flask's default JSON provider renders datetimes as RFC-1123
#: http-dates) and ``version_uuid`` consistently a string (the list rows
#: carry UUID instances, the snapshot block pre-stringifies).
_version_item_schema = VersionListItemSchema()


@dataclass
class EntityVersionInfo:
    """Live version identifiers for a write-endpoint response.

    Every field is ``None`` when ``ENABLE_VERSIONING_CAPTURE`` is off — the
    write endpoints then issue no version queries at all, so they stay inert
    under the kill-switch rather than paying save-path latency the flag is
    meant to eliminate.
    """

    version: int | None = None
    transaction_id: int | None = None
    version_uuid: str | None = None


def _capture_enabled() -> bool:
    return bool(current_app.config.get("ENABLE_VERSIONING_CAPTURE", False))


def current_entity_version_info(
    model_cls: type[Model],
    entity_id: int | None,
    entity_uuid: UUID | None = None,
) -> EntityVersionInfo:
    """Resolve the live version number, transaction id, and version uuid.

    Returns an empty (all-``None``) record and issues *no* queries when
    capture is disabled. When *entity_uuid* is not supplied it is resolved
    with a single ``SELECT uuid`` rather than loading the whole entity row.
    """
    if entity_id is None or not _capture_enabled():
        return EntityVersionInfo()
    try:
        # PUT routes declare ``/<pk>`` (a string segment), so ``entity_id`` can
        # arrive as a non-numeric string. Coerce here and bail to empty info on
        # a bad id, so this pre-command version lookup doesn't raise a raw SQL
        # type-cast error ahead of the command layer's normal 404 handling.
        entity_id = int(entity_id)
    except (TypeError, ValueError):
        return EntityVersionInfo()
    if entity_uuid is None:
        entity_uuid = db.session.scalar(
            sa.select(model_cls.uuid).where(model_cls.id == entity_id)
        )
    version_uuid = (
        VersionDAO.current_live_version_uuid(model_cls, entity_id, entity_uuid)
        if entity_uuid is not None
        else None
    )
    return EntityVersionInfo(
        version=VersionDAO.current_version_number(model_cls, entity_id),
        transaction_id=VersionDAO.current_live_transaction_id(model_cls, entity_id),
        version_uuid=str(version_uuid) if version_uuid else None,
    )


def current_entity_etag_uuid(
    model_cls: type[Model],
    entity_id: int | None,
    entity_uuid: UUID | None,
) -> str | None:
    """Resolve only the live version uuid (for an ETag), gated by capture.

    Returns ``None`` without querying when capture is off or either id is
    missing.
    """
    if entity_id is None or entity_uuid is None or not _capture_enabled():
        return None
    version_uuid = VersionDAO.current_live_version_uuid(
        model_cls, entity_id, entity_uuid
    )
    return str(version_uuid) if version_uuid else None


# Maps the versioned model class name to the keyword argument
# ``security_manager.raise_for_access`` expects for the per-resource
# gate. Slice → ``chart=``, Dashboard → ``dashboard=``, SqlaTable →
# ``datasource=``. Centralised here so /versions/ and /activity/
# endpoints share one source of truth for the dispatch.
_RAISE_FOR_ACCESS_KWARG: dict[str, str] = {
    "Slice": "chart",
    "Dashboard": "dashboard",
    "SqlaTable": "datasource",
}


class PathEntityResponseError(Exception):
    """Carry a pre-built error response from endpoint path resolution.

    Endpoints catch it and return
    the carried response directly. The shape exists so the
    UUID-parse + find-by-uuid + read-access check can live in one
    place across the ``/versions/`` and ``/activity/`` endpoint
    families."""

    def __init__(self, response: Any) -> None:
        super().__init__("PathEntityResponseError")
        self.response = response


def resolve_endpoint_path_entity(
    api: Any, model_cls: type[Model], uuid_str: str
) -> tuple[Any, UUID]:
    """Run path-entity preflight for a versions or activity endpoint.

    1. Parse *uuid_str* into a UUID (or raise → 400).
    2. Look up the live entity via ``VersionDAO.find_active_by_uuid``
       (or raise → 404).
    3. Run ``security_manager.raise_for_access`` with the resource-typed
       kwarg (or raise → 403).

    Returns ``(entity, entity_uuid)`` on success — the parsed UUID is
    threaded out so callers don't re-parse the path-string. Raises
    :class:`PathEntityResponseError` carrying the appropriate error
    Response on any failure; the endpoint method should::

        try:
            entity, entity_uuid = resolve_endpoint_path_entity(
                self, Dashboard, uuid_str
            )
        except PathEntityResponseError as exc:
            return exc.response

    *api* is the FAB ``ModelRestApi`` instance — we call
    ``api.response_400`` / ``api.response_403`` / ``api.response_404``
    on it. Pass ``self`` from the endpoint method.
    """
    try:
        entity_uuid = UUID(uuid_str)
    except ValueError as exc:
        raise PathEntityResponseError(api.response_400(message="Invalid UUID")) from exc

    entity = VersionDAO.find_active_by_uuid(model_cls, entity_uuid)
    if entity is None:
        raise PathEntityResponseError(api.response_404())

    # Direct ``[…]`` would leak the unknown model name into a generic 500
    # via the unhandled ``KeyError`` exception text. The three resource
    # families wired today cover every key; a future entity added to the
    # versioning surface without updating this dispatch table should fail
    # closed (the test suite picks it up) rather than silently disclose.
    kwarg = _RAISE_FOR_ACCESS_KWARG.get(model_cls.__name__)
    if kwarg is None:
        raise LookupError(
            f"No raise_for_access kwarg registered for {model_cls.__name__!r}"
        )
    try:
        security_manager.raise_for_access(**{kwarg: entity})
    except SupersetSecurityException as exc:
        raise PathEntityResponseError(api.response_403()) from exc

    return entity, entity_uuid


def list_versions_endpoint(
    api: Any,
    model_cls: type[Model],
    uuid_str: str,
) -> Response:
    """Body of ``GET /api/v1/{resource}/<uuid>/versions/``."""
    try:
        entity, entity_uuid = resolve_endpoint_path_entity(api, model_cls, uuid_str)
    except PathEntityResponseError as exc:
        return exc.response

    versions = VersionDAO.list_versions(model_cls, entity_uuid, entity=entity)
    if versions is None:
        return api.response_404()
    result = _version_item_schema.dump(versions, many=True)
    return set_version_etag_by_uuid(
        api.response(200, result=result, count=len(result)),
        model_cls,
        entity_uuid,
        entity_id=entity.id,
    )


def get_version_endpoint(
    api: Any,
    model_cls: type[Model],
    uuid_str: str,
    version_uuid_str: str,
) -> Response:
    """Body of ``GET /api/v1/{resource}/<uuid>/versions/<version_uuid>/``."""
    try:
        entity, entity_uuid = resolve_endpoint_path_entity(api, model_cls, uuid_str)
    except PathEntityResponseError as exc:
        return exc.response

    try:
        version_uuid = UUID(version_uuid_str)
    except ValueError:
        return api.response_400(message="Invalid version UUID")

    snapshot = VersionDAO.get_version(
        model_cls, entity_uuid, version_uuid, entity=entity
    )
    if snapshot is None:
        return api.response_404()
    # Normalize the version-level block through the schema; the entity
    # scalar fields stay as the DAO shaped them (their keys are
    # entity-specific by design).
    if "_version" in snapshot:
        snapshot["_version"] = _version_item_schema.dump(snapshot["_version"])
    return set_version_etag_by_uuid(
        api.response(200, result=snapshot),
        model_cls,
        entity_uuid,
        entity_id=entity.id,
    )
