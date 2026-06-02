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
"""ETag header emission for the entity-versioning API surface."""

from __future__ import annotations

from typing import Optional, TYPE_CHECKING
from uuid import UUID

import sqlalchemy as sa
from flask_appbuilder import Model

from superset.extensions import db

if TYPE_CHECKING:
    from flask import Response


def set_version_etag(response: "Response", version_uuid: Optional[UUID]) -> "Response":
    """Attach ``ETag: "<version_uuid>"`` to *response*.

    Uses RFC 7232 strong-validator form (no leading ``W/``); the response
    header value is wrapped in double quotes per the spec. No-op when
    *version_uuid* is ``None`` (entity has no version rows yet).
    """
    if version_uuid is not None:
        response.headers["ETag"] = f'"{version_uuid}"'
    return response


def set_version_etag_by_uuid(
    response: "Response", model_cls: type[Model], entity_uuid: UUID
) -> "Response":
    """Attach ``ETag`` derived from *entity_uuid*'s current live version.

    Looks up ``entity_id`` from *entity_uuid* via the model's ``uuid`` column,
    then derives ``version_uuid`` via :class:`VersionDAO`. No-op when the
    entity is missing or has no version rows yet.

    Prefer :func:`set_version_etag` when the caller already has the entity's
    integer id — this helper costs an extra ``SELECT id WHERE uuid = ?``.
    """
    # pylint: disable=import-outside-toplevel
    from superset.daos.version import VersionDAO

    entity_id = db.session.scalar(
        sa.select(model_cls.id).where(model_cls.uuid == entity_uuid)
    )
    if entity_id is None:
        return response
    return set_version_etag(
        response,
        VersionDAO.current_live_version_uuid(model_cls, entity_id, entity_uuid),
    )
