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
"""RBAC constants for the realtime websocket notification transport."""

from __future__ import annotations

REALTIME_NOTIFICATION_PERMISSION = "can_read"
REALTIME_NOTIFICATION_RESOURCE = "Realtime"
REALTIME_NOTIFICATION_JWT_AUDIENCE = "superset-websocket"
REALTIME_NOTIFICATION_JWT_ISSUER = "superset"


def can_access_realtime_notifications() -> bool:
    """Return whether the current principal may receive websocket notifications."""
    from superset import security_manager

    return security_manager.can_access(
        REALTIME_NOTIFICATION_PERMISSION,
        REALTIME_NOTIFICATION_RESOURCE,
    )
