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

from shortid import ShortId

from superset.models.slice import Slice

logger = logging.getLogger(__name__)


def convert_filter_scopes(
    json_metadata: Dict[Any, Any], filter_boxes: List[Slice]
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

    for filter_box in filter_boxes:
        filter_fields: Dict[str, Dict[str, Any]] = {}
        filter_id = filter_box.id
        slice_params = json.loads(filter_box.params or "{}")
        configs = slice_params.get("filter_configs") or []

        if slice_params.get("date_filter"):
            add_filter_scope(filter_fields, "__time_range", filter_id)
        if slice_params.get("show_sqla_time_column"):
            add_filter_scope(filter_fields, "__time_col", filter_id)
        if slice_params.get("show_sqla_time_granularity"):
            add_filter_scope(filter_fields, "__time_grain", filter_id)
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
    for filter_id, scopes in old_filter_scopes.items():
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


def convert_filter_scopes_to_native_filters(  # pylint: disable=invalid-name,too-many-branches,too-many-locals,too-many-nested-blocks,too-many-statements
    json_metadata: Dict[str, Any],
    position_json: Dict[str, Any],
    filter_boxes: List[Slice],
) -> List[Dict[str, Any]]:
    """
    Convert the legacy filter scopes et al. to the native filter configuration.

    Dashboard filter scopes are implicitly defined where an undefined scope implies
    no immunity, i.e., they apply to all applicable charts. The `convert_filter_scopes`
    method provides an explicit definition by extracting the underlying filter-box
    configurations.

    Hierarchical legacy filters are defined via non-exclusion of peer or children
    filter-box charts whereas native hierarchical filters are defined via explicit
    parental relationships, i.e., the inverse.

    :param json_metata: The dashboard metadata
    :param position_json: The dashboard layout
    :param filter_boxes: The filter-box charts associated with the dashboard
    :returns: The native filter configuration
    :see: convert_filter_scopes
    """

    shortid = ShortId()
    default_filters = json.loads(json_metadata.get("default_filters") or "{}")
    filter_scopes = json_metadata.get("filter_scopes", {})
    filter_box_ids = {filter_box.id for filter_box in filter_boxes}

    filter_scope_by_key_and_field: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(
        dict
    )

    filter_by_key_and_field: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)

    # Dense representation of filter scopes, falling back to chart level filter configs
    # if the respective filter scope is not defined at the dashboard level.
    for filter_box in filter_boxes:
        key = str(filter_box.id)

        filter_scope_by_key_and_field[key] = {
            **(
                convert_filter_scopes(
                    json_metadata,
                    filter_boxes=[filter_box],
                ).get(filter_box.id, {})
            ),
            **(filter_scopes.get(key, {})),
        }

    # Contruct the native filters.
    for filter_box in filter_boxes:
        key = str(filter_box.id)
        params = json.loads(filter_box.params or "{}")

        for field, filter_scope in filter_scope_by_key_and_field[key].items():
            default = default_filters.get(key, {}).get(field)

            fltr: Dict[str, Any] = {
                "cascadeParentIds": [],
                "id": f"NATIVE_FILTER-{shortid.generate()}",
                "scope": {
                    "rootPath": filter_scope["scope"],
                    "excluded": [
                        id_
                        for id_ in filter_scope["immune"]
                        if id_ not in filter_box_ids
                    ],
                },
                "type": "NATIVE_FILTER",
            }

            if field == "__time_col" and params.get("show_sqla_time_column"):
                fltr.update(
                    {
                        "filterType": "filter_timecolumn",
                        "name": "Time Column",
                        "targets": [{"datasetId": filter_box.datasource_id}],
                    }
                )

                if not default:
                    default = params.get("granularity_sqla")

                if default:
                    fltr["defaultDataMask"] = {
                        "extraFormData": {"granularity_sqla": default},
                        "filterState": {"value": [default]},
                    }
            elif field == "__time_grain" and params.get("show_sqla_time_granularity"):
                fltr.update(
                    {
                        "filterType": "filter_timegrain",
                        "name": "Time Grain",
                        "targets": [{"datasetId": filter_box.datasource_id}],
                    }
                )

                if not default:
                    default = params.get("time_grain_sqla")

                if default:
                    fltr["defaultDataMask"] = {
                        "extraFormData": {"time_grain_sqla": default},
                        "filterState": {"value": [default]},
                    }
            elif field == "__time_range" and params.get("date_filter"):
                fltr.update(
                    {
                        "filterType": "filter_time",
                        "name": "Time Range",
                        "targets": [{}],
                    }
                )

                if not default:
                    default = params.get("time_range")

                if default and default != "No filter":
                    fltr["defaultDataMask"] = {
                        "extraFormData": {"time_range": default},
                        "filterState": {"value": default},
                    }
            else:
                for config in params.get("filter_configs") or []:
                    if config["column"] == field:
                        fltr.update(
                            {
                                "controlValues": {
                                    "defaultToFirstItem": False,
                                    "enableEmptyFilter": not config.get(
                                        "clearable",
                                        True,
                                    ),
                                    "inverseSelection": False,
                                    "multiSelect": config.get(
                                        "multiple",
                                        False,
                                    ),
                                    "searchAllOptions": config.get(
                                        "searchAllOptions",
                                        False,
                                    ),
                                },
                                "filterType": "filter_select",
                                "name": config.get("label") or field,
                                "targets": [
                                    {
                                        "column": {"name": field},
                                        "datasetId": filter_box.datasource_id,
                                    },
                                ],
                            }
                        )

                        if "metric" in config:
                            fltr["sortMetric"] = config["metric"]
                            fltr["controlValues"]["sortAscending"] = config["asc"]

                        if params.get("adhoc_filters"):
                            fltr["adhoc_filters"] = params["adhoc_filters"]

                        # Pre-filter available values based on time range/column.
                        time_range = params.get("time_range")

                        if time_range and time_range != "No filter":
                            fltr.update(
                                {
                                    "time_range": time_range,
                                    "granularity_sqla": params.get("granularity_sqla"),
                                }
                            )

                        if not default:
                            default = config.get("defaultValue")

                            if default and config["multiple"]:
                                default = default.split(";")

                        if default:
                            if not isinstance(default, list):
                                default = [default]

                            fltr["defaultDataMask"] = {
                                "extraFormData": {
                                    "filters": [
                                        {
                                            "col": field,
                                            "op": "IN",
                                            "val": default,
                                        }
                                    ],
                                },
                                "filterState": {"value": default},
                            }

                        break

            if "filterType" in fltr:
                filter_by_key_and_field[key][field] = fltr

    # Ancestors of filter-box charts.
    ancestors_by_id = defaultdict(set)

    for filter_box in filter_boxes:
        for value in position_json.values():
            if (
                isinstance(value, dict)
                and value["type"] == "CHART"
                and value["meta"]["chartId"] == filter_box.id
                and value["parents"]  # Misnomer as this the the complete ancestry.
            ):
                ancestors_by_id[filter_box.id] = set(value["parents"])

    # Wire up the hierarchical filters.
    for this in filter_boxes:
        for other in filter_boxes:
            if (
                this != other
                and any(  # Immunity is at the chart rather than field level.
                    this.id not in filter_scope["immune"]
                    and set(filter_scope["scope"]) <= ancestors_by_id[this.id]
                    for filter_scope in filter_scope_by_key_and_field[
                        str(other.id)
                    ].values()
                )
            ):
                for child in filter_by_key_and_field[str(this.id)].values():
                    if child["filterType"] == "filter_select":
                        for parent in filter_by_key_and_field[str(other.id)].values():
                            if (
                                parent["filterType"] in {"filter_select", "filter_time"}
                                and parent["id"] not in child["cascadeParentIds"]
                            ):
                                child["cascadeParentIds"].append(parent["id"])

    return sorted(
        [
            fltr
            for key in filter_by_key_and_field
            for fltr in filter_by_key_and_field[key].values()
        ],
        key=lambda fltr: fltr["filterType"],
    )
