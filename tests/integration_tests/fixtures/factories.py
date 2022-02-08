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

from typing import TYPE_CHECKING

from pytest import fixture

from ...consts import SIMULATOR_FIXTURE_SCOPE
from ...example_data.persistance_simulatiion.domain_objects import DomainObjectTypeNames
from ...example_data.persistance_simulatiion.domain_objects.id_service.state_based_provider import (
    StateBasedIdService,
)
from ...example_data.persistance_simulatiion.domain_objects.id_service.stateless_provider import (
    StatelessIdService,
)
from ...example_data.persistance_simulatiion.persistence.auto_increment_access_engine.mysql import (
    MySqlAutoIncrementProvider,
)
from ...example_data.persistance_simulatiion.persistence.auto_increment_access_engine.postgress import (
    PGAutoIncrementProvider,
)
from ...example_data.persistance_simulatiion.persistence.auto_increment_access_engine.sqlite import (
    SqliteAutoIncrementProvider,
)

if TYPE_CHECKING:
    from sqlalchemy.engine import Engine

    from ...example_data.persistance_simulatiion.domain_objects.domain_factory.external_id_based import (
        ObjectSupplier,
    )
    from ...example_data.persistance_simulatiion.domain_objects.id_service import (
        IdService,
    )
    from ...example_data.persistance_simulatiion.persistence.auto_increment_access_engine import (
        AutoIncrementEngineProvider,
    )
    from ...fixtures.simulator import IdServiceFactory


__all__ = [
    "dashboard_supplier",
    "slice_supplier",
    "table_supplier",
    "table_column_supplier",
    "sql_metric_supplier",
    "auto_increment_engine_provider",
    "id_service_factory",
]


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def dashboard_supplier() -> ObjectSupplier:
    from superset.models.dashboard import Dashboard

    return Dashboard


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def slice_supplier() -> ObjectSupplier:
    from superset.models.slice import Slice

    return Slice


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def table_supplier() -> ObjectSupplier:
    from superset.connectors.sqla.models import SqlaTable

    return SqlaTable


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def table_column_supplier() -> ObjectSupplier:
    from superset.connectors.sqla.models import TableColumn

    return TableColumn


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def sql_metric_supplier() -> ObjectSupplier:
    from superset.connectors.sqla.models import SqlMetric

    return SqlMetric


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def auto_increment_engine_provider(
    database_type: str, example_db_engine: Engine
) -> AutoIncrementEngineProvider:
    classes = {
        "mysql": MySqlAutoIncrementProvider,
        "postgresql": PGAutoIncrementProvider,
        "sqlite": SqliteAutoIncrementProvider,
    }
    return classes[database_type](example_db_engine)  # type: ignore


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def id_service_factory(
    auto_increment_engine_provider: AutoIncrementEngineProvider,
) -> IdServiceFactory:
    factories = {
        DomainObjectTypeNames.DASHBOARD: lambda: StatelessIdService(
            "dashboards", auto_increment_engine_provider
        ),
        DomainObjectTypeNames.SLICE: lambda: StateBasedIdService(
            "slices", auto_increment_engine_provider
        ),
        DomainObjectTypeNames.TABLE: lambda: StatelessIdService(
            "tables", auto_increment_engine_provider
        ),
        DomainObjectTypeNames.TABLE_COLUMN: lambda: StateBasedIdService(
            "table_columns", auto_increment_engine_provider
        ),
        DomainObjectTypeNames.SQL_METRIC: lambda: StateBasedIdService(
            "metrics", auto_increment_engine_provider
        ),
    }

    def _id_service_factory(type_name: DomainObjectTypeNames) -> IdService:
        return factories[type_name]()

    return _id_service_factory
