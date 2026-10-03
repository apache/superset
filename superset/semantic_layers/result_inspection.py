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

import hashlib
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from flask import g, has_request_context, request

from superset import security_manager
from superset.semantic_layers.metadata_binding import metadata_refresh_enabled
from superset.utils import json
from superset.utils.json import json_int_dttm_ser

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject

_IDENTITY_KEY: str = "superset.semantic_metadata.result_identities"


@dataclass(frozen=True)
class CapturedResultIdentity:
    """A private result key and its request-local authorization/query fingerprint."""

    key: str = field(repr=False)
    fingerprint: str = field(repr=False)


def _fingerprint(context: QueryContext, query: QueryObject) -> str:
    """Bind an existing key to its subject, stored view, query and RLS scope."""
    return hashlib.sha256(
        json.dumps(
            [
                id(getattr(g, "user", None)),
                str(getattr(context.datasource, "uuid", None)),
                context.datasource.changed_on,
                query.to_dict(),
                context.form_data,
                security_manager.get_rls_cache_key(context.datasource),
            ],
            sort_keys=True,
            default=json_int_dttm_ser,
        ).encode()
    ).hexdigest()


def capture_result_identity(
    context: QueryContext, query: QueryObject, key: str
) -> None:
    """Record a key already computed by the normal query path; never discover here."""
    if (
        not has_request_context()
        or not metadata_refresh_enabled()
        or context.datasource.type != "semantic_view"
        or query.annotation_layers
    ):
        return
    identities: dict[tuple[QueryContext, QueryObject], CapturedResultIdentity] = (
        request.environ.setdefault(_IDENTITY_KEY, {})
    )
    identities[(context, query)] = CapturedResultIdentity(
        key, _fingerprint(context, query)
    )


def captured_result_key(context: QueryContext, query: QueryObject) -> str | None:
    """Fresh requests or changed subject/query/RLS scope have no inspectable key."""
    if not has_request_context() or not metadata_refresh_enabled():
        return None
    identities: dict[tuple[QueryContext, QueryObject], CapturedResultIdentity] = (
        request.environ.get(_IDENTITY_KEY, {})
    )
    captured: CapturedResultIdentity | None = identities.get((context, query))
    if captured is None or captured.fingerprint != _fingerprint(context, query):
        return None
    return captured.key
