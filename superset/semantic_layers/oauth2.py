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
"""Bridge provider authentication requests to Superset's OAuth2 error UI."""

from __future__ import annotations

from contextlib import contextmanager, nullcontext
from typing import Iterator
from uuid import uuid4

from flask import current_app, has_request_context, url_for
from superset_core.semantic_layers.layer import SemanticLayerAuthenticationRequiredError

from superset.exceptions import OAuth2RedirectError


class SemanticLayerOAuth2RedirectError(OAuth2RedirectError):
    """An actionable OAuth error from a user-partitioned semantic query."""


@contextmanager
def check_for_oauth2(
    layer_uuid: str | None,
    view_uuid: str | None = None,
) -> Iterator[None]:
    """Translate authentication failures without starting a provider exchange."""
    try:
        yield
    except SemanticLayerAuthenticationRequiredError as ex:
        if layer_uuid is None:
            raise
        tab_id = str(uuid4())
        in_request = has_request_context()
        # Workers need only a browser-relative start URL. Resolve it without
        # requiring SERVER_NAME or inventing a public hostname for the worker.
        context = nullcontext() if in_request else current_app.test_request_context()
        with context:
            completion_url = url_for(
                "SemanticLayerRestApi.oauth2_complete",
                tab_id=tab_id,
                _external=in_request,
            )
            start_url = url_for(
                "SemanticLayerRestApi.oauth2_start",
                uuid=layer_uuid,
                action_id=ex.action_id,
                tab_id=tab_id,
                _external=False,
                **({"view_uuid": view_uuid} if view_uuid else {}),
            )
        raise SemanticLayerOAuth2RedirectError(
            start_url, tab_id, completion_url
        ) from None
