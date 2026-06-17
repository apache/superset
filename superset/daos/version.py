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
"""Backward-compat façade for the entity-versioning DAO surface.

The actual implementation lives in :mod:`superset.versioning.queries`
(read side: list/get/resolve/find/UUID derivation). This module
re-exports it under a single ``VersionDAO`` class plus the module-level
UUID helpers so existing callers keep working without changes. (The
write side — restore + audit stamping — ships in a later PR; only the
read surface is wired here.)

New code should import from the versioning sub-modules directly.
"""

from __future__ import annotations

from superset.versioning.queries import (
    current_live_transaction_id,
    current_live_version_uuid,
    current_version_number,
    derive_version_uuid,
    derive_version_uuid as _derive_version_uuid,  # noqa: F401
    find_active_by_uuid,
    get_version,
    list_change_records_batch,
    list_versions,
    resolve_version_uuid,
    VERSION_UUID_NAMESPACE,
)

# Re-exports for ``from superset.daos.version import …`` consumers.
__all__ = [
    "VERSION_UUID_NAMESPACE",
    "VersionDAO",
    "derive_version_uuid",
]


class VersionDAO:
    """Thin façade over :mod:`superset.versioning.queries`.

    Preserved as a single namespace for ergonomic access from API
    handlers and command classes; the underlying functions are
    importable directly from their respective sub-modules.
    """

    # --- read side (queries.py) -------------------------------------------
    find_active_by_uuid = staticmethod(find_active_by_uuid)
    current_version_number = staticmethod(current_version_number)
    current_live_transaction_id = staticmethod(current_live_transaction_id)
    current_live_version_uuid = staticmethod(current_live_version_uuid)
    list_change_records_batch = staticmethod(list_change_records_batch)
    list_versions = staticmethod(list_versions)
    resolve_version_uuid = staticmethod(resolve_version_uuid)
    get_version = staticmethod(get_version)
