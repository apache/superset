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

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable, List, TYPE_CHECKING

from ...common.logger_utils import log

if TYPE_CHECKING:
    from .domain_objects import SupersetDomain
    from .domain_objects.builder import DomainObjectsBuilder
    from .domain_objects.objects_wrapper import DomainObjectsWrapper
    from .scenario import Scenario


@dataclass(frozen=True)
class StateSpecs:
    name: str
    scenarios: List[Scenario]


class SimulationState(ABC):
    @abstractmethod
    def get_parents_objects(self) -> List[SupersetDomain]:
        ...

    # @abstractmethod
    # def get_topological_order(self) -> List[SupersetDomain]:
    #     ...


class SimulationStateBuilder(SimulationState):
    _parents: List[DomainObjectsWrapper]

    def __init__(self) -> None:
        self._parents = []

    def get_parents_objects(self) -> List[SupersetDomain]:
        obj = []
        for parent in self._parents:
            for parent_obj in parent.get_parent_objects():
                obj.append(parent_obj)
        return obj

    # def get_topological_order(self) -> List[List[SupersetDomain]]:
    #     _wrapper_inserted = set()
    #     _wrappers_stack = self._parents.copy()
    #     while len(_wrappers_stack) > 0:
    #         parent_wrapper_object = _wrappers_stack.pop()
    #         if parent_wrapper_object not in _wrapper_inserted:
    #             _wrapper_inserted.add(parent_wrapper_object)
    #             _wrappers_stack.extend(parent_wrapper_object.get_children())

    def add(self, objs_wrapper: DomainObjectsWrapper) -> None:
        self._parents.append(objs_wrapper)

    def build(self) -> SimulationState:
        return self


SpecsStateOrchestrator = Callable[[StateSpecs], SimulationState]


def specs_state_orchestrator(
    domain_objects_builder: DomainObjectsBuilder,
) -> SpecsStateOrchestrator:
    @log
    def _specs_state_orchestrator(state_specs: StateSpecs) -> SimulationState:
        scenario_objects = SimulationStateBuilder()
        for scenario in state_specs.scenarios:
            built_obj: DomainObjectsWrapper = domain_objects_builder(scenario)
            scenario_objects.add(built_obj)
        return scenario_objects.build()

    return _specs_state_orchestrator
