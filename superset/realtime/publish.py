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
"""Neutral publisher for the shared realtime envelope protocol."""

from threading import Lock
from typing import Any

from flask import current_app, Flask

_channel_lock = Lock()


def get_realtime_channel(app: Flask | None = None) -> str:
    """Resolve the deployment channel once per app, including callable prefixes."""
    app = app if app is not None else current_app
    channel = app.extensions.get("realtime_channel")
    if isinstance(channel, str):
        return channel
    # Preserve the consumer's fixed subscription even for concurrent first calls.
    with _channel_lock:
        channel = app.extensions.get("realtime_channel")
        if not isinstance(channel, str):
            prefix = app.config.get("REALTIME_CHANNEL_PREFIX", "")
            channel = f"{prefix() if callable(prefix) else prefix}realtime"
            app.extensions["realtime_channel"] = channel
        return channel


def publish_realtime(
    topic: str,
    scope: str,
    payload: dict[str, Any],
    routes: list[str] | None = None,
    *,
    channel: str | None = None,
) -> bool:
    """Publish an envelope, returning False without a coordination backend.

    Publish errors propagate to the feature's best-effort guard. Routes are
    omitted for broadcasts. A channel override preserves legacy publishers'
    initialized channel configuration.
    """
    from superset.coordination.base import CoordinationService
    from superset.utils import json

    if not CoordinationService.is_backend_defined():
        return False
    envelope: dict[str, Any] = {"topic": topic, "scope": scope, "payload": payload}
    if routes is not None:
        envelope["routes"] = routes
    CoordinationService.publish(
        channel if channel is not None else get_realtime_channel(), json.dumps(envelope)
    )
    return True
