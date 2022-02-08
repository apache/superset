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

from typing import Callable, Dict, TYPE_CHECKING

from .....common.logger_utils import log
from ...scenario import CaseType
from .. import DomainObjectTypeNames
from ..objects_wrapper import DomainObjectsWrapper, DomainObjectsWrapperBuilder
from .enrichments import NO_NEED_ENRICHMENT, ObjectEnrichment

if TYPE_CHECKING:
    from ....definions.object_definitions import ExampleDataDefinitionsHolder
    from ...scenario import Scenario
    from .. import DomainFactory

    DomainObjectsBuilder = Callable[[Scenario], DomainObjectsWrapper]


class EnrichmentNotDefinedError(Exception):
    pass


@log
class ExampleDataBasedBuilder:
    _definitions_holder: ExampleDataDefinitionsHolder
    _domain_objects_factories: Dict[DomainObjectTypeNames, DomainFactory]
    _domain_objects_enrichment: Dict[DomainObjectTypeNames, ObjectEnrichment]
    _current_scenario: Scenario

    def __init__(
        self,
        definitions_holder: ExampleDataDefinitionsHolder,
        domain_objects_factories: Dict[DomainObjectTypeNames, DomainFactory],
        domain_objects_enrichment: Dict[DomainObjectTypeNames, ObjectEnrichment],
    ):
        self._definitions_holder = definitions_holder
        self._domain_objects_factories = domain_objects_factories
        self._domain_objects_enrichment = domain_objects_enrichment

    def __call__(self, scenario: Scenario) -> DomainObjectsWrapper:  # type: ignore
        self._current_scenario = scenario
        try:
            if scenario.case_name == CaseType.FULL_DASHBOARD:
                return self._build_full_dashboard().build()
            if scenario.case_name == CaseType.ONLY_DASHBOARD:
                return self._build_dashboard().build()
            if scenario.case_name == CaseType.FULL_SLICES:
                return self._build_full_slices().build()
            if scenario.case_name == CaseType.ONLY_SLICES:
                return self._build_slices().build()
            # if scenario.case_name == CaseType.MISC_SLICES:
            #     return self._build_misc_slices().build()
        finally:
            self._current_scenario = None  # type: ignore

    def _build_full_dashboard(self) -> DomainObjectsWrapperBuilder:
        dashboard_wrapper = self._build_dashboard()
        dashboard_slices_wrapper = self._build_full_slices()
        self._connect_parents_with_children(dashboard_wrapper, dashboard_slices_wrapper)
        return dashboard_wrapper

    def _build_dashboard(self) -> DomainObjectsWrapperBuilder:
        return self._build_multiple_objects(DomainObjectTypeNames.DASHBOARD, 1)

    def _build_multiple_objects(
        self, object_type_name: DomainObjectTypeNames, required_objects_amount: int
    ):
        factory = self._domain_objects_factories.get(object_type_name)
        objects = [factory.make() for _ in range(required_objects_amount)]  # type: ignore
        enrichment = self._get_enrichment(object_type_name)
        if enrichment != NO_NEED_ENRICHMENT:
            enrichment.enrich(objects)
        return DomainObjectsWrapperBuilder(object_type_name, objects)

    def _get_enrichment(
        self, object_type_name: DomainObjectTypeNames
    ) -> ObjectEnrichment:
        if object_type_name in self._domain_objects_enrichment:
            return self._domain_objects_enrichment.get(object_type_name)  # type: ignore
        else:
            raise EnrichmentNotDefinedError(object_type_name)

    def _build_full_slices(self) -> DomainObjectsWrapperBuilder:
        slices_wrapper = self._build_slices()
        table_wrapper = self._build_table()
        self._connect_parents_with_children(slices_wrapper, table_wrapper)
        return slices_wrapper

    def _build_slices(self) -> DomainObjectsWrapperBuilder:
        required_slices_amount = self._get_require_slices_amount()
        return self._build_multiple_objects(
            DomainObjectTypeNames.SLICE, required_slices_amount
        )

    def _build_table(self) -> DomainObjectsWrapperBuilder:
        columns_wrapper = self._build_columns()
        table_wrapper = self._build_multiple_objects(DomainObjectTypeNames.TABLE, 1)
        metrics_wrapper = self._build_metrics()
        self._connect_parents_with_children(table_wrapper, columns_wrapper)
        self._connect_parents_with_children(table_wrapper, metrics_wrapper)
        return table_wrapper

    def _connect_parents_with_children(
        self,
        parents_wrapper: DomainObjectsWrapperBuilder,
        children_wrapper: DomainObjectsWrapperBuilder,
    ) -> None:
        parents = parents_wrapper.get_parent_objects()
        children = children_wrapper.get_parent_objects()
        parent_enrichment = self._get_enrichment(parents_wrapper.get_wrapped_type())
        parent_enrichment.join(parents, children_wrapper)
        parents_wrapper.add_children(children)

    def _get_require_slices_amount(self) -> int:
        return len(self._definitions_holder.get_slices_definitions())

    # def _build_misc_slices(self) -> DomainObjectsWrapperBuilder:
    #     slices = []
    #     slice_factory = self._domain_objects_factories.get(DomainObjectTypeNames.SLICE)
    #     for (
    #         raw_slice_key_val_pair
    #     ) in self._definitions_holder.get_misc_slices_definitions().items():
    #         slice_ = slice_factory.make()
    #         self._fill_slice_fields(slice_, raw_slice_key_val_pair)
    #         slices.append(slice_)
    #     return self._build_wrapper(slice_factory.what_make(), slices)

    def _build_columns(self) -> DomainObjectsWrapperBuilder:
        require_columns_amount = self._get_require_columns_amount()
        return self._build_multiple_objects(
            DomainObjectTypeNames.TABLE_COLUMN, require_columns_amount
        )

    def _build_metrics(self) -> DomainObjectsWrapperBuilder:
        require_metrics_amount = self._get_require_metrics_amount()
        return self._build_multiple_objects(
            DomainObjectTypeNames.SQL_METRIC, require_metrics_amount
        )

    def _get_require_columns_amount(self) -> int:
        return len(self._definitions_holder.get_example_table_columns()) + len(
            self._definitions_holder.get_aggregated_example_columns()
        )

    def _get_require_metrics_amount(self) -> int:
        return len(self._definitions_holder.get_table_metrics())
