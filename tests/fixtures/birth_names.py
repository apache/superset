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

from typing import Any, Callable, Dict, List, TYPE_CHECKING

from pytest import fixture

from ..consts import SIMULATOR_FIXTURE_SCOPE
from ..example_data import DataName
from ..example_data.data_generator.birth_names.birth_names_generator_factory import (
    BirthNamesGeneratorFactory,
)
from ..example_data.definions.data_definitions.birth_names import (
    BirthNamesMetaDataFactory,
)
from ..example_data.definions.object_definitions.birth_names import (
    BirthNamesDefinitionsHolder,
)
from ..example_data.persistance_simulatiion.app_state_simulator import AppStateSimulator
from ..example_data.persistance_simulatiion.domain_objects import DomainObjectTypeNames
from ..example_data.persistance_simulatiion.domain_objects.builder import (
    ExampleDataBasedBuilder,
)
from ..example_data.persistance_simulatiion.domain_objects.builder.enrichments import (
    ExampleDataMetricEnrichment,
    ExampleDataTableColumnsEnrichment,
)
from ..example_data.persistance_simulatiion.domain_objects.builder.enrichments.birth_names import (
    BirthNamesDashboardEnrichment,
    BirthNamesSlicesEnrichment,
    BirthNamesSqlTableEnrichment,
)
from ..example_data.persistance_simulatiion.scenario import CaseType, Scenario
from ..example_data.persistance_simulatiion.statespecs import StateSpecs

if TYPE_CHECKING:
    from superset.models.core import Database

    from ..example_data.data_generator.birth_names.birth_names_generator import (
        BirthNamesGenerator,
    )
    from ..example_data.data_loading import DataLoader
    from ..example_data.definions.data_definitions.types import Table
    from ..example_data.definions.object_definitions import ExampleDataDefinitionsHolder
    from ..example_data.persistance_simulatiion.domain_objects import DomainFactory
    from ..example_data.persistance_simulatiion.domain_objects.builder import (
        ObjectEnrichment,
    )

NO_NEED_ENRICHMENT = None

__all__ = [
    "simulate_birth_names_dashboard",
    "birth_names_builder",
    "birth_names_definitions_holder",
    "birth_names_enrichment",
    "birth_names_dashboard_enrichment",
    "birth_names_slices_enrichment",
    "birth_names_table_enrichment",
    "birth_names_table_columns_enrichment",
    "birth_names_metrics_enrichment",
    "birth_names_columns_supplier",
    "birth_names_state_specs",
    "birth_names_dashboard_scenarios",
    "admin_operator",
    "load_birth_names_data",
    "birth_names_table_factory",
    "birth_names_meta_table_factory",
    "birth_names_data_generator",
]


@fixture
def simulate_birth_names_dashboard(
    app_state_simulator: AppStateSimulator, birth_names_state_specs: StateSpecs
):
    app_state_simulator.simulate(birth_names_state_specs)
    yield app_state_simulator.get_simulation_state(birth_names_state_specs.name)
    app_state_simulator.clean_state(birth_names_state_specs.name)


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def birth_names_builder(
    birth_names_definitions_holder: ExampleDataDefinitionsHolder,
    domain_object_factories: Dict[DomainObjectTypeNames, DomainFactory],
    birth_names_enrichment: Dict[DomainObjectTypeNames, ObjectEnrichment],
) -> ExampleDataBasedBuilder:
    return ExampleDataBasedBuilder(
        birth_names_definitions_holder, domain_object_factories, birth_names_enrichment
    )


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def birth_names_definitions_holder(
    birth_names_columns_supplier: Callable[[], List[Dict[str, Any]]],
    app_configurations: Dict[str, Any],
) -> ExampleDataDefinitionsHolder:
    row_limit = app_configurations["row_limit"]
    return BirthNamesDefinitionsHolder(birth_names_columns_supplier, row_limit)


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def birth_names_enrichment(
    birth_names_dashboard_enrichment: ObjectEnrichment,
    birth_names_slices_enrichment: ObjectEnrichment,
    birth_names_table_enrichment: ObjectEnrichment,
    birth_names_table_columns_enrichment: ObjectEnrichment,
    birth_names_metrics_enrichment: ObjectEnrichment,
) -> Dict[DomainObjectTypeNames, ObjectEnrichment]:
    return {
        DomainObjectTypeNames.DASHBOARD: birth_names_dashboard_enrichment,
        DomainObjectTypeNames.SLICE: birth_names_slices_enrichment,
        DomainObjectTypeNames.TABLE: birth_names_table_enrichment,
        DomainObjectTypeNames.TABLE_COLUMN: birth_names_table_columns_enrichment,
        DomainObjectTypeNames.SQL_METRIC: birth_names_metrics_enrichment,
    }


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def birth_names_dashboard_enrichment(
    birth_names_definitions_holder: ExampleDataDefinitionsHolder,
) -> ObjectEnrichment:
    return BirthNamesDashboardEnrichment(birth_names_definitions_holder)


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def birth_names_slices_enrichment(
    birth_names_definitions_holder: ExampleDataDefinitionsHolder,
) -> ObjectEnrichment:
    return BirthNamesSlicesEnrichment(birth_names_definitions_holder)


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def birth_names_table_enrichment(
    birth_names_definitions_holder: ExampleDataDefinitionsHolder,
    birth_names_meta_table_factory: BirthNamesMetaDataFactory,
    example_db_provider: Callable[[], Database],
) -> ObjectEnrichment:
    return BirthNamesSqlTableEnrichment(
        birth_names_definitions_holder,
        birth_names_meta_table_factory.make(),
        example_db_provider(),
    )


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def birth_names_table_columns_enrichment(
    birth_names_definitions_holder: ExampleDataDefinitionsHolder,
) -> ObjectEnrichment:
    return ExampleDataTableColumnsEnrichment(birth_names_definitions_holder)


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def birth_names_metrics_enrichment(
    birth_names_definitions_holder: ExampleDataDefinitionsHolder,
) -> ObjectEnrichment:
    return ExampleDataMetricEnrichment(birth_names_definitions_holder)


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def birth_names_columns_supplier() -> Callable[[], Dict[str, Any]]:
    return lambda: {}


@fixture
def birth_names_state_specs(
    birth_names_dashboard_scenarios: List[Scenario],
) -> StateSpecs:
    return StateSpecs(
        "birth_names_dashboards_with_slices", birth_names_dashboard_scenarios
    )


@fixture
def birth_names_dashboard_scenarios(admin_operator: str) -> List[Scenario]:
    return [
        Scenario(
            "birth_names_dashboards_with_slices",
            CaseType.FULL_DASHBOARD,
            DataName.BIRTH_NAMES,
            admin_operator,
            None,
        )
    ]


@fixture
def admin_operator() -> str:
    return "admin"


@fixture(scope="session")
def load_birth_names_data(
    birth_names_table_factory: Callable[[], Table], data_loader: DataLoader
):
    birth_names_table: Table = birth_names_table_factory()
    data_loader.load_table(birth_names_table)
    yield
    data_loader.remove_table(birth_names_table.table_name)


@fixture(scope="session")
def birth_names_table_factory(
    birth_names_data_generator: BirthNamesGenerator,
    birth_names_meta_table_factory: BirthNamesMetaDataFactory,
) -> Callable[[], Table]:
    def _birth_names_table_factory() -> Table:
        return birth_names_meta_table_factory.make_table(
            data=birth_names_data_generator.generate()
        )

    return _birth_names_table_factory


@fixture(scope="session")
def birth_names_meta_table_factory(
    support_datetime_type: bool,
) -> BirthNamesMetaDataFactory:
    return BirthNamesMetaDataFactory(support_datetime_type)


@fixture(scope="session")
def birth_names_data_generator() -> BirthNamesGenerator:
    return BirthNamesGeneratorFactory.make()
