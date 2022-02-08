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

import json
from typing import Any, List, Tuple, TYPE_CHECKING

from superset.examples.helpers import get_slice_json, update_slice_ids

from ......common.logger_utils import log
from . import ExampleDataObjectsEnrichment, ExampleDataSqlTableEnrichment

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    from ....domain_objects import SupersetDomain
    from ...objects_wrapper import DomainObjectsWrapper


@log
class BirthNamesDashboardEnrichment(ExampleDataObjectsEnrichment):
    def enrich(self, dashbords: List[SupersetDomain]) -> None:
        dashboard = dashbords[0]
        dashboard.published = True
        dashboard.json_metadata = (
            self._definitions_holder.get_default_dashboard_metadata()
        )
        dashboard.dashboard_title = "USA Births Names"
        dashboard.slug = "births"

    def join(
        self, dashbords: List[SupersetDomain], slices_wrapper: DomainObjectsWrapper
    ) -> None:
        dashboard = dashbords[0]
        slices = slices_wrapper.get_parent_objects()
        pos = self._definitions_holder.get_dashboard_positions()
        dashboard.slices = [slc for slc in slices if slc.viz_type != "markup"]
        update_slice_ids(pos, dashboard.slices)
        dashboard.position_json = json.dumps(pos, indent=4)


@log
class BirthNamesSlicesEnrichment(ExampleDataObjectsEnrichment):
    def enrich(self, slices: List[SupersetDomain]) -> None:
        copied_slices = slices.copy()
        for (
            raw_slice_key_val_pair
        ) in self._definitions_holder.get_slices_definitions().items():
            empty_slice = copied_slices.pop()
            self._fill_slice_fields(empty_slice, raw_slice_key_val_pair)

    def _fill_slice_fields(
        self, slice_: Slice, raw_slice_key_val_pair: Tuple[str, Any]
    ) -> None:
        raw_slice_name, raw_slice_definition = raw_slice_key_val_pair
        slice_.datasource_type = "table"
        slice_.slice_name = raw_slice_name
        slice_.viz_type = raw_slice_definition["viz_type"]
        slice_.params = get_slice_json(
            self._definitions_holder.get_default_slice_params(),
            **raw_slice_definition["params"]
        )

    def join(
        self, slices: List[SupersetDomain], table_wrapper: DomainObjectsWrapper
    ) -> None:
        table = table_wrapper.get_parent_objects()[0]
        for slice_ in slices:
            self._join_slice_with_table(slice_, table)

    def _join_slice_with_table(self, slice_: Slice, table: SqlaTable) -> None:
        raw_slice = self._definitions_holder.get_slices_definitions()[slice_.slice_name]
        slice_.table = table
        if "query_context" in raw_slice:
            default_slice_query_context = (
                self._definitions_holder.get_default_slice_query_context()
            )
            default_slice_query_context["datasource"]["id"] = table.id
            slice_.query_context = get_slice_json(
                default_slice_query_context, **raw_slice["query_context"]
            )


@log
class BirthNamesSqlTableEnrichment(ExampleDataSqlTableEnrichment):
    def _fill_table_fields(self, table: SqlaTable) -> None:
        super()._fill_table_fields(table)
        table.main_dttm_col = "ds"
        table.filter_select_enabled = True
        table.fetch_values_predicate = "123 = 123"
