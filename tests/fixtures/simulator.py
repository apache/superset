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

from typing import Callable, TYPE_CHECKING
from unittest.mock import Mock

from pytest import fixture

from ..consts import SIMULATOR_FIXTURE_SCOPE
from ..example_data.persistance_simulatiion.app_state_simulator.two_phase_simualtor import (
    TwoPhaseAppStateSimulator,
)
from ..example_data.persistance_simulatiion.domain_objects import DomainObjectTypeNames
from ..example_data.persistance_simulatiion.persistence.simulation_state.parent_by_parent_engine import (
    ParentByParentPersistence,
)
from ..example_data.persistance_simulatiion.statespecs import (
    specs_state_orchestrator as specs_state_orchestrator_factory,
)

if TYPE_CHECKING:
    from ..example_data.persistance_simulatiion import AppStateSimulator
    from ..example_data.persistance_simulatiion.domain_objects import (
        DomainObjectsBuilder,
    )
    from ..example_data.persistance_simulatiion.domain_objects.id_service import (
        IdService,
    )
    from ..example_data.persistance_simulatiion.persistence import (
        PersistenceDomainObjectsEngine,
        PersistenceSimulationStateEngine,
    )
    from ..example_data.persistance_simulatiion.statespecs import SpecsStateOrchestrator

    IdServiceFactory = Callable[[DomainObjectTypeNames], IdService]

__all__ = [
    "app_state_simulator",
    "specs_state_orchestrator",
    "persistence_simulation_state_engine",
    "persistence_domain_engine",
]


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def app_state_simulator(
    specs_state_orchestrator: SpecsStateOrchestrator,
    persistence_simulation_state_engine: PersistenceSimulationStateEngine,
) -> AppStateSimulator:
    return TwoPhaseAppStateSimulator(
        specs_state_orchestrator, persistence_simulation_state_engine
    )


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def specs_state_orchestrator(
    proxy_domain_objects_builder: DomainObjectsBuilder,
) -> SpecsStateOrchestrator:
    return specs_state_orchestrator_factory(proxy_domain_objects_builder)


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def persistence_simulation_state_engine(
    persistence_domain_engine: PersistenceDomainObjectsEngine,
) -> PersistenceSimulationStateEngine:
    return ParentByParentPersistence(persistence_domain_engine)


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def persistence_domain_engine() -> PersistenceDomainObjectsEngine:
    return Mock()
