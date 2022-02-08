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

from typing import Dict, TYPE_CHECKING
from unittest.mock import Mock

from pytest import fixture

from ..consts import SIMULATOR_FIXTURE_SCOPE
from ..example_data.persistance_simulatiion.domain_objects import DomainObjectTypeNames
from ..example_data.persistance_simulatiion.domain_objects.domain_factory.dashboard_factory import (
    DashboardFactory,
)
from ..example_data.persistance_simulatiion.domain_objects.domain_factory.metric_factory import (
    SqlMetricFactory,
)
from ..example_data.persistance_simulatiion.domain_objects.domain_factory.slice_factory import (
    SliceFactory,
)
from ..example_data.persistance_simulatiion.domain_objects.domain_factory.sql_table_factory import (
    SqlTableFactory,
)
from ..example_data.persistance_simulatiion.domain_objects.domain_factory.table_column_factory import (
    TableColumnFactory,
)

if TYPE_CHECKING:
    from ..example_data.persistance_simulatiion.domain_objects import DomainFactory
    from ..example_data.persistance_simulatiion.domain_objects.domain_factory.external_id_based import (
        ObjectSupplier,
    )
    from .simulator import IdServiceFactory

__all__ = [
    "domain_object_factories",
    "dashboard_factory",
    "slice_factory",
    "table_factory",
    "table_column_factory",
    "sql_metric_factory",
    "dashboard_supplier",
    "slice_supplier",
    "table_supplier",
    "table_column_supplier",
    "sql_metric_supplier",
    "id_service_factory",
]


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def domain_object_factories(
    dashboard_factory: DomainFactory,
    slice_factory: DomainFactory,
    table_factory: DomainFactory,
    table_column_factory: DomainFactory,
    sql_metric_factory: DomainFactory,
) -> Dict[DomainObjectTypeNames, DomainFactory]:
    return {
        DomainObjectTypeNames.DASHBOARD: dashboard_factory,
        DomainObjectTypeNames.SLICE: slice_factory,
        DomainObjectTypeNames.TABLE: table_factory,
        DomainObjectTypeNames.TABLE_COLUMN: table_column_factory,
        DomainObjectTypeNames.SQL_METRIC: sql_metric_factory,
    }


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def dashboard_factory(
    dashboard_supplier: ObjectSupplier, id_service_factory: IdServiceFactory
) -> DomainFactory:
    return DashboardFactory(
        dashboard_supplier, id_service_factory(DomainObjectTypeNames.DASHBOARD)
    )


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def slice_factory(
    slice_supplier: ObjectSupplier, id_service_factory: IdServiceFactory
) -> DomainFactory:
    return SliceFactory(slice_supplier, id_service_factory(DomainObjectTypeNames.SLICE))


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def table_factory(
    table_supplier: ObjectSupplier, id_service_factory: IdServiceFactory,
) -> DomainFactory:
    return SqlTableFactory(
        table_supplier, id_service_factory(DomainObjectTypeNames.TABLE),
    )


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def table_column_factory(
    table_column_supplier: ObjectSupplier, id_service_factory: IdServiceFactory
) -> DomainFactory:
    return TableColumnFactory(
        table_column_supplier, id_service_factory(DomainObjectTypeNames.TABLE_COLUMN)
    )


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def sql_metric_factory(
    sql_metric_supplier: ObjectSupplier, id_service_factory: IdServiceFactory
) -> DomainFactory:
    return SqlMetricFactory(
        sql_metric_supplier, id_service_factory(DomainObjectTypeNames.SQL_METRIC),
    )


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def dashboard_supplier() -> ObjectSupplier:
    return lambda: Mock()


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def slice_supplier() -> ObjectSupplier:
    return lambda: Mock()


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def table_supplier() -> ObjectSupplier:
    return lambda: Mock()


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def table_column_supplier() -> ObjectSupplier:
    return lambda: Mock()


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def sql_metric_supplier() -> ObjectSupplier:
    return lambda: Mock()


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def id_service_factory() -> IdServiceFactory:
    def _id_service_factory(type_name: DomainObjectTypeNames):
        ref = {"next_id": 0}

        def _id_service():
            while True:
                ref["next_id"] += 1
                return ref["next_id"]

        return _id_service

    return _id_service_factory
