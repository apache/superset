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

from typing import Any
from uuid import UUID

from flask import Response
from flask_appbuilder import Model

from superset.daos.version import VersionDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import security_manager
from superset.versioning.etag import set_version_etag_by_uuid
from superset.versioning.schemas import VersionListItemSchema

#: Serializer for version rows (list items and the ``_version`` block of a
#: single-version snapshot — same shape). Dumping through marshmallow
#: instead of handing raw dicts to ``jsonify`` keeps ``issued_at``
#: ISO-8601 (Flask's default JSON provider renders datetimes as RFC-1123
#: http-dates) and ``version_uuid`` consistently a string (the list rows
#: carry UUID instances, the snapshot block pre-stringifies).
_version_item_schema = VersionListItemSchema()


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
