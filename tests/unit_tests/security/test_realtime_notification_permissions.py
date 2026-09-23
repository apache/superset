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

from unittest.mock import MagicMock

from superset.security.manager import SupersetSecurityManager
from superset.websocket.permissions import (
    REALTIME_NOTIFICATION_PERMISSION,
    REALTIME_NOTIFICATION_RESOURCE,
)


def test_realtime_notification_permission_registered(
    app_context: None,
) -> None:
    from superset.extensions import appbuilder

    sm = SupersetSecurityManager(appbuilder)
    sm.add_permission_view_menu = MagicMock()

    sm.create_custom_permissions()

    calls = [
        (mock_call.args[0], mock_call.args[1])
        for mock_call in sm.add_permission_view_menu.call_args_list
    ]
    assert (REALTIME_NOTIFICATION_PERMISSION, REALTIME_NOTIFICATION_RESOURCE) in calls


def test_realtime_notification_permission_is_available_to_gamma(
    app_context: None,
) -> None:
    from superset.extensions import appbuilder

    sm = SupersetSecurityManager(appbuilder)
    pvm = MagicMock()
    pvm.permission.name = REALTIME_NOTIFICATION_PERMISSION
    pvm.view_menu.name = REALTIME_NOTIFICATION_RESOURCE

    assert sm._is_gamma_pvm(pvm) is True


def test_realtime_notification_permission_is_not_builtin_public() -> None:
    assert (
        REALTIME_NOTIFICATION_PERMISSION,
        REALTIME_NOTIFICATION_RESOURCE,
    ) not in SupersetSecurityManager.PUBLIC_ROLE_PERMISSIONS
