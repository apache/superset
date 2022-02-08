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

import logging
from typing import Dict, TYPE_CHECKING

from tests.common.logger_utils import log

from . import AppStateSimulator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if TYPE_CHECKING:
    from ..persistence import PersistenceSimulationStateEngine
    from ..statespecs import SimulationState, SpecsStateOrchestrator, StateSpecs


@log
class TwoPhaseAppStateSimulator(AppStateSimulator):
    _specs_state_orchestrator: SpecsStateOrchestrator
    _persistence_state_engine: PersistenceSimulationStateEngine
    _specs: Dict[str, StateSpecs]
    _simulation_states: Dict[str, SimulationState]

    def __init__(
        self,
        specs_state_orchestrator: SpecsStateOrchestrator,
        persistence_state_engine: PersistenceSimulationStateEngine,
    ) -> None:
        self._specs_state_orchestrator = specs_state_orchestrator  # type: ignore
        self._persistence_state_engine = persistence_state_engine
        self._specs = {}
        self._simulation_states = {}

    def simulate(self, state_specs: StateSpecs) -> None:
        try:
            self._add_specs(state_specs)
            self._start_simulate(state_specs)
        except StateSpecsAlreadyExistsException as ex:
            pass

    def _add_specs(self, state_specs: StateSpecs) -> None:
        specs_name = state_specs.name
        if not self._exists(specs_name):
            self._specs[specs_name] = state_specs
        else:
            self._on_already_exists_specs_state(state_specs)

    def _exists(self, specs_name: str) -> bool:
        return specs_name in self._specs

    def _on_already_exists_specs_state(self, state_specs: StateSpecs) -> None:
        raise StateSpecsAlreadyExistsException(state_specs.name)

    def _start_simulate(self, state_specs: StateSpecs) -> None:
        simulation_state = self._specs_state_orchestrator(state_specs)  # type: ignore
        self._add_simulation_state(state_specs.name, simulation_state)
        self._persistence_state_engine.persist(simulation_state)

    def _add_simulation_state(
        self, specs_state_name: str, simulation_state: SimulationState
    ) -> None:
        self._simulation_states.setdefault(specs_state_name, simulation_state)

    def get_simulation_state(self, state_specs_name: str) -> SimulationState:
        self._validate_specs_exists(state_specs_name)
        return self._simulation_states.get(state_specs_name)  # type: ignore

    def _validate_specs_exists(self, state_specs_name: str) -> None:
        if not self._exists(state_specs_name):
            raise SpecsStateNotExists(state_specs_name)

    def clean_state(self, specs_state_name: str) -> None:
        self._validate_specs_exists(specs_state_name)
        simulation_state = self._simulation_states.get(specs_state_name)
        self._persistence_state_engine.clean(simulation_state)  # type: ignore


class StateSpecsAlreadyExistsException(Exception):
    def __init__(self, state_specs_name: str):
        pass


class SpecsStateNotExists(Exception):
    def __init__(self, state_specs_name: str):
        pass
