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
the same three endpoint methods — ``list_versions``, ``get_version``,
``restore_version`` — whose bodies are byte-for-byte identical apart
from the model class, the ``security_manager.raise_for_access`` kwarg,
and the resource-specific exception triplet on the restore path.
Extracting the bodies here lets each per-resource method collapse to
a single delegation call, while the OpenAPI docstring + FAB decorators
stay at the method site where they belong.

The corresponding helper for the activity-view endpoint family lives
at :func:`superset.versioning.activity.resolve_endpoint_path_entity`;
it does only the path-entity resolution step (not the DAO + ETag
wrapping), because the activity endpoints follow a different result
shape.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from flask import Response
from flask_appbuilder import Model

from superset.daos.version import VersionDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import security_manager
from superset.versioning.etag import set_version_etag_by_uuid

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RestoreEndpointSpec:
    """Per-resource configuration for :func:`restore_version_endpoint`.

    Bundles the five fields that differ across the three /versions/restore
    endpoint families (chart / dashboard / dataset) so the endpoint
    function signature stays at four call-time parameters instead of
    nine. Each per-resource RestApi declares a module-level instance
    (e.g. ``_CHART_RESTORE_SPEC``) and passes it through.

    All fields are required; the dataclass is frozen so the spec can be
    safely declared as a module-level constant.
    """

    command_cls: type
    not_found_exc: type[Exception]
    forbidden_exc: type[Exception]
    update_failed_exc: type[Exception]
    resource_label: str


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
    return set_version_etag_by_uuid(
        api.response(200, result=versions, count=len(versions)),
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
    return set_version_etag_by_uuid(
        api.response(200, result=snapshot),
        model_cls,
        entity_uuid,
        entity_id=entity.id,
    )


def restore_version_endpoint(
    api: Any,
    model_cls: type[Model],
    uuid_str: str,
    version_uuid_str: str,
    spec: RestoreEndpointSpec,
) -> Response:
    """Body of ``POST /api/v1/{resource}/<uuid>/versions/<version_uuid>/restore``.

    Does not use :func:`_resolve_entity` — the restore command runs
    its own ownership / existence checks via ``raise_for_ownership``
    in ``BaseRestoreVersionCommand.validate`` and turns failures into
    the resource-specific exception triplet packed in *spec*.
    """
    try:
        entity_uuid = UUID(uuid_str)
    except ValueError:
        return api.response_400(message="Invalid UUID")
    try:
        version_uuid = UUID(version_uuid_str)
    except ValueError:
        return api.response_400(message="Invalid version UUID")

    try:
        spec.command_cls(entity_uuid, version_uuid).run()
    except spec.not_found_exc:
        return api.response_404()
    except spec.forbidden_exc:
        return api.response_403()
    except spec.update_failed_exc as ex:
        logger.error("Error restoring %s version: %s", spec.resource_label, ex)
        return api.response_422(message=str(ex))
    return set_version_etag_by_uuid(
        api.response(200, message="OK"), model_cls, entity_uuid
    )
