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
"""Filters for ExtensionStorage model"""

from typing import Any

from sqlalchemy.orm.query import Query

from superset.extensions.context import get_current_extension_context
from superset.extensions.storage.persistent_model import ExtensionStorage
from superset.views.base import BaseFilter


class ExtensionStorageFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Filter for ExtensionStorage that scopes every query to the extension
    currently executing, resolved from ambient context.

    This is the isolation boundary for ExtensionStorageDAO: extension_id is
    never a caller-supplied parameter, so an extension cannot query or
    modify another extension's storage through this DAO even if it tried.
    Queries made outside an extension context (no ambient context set) match
    nothing, rather than falling through to an unscoped query.
    """

    def apply(self, query: Query, value: Any) -> Query:
        """Apply the filter to the query."""
        context = get_current_extension_context()
        if context is None:
            return query.filter(ExtensionStorage.extension_id.is_(None))
        return query.filter(ExtensionStorage.extension_id == context.extension.id)
