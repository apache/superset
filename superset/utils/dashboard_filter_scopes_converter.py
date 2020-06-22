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
import json
import logging
from collections import defaultdict
from typing import Any, Dict, List

from superset.models.slice import Slice

logger = logging.getLogger(__name__)


def convert_filter_scopes(
    json_metadata: Dict[Any, Any], filters: List[Slice]
) -> Dict[int, Dict[str, Dict[str, Any]]]:
    filter_scopes = {}
    immuned_by_id: List[int] = json_metadata.get("filter_immune_slices") or []
    immuned_by_column: Dict[str, List[int]] = defaultdict(list)
    for slice_id, columns in json_metadata.get(
        "filter_immune_slice_fields", {}
    ).items():
        for column in columns:
            immuned_by_column[column].append(int(slice_id))

    def add_filter_scope(
        filter_fields: Dict[str, Dict[str, Any]], filter_field: str, filter_id: int
    ) -> None:
        # in case filter field is invalid
        if isinstance(filter_field, str):
            current_filter_immune = list(
                set(immuned_by_id + immuned_by_column.get(filter_field, []))
            )
            filter_fields[filter_field] = {
                "scope": ["ROOT_ID"],
                "immune": current_filter_immune,
            }
        else:
            logging.info("slice [%i] has invalid field: %s", filter_id, filter_field)

    for filter_slice in filters:
        filter_fields: Dict[str, Dict[str, Any]] = {}
        filter_id = filter_slice.id
        slice_params = json.loads(filter_slice.params or "{}")
        configs = slice_params.get("filter_configs") or []

        if slice_params.get("date_filter"):
            add_filter_scope(filter_fields, "__time_range", filter_id)
        if slice_params.get("show_sqla_time_column"):
            add_filter_scope(filter_fields, "__time_col", filter_id)
        if slice_params.get("show_sqla_time_granularity"):
            add_filter_scope(filter_fields, "__time_grain", filter_id)
        if slice_params.get("show_druid_time_granularity"):
            add_filter_scope(filter_fields, "__granularity", filter_id)
        if slice_params.get("show_druid_time_origin"):
            add_filter_scope(filter_fields, "druid_time_origin", filter_id)
        for config in configs:
            add_filter_scope(filter_fields, config.get("column"), filter_id)

        if filter_fields:
            filter_scopes[filter_id] = filter_fields

    return filter_scopes


def copy_filter_scopes(
    old_to_new_slc_id_dict: Dict[int, int],
    old_filter_scopes: Dict[int, Dict[str, Dict[str, Any]]],
) -> Dict[str, Dict[Any, Any]]:
    new_filter_scopes: Dict[str, Dict[Any, Any]] = {}
    for (filter_id, scopes) in old_filter_scopes.items():
        new_filter_key = old_to_new_slc_id_dict.get(int(filter_id))
        if new_filter_key:
            new_filter_scopes[str(new_filter_key)] = scopes
            for scope in scopes.values():
                scope["immune"] = [
                    old_to_new_slc_id_dict[int(slice_id)]
                    for slice_id in scope.get("immune", [])
                    if int(slice_id) in old_to_new_slc_id_dict
                ]
    return new_filter_scopes
