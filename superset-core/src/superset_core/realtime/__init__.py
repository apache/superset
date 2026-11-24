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

"""
Realtime API for superset-core extensions.

Superset can tell every signed-in browser that an entity changed, over its
realtime transport (the ``superset-websocket`` server, where the deployment
turns on ``WEBSOCKET_ENABLE``), so that pages showing it fetch it again. The
nudge names the entity and nothing else: each page refetches it through its
own authorized API, which decides what its viewer may see. It is best-effort:
a browser can miss it, so it must never carry a signal a page can't do
without.

The frontend side is ``realtime.onDidChangeEntity`` in ``@apache-superset/core``.

Usage:
    from superset_core import realtime

    realtime.publish_entity_changed("widget", widget.uuid)
"""

from __future__ import annotations

from uuid import UUID


def publish_entity_changed(entity_type: str, entity_id: int | str | UUID) -> bool:
    """
    Tell every signed-in browser that ``entity_type`` ``entity_id`` changed.

    The nudge reaches every authenticated realtime connection of the
    deployment, so it carries the type and the id alone: never a name, a
    value, or anything else of the entity. Call it once the change is
    committed, so that a page fetching on the nudge reads the change.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param entity_type: The kind of entity, such as ``"widget"``.
    :param entity_id: Its id, as pages know it: an integer id, or a UUID,
        which the nudge carries as its string.
    :returns: Whether the nudge was sent: ``False`` where the deployment has
        no realtime backend, or when sending it failed. It never raises for
        a failed send.
    :raises ValueError: If ``entity_type`` is empty, or ``entity_id`` is
        neither an integer, a non-empty string nor a UUID.
    """
    raise NotImplementedError("Function will be replaced during initialization")


__all__ = ["publish_entity_changed"]
