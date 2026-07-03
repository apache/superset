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
Persistent storage DAO API for superset-core extensions (Tier 3 Storage).

Provides direct DAO-style access to an extension's own Tier 3 persistent
storage rows, for backend code that needs to query, enumerate, or bulk-manage
entries rather than get/set a single key at a time (see
`superset_core.extensions.storage.persistent` for that simpler shape).

Every query and mutation made through this DAO is automatically scoped to
the extension currently executing — `extension_id` is never a parameter the
caller supplies, so an extension cannot read or modify another extension's
storage through this DAO. The scoping is resolved from the ambient
extension context (the same context `get_context()` reads from), so this DAO
can only be used from within extension backend code, not host code.

Usage:
    from superset_core.extensions.storage.dao import ExtensionStorageDAO

    # All entries linked to a specific resource this extension created
    entries = ExtensionStorageDAO.filter_by(
        resource_type="my-resource-type",
        resource_uuid=resource_uuid,
    )

    # Bulk-delete rows for a resource that no longer exists
    ExtensionStorageDAO.delete(entries)
"""

from superset_core.common.daos import BaseDAO
from superset_core.extensions.storage.models import ExtensionStorageEntry


class ExtensionStorageDAO(BaseDAO[ExtensionStorageEntry]):
    """
    Abstract DAO for an extension's own Tier 3 persistent storage rows.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.

    Inherits `find_all`, `find_one_or_none`, `filter_by`, `query`, `create`,
    `update`, and `delete` from `BaseDAO`. Every one of these methods is
    automatically restricted to the calling extension's own rows.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"
