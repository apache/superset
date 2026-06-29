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
from __future__ import annotations

from collections.abc import Iterable
from typing import TYPE_CHECKING

from superset.commands.security.exceptions import RLSDatasourceForbiddenError
from superset.extensions import security_manager

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable


def raise_for_datasource_access(tables: Iterable[SqlaTable]) -> None:
    """Enforce datasource access for every table referenced by an RLS rule.

    A caller may only create, update, or delete an RLS rule if they can access
    every datasource it references. This mirrors the standard datasource access
    checks applied elsewhere and is shared by the RLS rule commands to keep the
    enforcement consistent.

    :raises RLSDatasourceForbiddenError: if the caller cannot access one or more
        of the referenced datasources.
    """
    for table in tables:
        if not security_manager.can_access_datasource(datasource=table):
            raise RLSDatasourceForbiddenError()
