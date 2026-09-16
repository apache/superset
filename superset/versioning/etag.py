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

from typing import TYPE_CHECKING
from uuid import UUID

import sqlalchemy as sa
from flask import request
from flask_appbuilder import Model

from superset.extensions import db

if TYPE_CHECKING:
    from flask import Response


def set_version_etag(
    response: "Response", version_uuid: UUID | str | None
) -> "Response":
    """Attach ``ETag: "<version_uuid>"`` to *response*.

    Uses RFC 7232 strong-validator form (no leading ``W/``); the response
    header value is wrapped in double quotes per the spec. No-op when
    *version_uuid* is ``None`` (entity has no version rows yet). Accepts a
    ``UUID`` or a pre-stringified uuid (the write endpoints carry the latter).
    """
    if version_uuid is not None:
        response.headers["ETag"] = f'"{version_uuid}"'
    return response


def set_version_etag_by_uuid(
    response: "Response",
    model_cls: type[Model],
    entity_uuid: UUID,
    *,
    entity_id: int | None = None,
) -> "Response":
    """Attach ``ETag`` derived from *entity_uuid*'s current live version.

    If *entity_id* is provided the helper uses it directly; otherwise it
    runs ``SELECT id WHERE uuid = ?`` to resolve it. Pass *entity_id*
    from call sites that already have the entity in hand (e.g. via
    :func:`superset.versioning.api_helpers._resolve_entity`)
    so the lookup doesn't fire twice — every list/get versions request
    previously cost an extra round-trip here on top of the resolve.

    No-op when the entity is missing or has no version rows yet.
    """
    # pylint: disable=import-outside-toplevel
    from superset.daos.version import VersionDAO

    if entity_id is None:
        entity_id = db.session.scalar(
            sa.select(model_cls.id).where(model_cls.uuid == entity_uuid)
        )
        if entity_id is None:
            return response
    return set_version_etag(
        response,
        VersionDAO.current_live_version_uuid(model_cls, entity_id, entity_uuid),
    )


class StaleEntityError(Exception):
    """The request's ``If-Match`` doesn't match the entity's live version."""


def _entity_tag(tag: str) -> str:
    """Strip the content-coding suffix ``Flask-Compress`` appends to ETags.

    A compressed response legitimately carries a different validator than the
    identity one — Flask-Compress rewrites ``"<uuid>"`` to ``"<uuid>:zstd"``
    (see ``flask_compress``) — so a client replaying the ETag it read never
    matches the raw version uuid. Version uuids contain no ``:``, so cutting
    at the first one recovers the entity identity from either form.
    """
    return tag.split(":", 1)[0]


def is_conditional_write() -> bool:
    """Whether the request carries an ``If-Match`` precondition."""
    return bool(request.if_match)


def raise_for_stale_write(current_version_uuid: str | None) -> None:
    """Enforce ``If-Match`` on a write request, if the client sent one.

    Clients that read an entity's ``ETag`` may replay it as ``If-Match`` on a
    subsequent write to get optimistic concurrency: the write is rejected when
    the entity moved on in the meantime, instead of silently clobbering
    whatever landed in between.

    The condition is skipped — rather than failing closed — when the caller
    has no validator to offer (``ENABLE_VERSIONING_CAPTURE`` off). Failing
    closed there would block every conditional write on deployments running
    without version capture, and those are no worse off than before they sent
    the header.
    """
    if_match = request.if_match
    if not if_match or if_match.star_tag or current_version_uuid is None:
        return
    live = _entity_tag(str(current_version_uuid))
    if not any(_entity_tag(tag) == live for tag in if_match.as_set(True)):
        raise StaleEntityError()
