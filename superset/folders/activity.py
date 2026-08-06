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
"""Helper for logging folder activity events."""

from __future__ import annotations

import json
import logging
from typing import Any

from superset.extensions import db
from superset.folders.models import FolderActivity
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


def log_folder_activity(
    folder_id: int,
    action: str,
    target_type: str | None = None,
    target_name: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Record a folder activity event.

    This should be called within an existing transaction (e.g. inside a
    Command's ``run()`` method) so the activity record commits or rolls
    back with the rest of the operation.
    """
    user_id = get_user_id()
    if not user_id:
        logger.warning("Cannot log folder activity: no authenticated user")
        return

    activity = FolderActivity(
        folder_id=folder_id,
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_name=target_name,
        details=json.dumps(details) if details else None,
    )
    db.session.add(activity)
