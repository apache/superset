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
"""Shared handlers for the ``/versions/`` REST endpoints.

Each ``ChartRestApi`` / ``DashboardRestApi`` / ``DatasetRestApi`` carries
the same read endpoint methods — ``list_versions`` and ``get_version`` —
whose bodies are byte-for-byte identical apart from the model class and
the ``security_manager.raise_for_access`` kwarg. Extracting the bodies
here lets each per-resource method collapse to a single delegation call,
while the OpenAPI docstring + FAB decorators stay at the method site
where they belong.

(The restore endpoint ships in a later PR; only the read endpoints are
wired here.)
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


def _resolve_entity(
    api: Any,
    model_cls: type[Model],
    uuid_str: str,
    access_kwarg: str,
) -> tuple[Any, UUID] | Response:
    """Parse the path UUID, look up the live entity, run the read-access
    gate.

    Returns ``(entity, entity_uuid)`` on success or a pre-built
    ``Response`` (400 / 403 / 404) that the caller should return
    directly. The split shape keeps the call site terse and lets the
    three handler functions share the preflight without each repeating
    the try / except dance.
    """
    try:
        entity_uuid = UUID(uuid_str)
    except ValueError:
        return api.response_400(message="Invalid UUID")

    entity = VersionDAO.find_active_by_uuid(model_cls, entity_uuid)
    if entity is None:
        return api.response_404()

    try:
        security_manager.raise_for_access(**{access_kwarg: entity})
    except SupersetSecurityException:
        return api.response_403()

    return entity, entity_uuid


def list_versions_endpoint(
    api: Any,
    model_cls: type[Model],
    uuid_str: str,
    access_kwarg: str,
) -> Response:
    """Body of ``GET /api/v1/{resource}/<uuid>/versions/``."""
    resolved = _resolve_entity(api, model_cls, uuid_str, access_kwarg)
    if isinstance(resolved, Response):
        return resolved
    entity, entity_uuid = resolved

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
    access_kwarg: str,
) -> Response:
    """Body of ``GET /api/v1/{resource}/<uuid>/versions/<version_uuid>/``."""
    resolved = _resolve_entity(api, model_cls, uuid_str, access_kwarg)
    if isinstance(resolved, Response):
        return resolved
    entity, entity_uuid = resolved

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
