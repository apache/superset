#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING, Union

DASHBOARD_TYPE_NAME = "Dashboard"
SLICE_TYPE_NAME = "Slice"
TABLE_TYPE_NAME = "SqlaTable"
TABLE_COLUMN_TYPE_NAME = "TableColumn"
METRIC_TYPE_NAME = "SqlMetric"

if TYPE_CHECKING:
    from superset.connectors.sqla.models import (
        BaseDatasource,
        Database,
        SqlaTable,
        SqlMetric,
        TableColumn,
    )
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    SupersetDomain = Union[
        BaseDatasource,
        SqlaTable,
        Database,
        Dashboard,
        Slice,
        TableColumn,
        SqlaTable,
        SqlMetric,
    ]
    from builder import DomainObjectsBuilder
    from domain_factory import DomainFactory


class DomainObjectTypeNames(Enum):
    DASHBOARD = DASHBOARD_TYPE_NAME
    SLICE = SLICE_TYPE_NAME
    TABLE = TABLE_TYPE_NAME
    TABLE_COLUMN = TABLE_COLUMN_TYPE_NAME
    SQL_METRIC = METRIC_TYPE_NAME
