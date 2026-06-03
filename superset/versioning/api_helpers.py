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
the same three ``/versions/`` endpoint methods — ``list_versions``,
``get_version``, ``restore_version`` — plus the ``activity`` endpoint
on each resource. The bodies were byte-for-byte identical apart from
the model class, the ``security_manager.raise_for_access`` kwarg, and
the resource-specific exception triplet on the restore path.

Extracting the bodies here lets each per-resource method collapse to
a single delegation call, while the OpenAPI docstring + FAB decorators
stay at the method site where they belong.
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
    """Carries a pre-built error ``Response`` from
    :func:`resolve_endpoint_path_entity`. Endpoints catch it and return
    the carried response directly. The shape exists so the
    UUID-parse + find-by-uuid + read-access check can live in one
    place across the ``/versions/`` and ``/activity/`` endpoint
    families."""

    def __init__(self, response: Any) -> None:
        super().__init__("PathEntityResponseError")
        self.response = response


def resolve_endpoint_path_entity(api: Any, model_cls: type, uuid_str: str) -> Any:
    """Run the standard path-entity preflight for a /versions/ or
    /activity/ endpoint:

    1. Parse *uuid_str* into a UUID (or raise → 400).
    2. Look up the live entity via ``VersionDAO.find_active_by_uuid``
       (or raise → 404).
    3. Run ``security_manager.raise_for_access`` with the resource-typed
       kwarg (or raise → 403).

    Returns the live entity on success. Raises
    :class:`PathEntityResponseError` carrying the appropriate error
    Response on any failure; the endpoint method should::

        try:
            entity = resolve_endpoint_path_entity(self, Dashboard, uuid_str)
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

    kwarg = _RAISE_FOR_ACCESS_KWARG[model_cls.__name__]
    try:
        security_manager.raise_for_access(**{kwarg: entity})
    except SupersetSecurityException as exc:
        raise PathEntityResponseError(api.response_403()) from exc

    return entity


def list_versions_endpoint(
    api: Any,
    model_cls: type[Model],
    uuid_str: str,
) -> Response:
    """Body of ``GET /api/v1/{resource}/<uuid>/versions/``."""
    try:
        entity = resolve_endpoint_path_entity(api, model_cls, uuid_str)
    except PathEntityResponseError as exc:
        return exc.response
    entity_uuid = UUID(uuid_str)

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
) -> Response:
    """Body of ``GET /api/v1/{resource}/<uuid>/versions/<version_uuid>/``."""
    try:
        entity = resolve_endpoint_path_entity(api, model_cls, uuid_str)
    except PathEntityResponseError as exc:
        return exc.response
    entity_uuid = UUID(uuid_str)

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

    Does not use :func:`resolve_endpoint_path_entity` — the restore
    command runs its own ownership / existence checks via
    ``raise_for_ownership`` in ``BaseRestoreVersionCommand.validate``
    and turns failures into the resource-specific exception triplet
    packed in *spec*.
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
