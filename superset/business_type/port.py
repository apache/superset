import itertools
from typing import Any, Dict, List

from sqlalchemy import Column

from superset.business_type.business_type import BusinessType
from superset.business_type.business_type_request import BusinessTypeRequest
from superset.business_type.business_type_response import BusinessTypeResponse
from superset.utils.core import FilterOperator, FilterStringOperators

port_conversion_dict: Dict[str, List[int]] = {
    "http": [80],
    "ssh": [22],
    "https": [443],
    "ftp": [20, 21],
    "ftps": [989, 990],
    "telnet": [23],
    "telnets": [992],
    "smtp": [25],
    "submissions": [465],  # aka smtps, ssmtp, urd
    "kerberos": [88],
    "kerberos-adm": [749],
    "pop3": [110],
    "pop3s": [995],
    "nntp": [119],
    "nntps": [563],
    "ntp": [123],
    "snmp": [161],
    "ldap": [389],
    "ldaps": [636],
    "imap2": [143],  # aka imap
    "imaps": [993],
}


def port_translation_func(req: BusinessTypeRequest) -> BusinessTypeResponse:
    """
    Convert a passed in BusinessTypeRequest to a BusinessTypeResponse
    """
    resp: BusinessTypeResponse = {
        "values": [['']],
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
    print(req["values"])
    if req["values"] == ['']:
        return resp
    for val in req["values"]:
        string_value = str(val)
        try:
            if string_value.isnumeric():
                if not 1 <= int(string_value) <= 65535:
                    raise ValueError
            resp["values"].append(
                [int(string_value)]
                if string_value.isnumeric()
                else port_conversion_dict[string_value]
            )
        except (KeyError, ValueError):
            resp["error_message"] = str(
                f"'{string_value}' does not appear to be a port name or number"
            )
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


def port_translate_filter_func(
    col: Column, op: FilterOperator, values: List[Any]
) -> Any:
    """
    Convert a passed in column, FilterOperator and list of values into an sqlalchemy expression
    """
    if op == FilterOperator.IN or op == FilterOperator.NOT_IN:
        vals_list = itertools.chain.from_iterable(values)
        if op == FilterOperator.IN.value:
            cond = col.in_(vals_list)
        elif op == FilterOperator.NOT_IN.value:
            cond = ~(col.in_(vals_list))
        return cond
    if len(values) == 1:
        value = values[0]
        value.sort()
        if op == FilterOperator.EQUALS.value:
            return col.in_(value)
        if op == FilterOperator.GREATER_THAN_OR_EQUALS.value:
            return col >= value[0]
        if op == FilterOperator.GREATER_THAN.value:
            return col > value[0]
        if op == FilterOperator.LESS_THAN.value:
            return col < value[-1]
        if op == FilterOperator.LESS_THAN_OR_EQUALS.value:
            return col <= value[-1]
        if op == FilterOperator.NOT_EQUALS.value:
            return ~col.in_(value)


port: BusinessType = BusinessType(
    verbose_name="port",
    description="represents of a port",
    valid_data_types=["int"],
    translate_filter=port_translate_filter_func,
    translate_type=port_translation_func,
)
