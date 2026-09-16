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
"""FAB signal handlers to keep Subject rows in sync with User/Role/Group changes.

These fire when using FAB SecurityManager CLI methods (e.g. `superset fab create-user`).
For REST API operations, see the overridden post/put/delete methods on the
SupersetUserApi, SupersetRoleApi, and SupersetGroupApi classes.
"""

from __future__ import annotations

import logging
from typing import Any

from flask_appbuilder.security.signals import (
    group_creating,
    group_updating,
    role_creating,
    role_updating,
    user_creating,
    user_updating,
)

from superset.subjects.sync import (
    sync_group_subject,
    sync_role_subject,
    sync_user_subject,
)

logger = logging.getLogger(__name__)


def _on_user_creating(sender: Any, event: Any, **kwargs: Any) -> None:
    sync_user_subject(event.model)


def _on_user_updating(sender: Any, event: Any, **kwargs: Any) -> None:
    sync_user_subject(event.model)


def _on_role_creating(sender: Any, event: Any, **kwargs: Any) -> None:
    sync_role_subject(event.model)


def _on_role_updating(sender: Any, event: Any, **kwargs: Any) -> None:
    sync_role_subject(event.model)


def _on_group_creating(sender: Any, event: Any, **kwargs: Any) -> None:
    sync_group_subject(event.model)


def _on_group_updating(sender: Any, event: Any, **kwargs: Any) -> None:
    sync_group_subject(event.model)


def register_subject_hooks() -> None:
    """Connect FAB security signals to Subject sync handlers.

    Only create/update hooks are needed — delete is handled by
    ON DELETE CASCADE on the Subject foreign keys.
    """
    user_creating.connect(_on_user_creating)
    user_updating.connect(_on_user_updating)
    role_creating.connect(_on_role_creating)
    role_updating.connect(_on_role_updating)
    group_creating.connect(_on_group_creating)
    group_updating.connect(_on_group_updating)
    logger.info("Subject sync hooks registered")
