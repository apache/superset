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
Persistent storage model API for superset-core extensions (Tier 3 Storage).

Provides the model class backing `superset_core.extensions.storage.dao.
ExtensionStorageDAO`, for extension backend code that needs to enumerate or
bulk-manage its own persistent storage rows (for example, a periodic cleanup
job pruning rows linked to resources that no longer exist), rather than the
single-key get/set/remove shape of `persistent`.

Usage:
    from superset_core.extensions.storage.models import ExtensionStorageEntry
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from superset_core.common.models import CoreModel

if TYPE_CHECKING:
    from datetime import datetime


class ExtensionStorageEntry(CoreModel):
    """
    Abstract model interface for a single Tier 3 persistent storage row.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.

    `value` is the raw stored payload (encrypted at rest when `is_encrypted`
    is set), encoded with the codec named by `codec`; decoding/decryption is
    handled by `superset_core.extensions.storage.dao.ExtensionStorageDAO`,
    not by reading this field directly.
    """

    __abstract__ = True

    # Type hints for expected column attributes
    id: int
    uuid: UUID
    extension_id: str
    user_fk: int | None
    resource_type: str | None
    resource_uuid: str | None
    key: str
    value: bytes
    value_size: int
    codec: str
    is_encrypted: bool

    # Audit fields
    created_on: "datetime | None"
    changed_on: "datetime | None"
    created_by_fk: int | None
    changed_by_fk: int | None
