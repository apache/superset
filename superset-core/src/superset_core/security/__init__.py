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
The host's access decisions, for extensions.

An extension that lets a person bind, query or show a dataset asks the host
whether that person may read it, rather than deciding from what a DAO's list
returns: the host's decision is the one its chart data and SQL paths enforce,
and counts more than a list filter does, such as a dataset's editors, schema
and database access, and the datasets a guest token grants.

Usage:
    from superset_core.security import can_access_datasource

    if not can_access_datasource(dataset):
        raise PermissionError("You can't read this dataset")
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from superset_core.common.models import Dataset


def can_access_datasource(datasource: Dataset) -> bool:
    """
    Whether the current user may read ``datasource``'s data, by the host's own
    decision, the one that guards the dataset's charts and queries.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param datasource: The dataset, as ``superset_core``'s DAOs load it.
    :returns: ``True`` if the current user may read it, ``False`` otherwise.
    """
    raise NotImplementedError("Function will be replaced during initialization")


__all__ = ["can_access_datasource"]
