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
import ipaddress
from typing import Any

from sqlalchemy import Column

from superset.advanced_data_type.types import (
    AdvancedDataType,
    AdvancedDataTypeRequest,
    AdvancedDataTypeResponse,
)
from superset.utils.core import FilterOperator, FilterStringOperators


def cidr_func(req: AdvancedDataTypeRequest) -> AdvancedDataTypeResponse:
    """
    Convert a passed in AdvancedDataTypeRequest to a AdvancedDataTypeResponse
    """
    resp: AdvancedDataTypeResponse = {
        "values": [],
        "error_message": "",
        "display_value": "",
        "valid_filter_operators": [
            FilterStringOperators.EQUALS,
            FilterStringOperators.GREATER_THAN_OR_EQUAL,
            FilterStringOperators.GREATER_THAN,
            FilterStringOperators.IN,
            FilterStringOperators.LESS_THAN,
            FilterStringOperators.LESS_THAN_OR_EQUAL,
        ],
    }
    if req["values"] == [""]:
        resp["values"].append("")
        return resp
    for val in req["values"]:
        string_value = str(val)
        try:
            ip_range = (
                ipaddress.ip_network(int(string_value), strict=False)
                if string_value.isnumeric()
                else ipaddress.ip_network(string_value, strict=False)
            )
            resp["values"].append(
                {"start": int(ip_range[0]), "end": int(ip_range[-1])}
                if ip_range[0] != ip_range[-1]
                else int(ip_range[0])
            )
        except ValueError as ex:
            resp["error_message"] = str(ex)
            break
        else:
            resp["display_value"] = ", ".join(
                map(
                    lambda x: f"{x['start']} - {x['end']}"
                    if isinstance(x, dict)
                    else str(x),
                    resp["values"],
                )
            )
    return resp


# Make this return a single clause
def cidr_translate_filter_func(
    col: Column, operator: FilterOperator, values: list[Any]
) -> Any:
    """
    Convert a passed in column, FilterOperator and
    list of values into an sqlalchemy expression
    """
    return_expression: Any
    if operator in (FilterOperator.IN, FilterOperator.NOT_IN):
        dict_items = [val for val in values if isinstance(val, dict)]
        single_values = [val for val in values if not isinstance(val, dict)]
        if operator == FilterOperator.IN.value:
            cond = col.in_(single_values)
            for dictionary in dict_items:
                cond = cond | (col <= dictionary["end"]) & (col >= dictionary["start"])
        elif operator == FilterOperator.NOT_IN.value:
            cond = ~(col.in_(single_values))
            for dictionary in dict_items:
                cond = cond & (col > dictionary["end"]) & (col < dictionary["start"])
        return_expression = cond
    if len(values) == 1:
        value = values[0]
        if operator == FilterOperator.EQUALS.value:
            return_expression = (
                col == value
                if not isinstance(value, dict)
                else (col <= value["end"]) & (col >= value["start"])
            )
        if operator == FilterOperator.GREATER_THAN_OR_EQUALS.value:
            return_expression = (
                col >= value if not isinstance(value, dict) else col >= value["end"]
            )
        if operator == FilterOperator.GREATER_THAN.value:
            return_expression = (
                col > value if not isinstance(value, dict) else col > value["end"]
            )
        if operator == FilterOperator.LESS_THAN.value:
            return_expression = (
                col < value if not isinstance(value, dict) else col < value["start"]
            )
        if operator == FilterOperator.LESS_THAN_OR_EQUALS.value:
            return_expression = (
                col <= value if not isinstance(value, dict) else col <= value["start"]
            )
        if operator == FilterOperator.NOT_EQUALS.value:
            return_expression = (
                col != value
                if not isinstance(value, dict)
                else (col > value["end"]) | (col < value["start"])
            )
    return return_expression


internet_address: AdvancedDataType = AdvancedDataType(
    verbose_name="internet address",
    description="represents both an ip and cidr range",
    valid_data_types=["int"],
    translate_filter=cidr_translate_filter_func,
    translate_type=cidr_func,
)
