import ipaddress
from typing import Any, List

from sqlalchemy import Column

from superset.business_type.business_type import BusinessType
from superset.business_type.business_type_request import BusinessTypeRequest
from superset.business_type.business_type_response import BusinessTypeResponse
from superset.utils.core import FilterOperator, FilterStringOperators


def cidr_func(req: BusinessTypeRequest) -> BusinessTypeResponse:
    """
    Convert a passed in BusinessTypeRequest to a BusinessTypeResponse
    """
    resp: BusinessTypeResponse = {
        "values": [''],
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
    if req["values"] == ['']:
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
    col: Column, op: FilterOperator, values: List[Any]
) -> Any:
    """
    Convert a passed in column, FilterOperator and list of values into an sqlalchemy expression
    """
    if op == FilterOperator.IN or op == FilterOperator.NOT_IN:
        dict_items = [val for val in values if isinstance(val, dict)]
        single_values = [val for val in values if not isinstance(val, dict)]
        if op == FilterOperator.IN.value:
            cond = col.in_(single_values)
            for dictionary in dict_items:
                cond = cond | (
                    (col <= dictionary["end"]) & (col >= dictionary["start"])
                )
        elif op == FilterOperator.NOT_IN.value:
            cond = ~(col.in_(single_values))
            for dictionary in dict_items:
                cond = cond & (col > dictionary["end"]) & (col < dictionary["start"])
        return cond
    if len(values) == 1:
        value = values[0]
        if op == FilterOperator.EQUALS.value:
            return (
                col == value
                if not isinstance(value, dict)
                else (col <= value["end"]) & (col >= value["start"])
            )
        if op == FilterOperator.GREATER_THAN_OR_EQUALS.value:
            return col >= value if not isinstance(value, dict) else col >= value["end"]
        if op == FilterOperator.GREATER_THAN.value:
            return col > value if not isinstance(value, dict) else col > value["end"]
        if op == FilterOperator.LESS_THAN.value:
            return col < value if not isinstance(value, dict) else col < value["start"]
        if op == FilterOperator.LESS_THAN_OR_EQUALS.value:
            return (
                col <= value if not isinstance(value, dict) else col <= value["start"]
            )
        if op == FilterOperator.NOT_EQUALS.value:
            return (
                col != value
                if not isinstance(value, dict)
                else (col > value["end"]) | (col < value["start"])
            )


internet_address: BusinessType = BusinessType(
    verbose_name="internet address",
    description="represents both an ip and cidr range",
    valid_data_types=["int"],
    translate_filter=cidr_translate_filter_func,
    translate_type=cidr_func,
)
