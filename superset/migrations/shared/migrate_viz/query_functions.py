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
import math
from enum import Enum
from typing import Any, Dict, List, Optional, Union


class RollingType(Enum):
    Mean = "mean"
    Sum = "sum"
    Std = "std"
    Cumsum = "cumsum"


class ComparisonType(Enum):
    Values = "values"
    Difference = "difference"
    Percentage = "percentage"
    Ratio = "ratio"


class DatasourceType(Enum):
    Table = "table"
    Query = "query"
    Dataset = "dataset"
    SlTable = "sl_table"
    SavedQuery = "saved_query"


UNARY_OPERATORS = ["IS NOT NULL", "IS NULL"]
BINARY_OPERATORS = [
    "==",
    "!=",
    ">",
    "<",
    ">=",
    "<=",
    "ILIKE",
    "LIKE",
    "NOT LIKE",
    "REGEX",
    "TEMPORAL_RANGE",
]
SET_OPERATORS = ["IN", "NOT IN"]

unary_operator_set = set(UNARY_OPERATORS)
binary_operator_set = set(BINARY_OPERATORS)
set_operator_set = set(SET_OPERATORS)


class DatasourceKey:
    def __init__(self, key: str):
        id_str, type_str = key.split("__", 1)
        self.id = int(id_str)
        # Default to Table; if type_str is 'query', then use Query.
        self.type = DatasourceType.Table
        if type_str == "query":
            self.type = DatasourceType.Query

    def __str__(self) -> str:
        return f"{self.id}__{self.type.value}"

    def to_object(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
        }


TIME_COMPARISON_SEPARATOR = "__"
DTTM_ALIAS = "__timestamp"
NO_TIME_RANGE = "No filter"

EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS = [
    "relative_start",
    "relative_end",
    "time_grain_sqla",
]

EXTRA_FORM_DATA_APPEND_KEYS = [
    "adhoc_filters",
    "filters",
    "interactive_groupby",
    "interactive_highlight",
    "interactive_drilldown",
    "custom_form_data",
]

EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS = {
    "granularity": "granularity",
    "granularity_sqla": "granularity",
    "time_column": "time_column",
    "time_grain": "time_grain",
    "time_range": "time_range",
}

EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS = list(
    EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS.keys()
)

EXTRA_FORM_DATA_OVERRIDE_KEYS = (
    EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS + EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS
)


def ensure_is_array(value: Optional[Union[List[Any], Any]] = None) -> List[Any]:
    """
    Ensure a nullable value input is a list. Useful when consolidating
    input format from a select control.
    """
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def is_empty(value: Any) -> bool:
    """
    A simple implementation similar to lodash's isEmpty.
    Returns True if value is None or an empty collection.
    """
    if value is None:
        return True
    if isinstance(value, (list, dict, str, tuple, set)):
        return len(value) == 0
    return False


def is_saved_metric(metric: Any) -> bool:
    """Return True if metric is a saved metric (str)."""
    return isinstance(metric, str)


def is_adhoc_metric_simple(metric: Any) -> bool:
    """Return True if metric dict is a simple adhoc metric."""
    return (
        not isinstance(metric, str)
        and isinstance(metric, dict)
        and metric.get("expressionType") == "SIMPLE"
    )


def is_adhoc_metric_sql(metric: Any) -> bool:
    """Return True if metric dict is an SQL adhoc metric."""
    return (
        not isinstance(metric, str)
        and isinstance(metric, dict)
        and metric.get("expressionType") == "SQL"
    )


def is_query_form_metric(metric: Any) -> bool:
    """Return True if metric is of any query form type."""
    return (
        is_saved_metric(metric)
        or is_adhoc_metric_simple(metric)
        or is_adhoc_metric_sql(metric)
    )


def get_metric_label(metric: Any | dict[str, Any]) -> Any | dict[str, Any]:
    """
    Get the label for a given metric.

    Args:
        metric (dict): The metric object.

    Returns:
        dict: The label of the metric.
    """
    if is_saved_metric(metric):
        return metric
    if "label" in metric and metric["label"]:
        return metric["label"]
    if is_adhoc_metric_simple(metric):
        column_name = metric["column"].get("columnName") or metric["column"].get(
            "column_name"
        )
        return f"{metric['aggregate']}({column_name})"
    return metric["sqlExpression"]


def extract_extra_metrics(form_data: Dict[str, Any]) -> List[Any]:
    """
    Extract extra metrics from the form data.

    Args:
        form_data (Dict[str, Any]): The query form data.

    Returns:
        List[Any]: A list of extra metrics.
    """
    groupby = form_data.get("groupby", [])
    timeseries_limit_metric = form_data.get("timeseries_limit_metric")
    x_axis_sort = form_data.get("x_axis_sort")
    metrics = form_data.get("metrics", [])

    extra_metrics = []
    limit_metric = (
        ensure_is_array(timeseries_limit_metric)[0] if timeseries_limit_metric else None
    )

    if (
        not groupby
        and limit_metric
        and get_metric_label(limit_metric) == x_axis_sort
        and not any(get_metric_label(metric) == x_axis_sort for metric in metrics)
    ):
        extra_metrics.append(limit_metric)

    return extra_metrics


def get_metric_offsets_map(
    form_data: dict[str, List[str]], query_object: dict[str, List[str]]
) -> dict[str, Any]:
    """
    Return a dictionary mapping metric offset-labels to metric-labels.

    Args:
        form_data (Dict[str, List[str]]): The form data containing time comparisons.
        query_object (Dict[str, List[str]]): The query object containing metrics.

    Returns:
        Dict[str, str]: A dictionary with offset-labels as keys and metric-labels
        as values.
    """
    query_metrics = ensure_is_array(query_object.get("metrics", []))
    time_offsets = ensure_is_array(form_data.get("time_compare", []))

    metric_labels = [get_metric_label(metric) for metric in query_metrics]
    metric_offset_map = {}

    for metric in metric_labels:
        for offset in time_offsets:
            key = f"{metric}{TIME_COMPARISON_SEPARATOR}{offset}"
            metric_offset_map[key] = metric

    return metric_offset_map


def is_time_comparison(form_data: dict[str, Any], query_object: dict[str, Any]) -> bool:
    """
    Determine if the query involves a time comparison.

    Args:
        form_data (dict): The form data containing query parameters.
        query_object (dict): The query object.

    Returns:
        bool: True if it is a time comparison, False otherwise.
    """
    comparison_type = form_data.get("comparison_type")
    metric_offset_map = get_metric_offsets_map(form_data, query_object)

    return (
        comparison_type in [ct.value for ct in ComparisonType]
        and len(metric_offset_map) > 0
    )


def ensure_is_int(value: Any, default_value: Any = None) -> Any | float:
    """
    Convert the given value to an integer.
    If conversion fails, returns default_value if provided,
    otherwise returns NaN (as float('nan')).
    """
    try:
        val = int(str(value))
    except (ValueError, TypeError):
        return default_value if default_value is not None else float("nan")
    return val


def is_physical_column(column: Any = None) -> bool:
    """Return True if column is a physical column (string)."""
    return isinstance(column, str)


def is_adhoc_column(column: Any = None) -> bool:
    """Return True if column is an adhoc column (object with SQL expression)."""
    if type(column) is not dict:
        return False
    return (
        "sqlExpression" in column.keys()
        and column["sqlExpression"] is not None
        and "label" in column.keys()
        and column["label"] is not None
        and ("sqlExpression" not in column.keys() or column["expressionType"] == "SQL")
    )


def is_query_form_column(column: Any) -> bool:
    """Return True if column is either physical or adhoc."""
    return is_physical_column(column) or is_adhoc_column(column)


def is_x_axis_set(form_data: dict[str, Any]) -> bool:
    """Return True if the x_axis is specified in form_data."""
    return is_query_form_column(form_data.get("x_axis"))


def get_x_axis_column(form_data: dict[str, Any]) -> Optional[Any]:
    """Return x_axis column."""
    if not (form_data.get("granularity_sqla") or form_data.get("x_axis")):
        return None

    if is_x_axis_set(form_data):
        return form_data.get("x_axis")

    return DTTM_ALIAS


def get_column_label(column: Any) -> Optional[str]:
    """Return the string label for a column."""
    if is_physical_column(column):
        return column
    if column and column.get("label"):
        return column.get("label")
    return column.get("sqlExpression", None)


def get_x_axis_label(form_data: dict[str, Any]) -> Optional[str]:
    """Return the x_axis label from form_data."""
    if col := get_x_axis_column(form_data):
        return get_column_label(col)
    return None


def time_compare_pivot_operator(
    form_data: dict[str, Any], query_object: dict[str, Any]
) -> Optional[dict[str, Any]]:
    """
    A post-processing factory function for pivot operations.

    Args:
        form_data: The form data containing configuration
        query_object: The query object with series and columns information

    Returns:
        Dictionary with pivot operation configuration or None
    """
    metric_offset_map = get_metric_offsets_map(form_data, query_object)
    x_axis_label = get_x_axis_label(form_data)
    columns = (
        query_object.get("series_columns")
        if query_object.get("series_columns") is not None
        else query_object.get("columns")
    )

    if is_time_comparison(form_data, query_object) and x_axis_label:
        # Create aggregates dictionary from metric offset map
        metrics = list(metric_offset_map.values()) + list(metric_offset_map.keys())
        aggregates = {
            metric: {"operator": "mean"}  # use 'mean' aggregates to avoid dropping NaN
            for metric in metrics
        }

        return {
            "operation": "pivot",
            "options": {
                "index": [x_axis_label],
                "columns": [get_column_label(col) for col in ensure_is_array(columns)],
                "drop_missing_columns": not form_data.get("show_empty_columns"),
                "aggregates": aggregates,
            },
        }

    return None


def pivot_operator(
    form_data: dict[str, Any], query_object: dict[str, Any]
) -> Optional[dict[str, Any]]:
    """
    Construct a pivot operator configuration for post-processing.

    This function extracts metric labels (including extra metrics) from the query object
    and form data, and retrieves the x-axis label. If both an x-axis label and at
    least one metric label are present, it builds a pivot configuration that sets
    the index as the x-axis label, transforms the columns via get_column_label,
    and creates dummy 'mean' aggregates for each metric.

    Args:
        form_data (dict): The form data containing query parameters.
        query_object (dict): The base query object containing metrics
          and column information.

    Returns:
        dict or None: A dict with the pivot operator configuration
        if the conditions are met,
        otherwise None.
    """
    metric_labels = [
        *ensure_is_array(query_object.get("metrics", [])),
        *extract_extra_metrics(form_data),
    ]
    metric_labels = [get_metric_label(metric) for metric in metric_labels]
    x_axis_label = get_x_axis_label(form_data)
    columns = (
        query_object.get("series_columns")
        if query_object.get("series_columns") is not None
        else query_object.get("columns")
    )

    if x_axis_label and metric_labels:
        cols_list = [get_column_label(col) for col in ensure_is_array(columns)]
        return {
            "operation": "pivot",
            "options": {
                "index": [x_axis_label],
                "columns": cols_list,
                # Create 'dummy' mean aggregates to assign cell values in pivot table
                # using the 'mean' aggregates to avoid dropping NaN values
                "aggregates": {
                    metric: {"operator": "mean"} for metric in metric_labels
                },
                "drop_missing_columns": not form_data.get("show_empty_columns"),
            },
        }

    return None


def normalize_order_by(query_object: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize the orderby clause in the query object.

    If the "orderby" key already contains a valid clause (a list whose first element
    is a list of two elements, where the first element is truthy and the second a bool),
    the original query_object is returned. Otherwise, the function creates a copy of
    query_object, removes invalid orderby-related keys, and sets an orderby clause based
    on available keys: "series_limit_metric", "legacy_order_by", or the first metric in
    the "metrics" list. The sorting order is determined by the negation of "order_desc".

    Args:
        query_object (dict): The query object containing orderby and related keys.

    Returns:
        dict: A modified query object with a normalized "orderby" clause.
    """
    if (
        isinstance(query_object.get("orderby"), list)
        and len(query_object.get("orderby", [])) > 0
    ):
        # ensure a valid orderby clause
        orderby_clause = query_object["orderby"][0]
        if (
            isinstance(orderby_clause, list)
            and len(orderby_clause) == 2
            and orderby_clause[0]
            and isinstance(orderby_clause[1], bool)
        ):
            return query_object

    # remove invalid orderby keys from a copy
    clone_query_object = query_object.copy()
    clone_query_object.pop("series_limit_metric", None)
    clone_query_object.pop("legacy_order_by", None)
    clone_query_object.pop("order_desc", None)
    clone_query_object.pop("orderby", None)

    is_asc = not query_object.get("order_desc", False)

    if query_object.get("series_limit_metric") is not None and query_object.get(
        "series_limit_metric"
    ):
        return {
            **clone_query_object,
            "orderby": [[query_object["series_limit_metric"], is_asc]],
        }

    # todo: Removed `legacy_order_by` after refactoring
    if query_object.get("legacy_order_by") is not None and query_object.get(
        "legacy_order_by"
    ):
        return {
            **clone_query_object,
            "orderby": [[query_object["legacy_order_by"], is_asc]],
        }

    if (
        isinstance(query_object.get("metrics"), list)
        and len(query_object.get("metrics", [])) > 0
    ):
        return {**clone_query_object, "orderby": [[query_object["metrics"][0], is_asc]]}

    return clone_query_object


def remove_duplicates(items: Any, hash_func: Any = None) -> list[Any]:
    """
    Remove duplicate items from a list.

    Args:
        items: List of items to deduplicate
        hash_func: Optional function to generate a hash for comparison

    Returns:
        List with duplicates removed
    """
    if hash_func:
        seen = set()
        result = []
        for x in items:
            item_hash = hash_func(x)
            if item_hash not in seen:
                seen.add(item_hash)
                result.append(x)
        return result
    else:
        # Using Python's built-in uniqueness for lists
        return list(dict.fromkeys(items))  # Preserves order in Python 3.7+


def extract_fields_from_form_data(
    rest_form_data: dict[str, Any],
    query_field_aliases: dict[str, Any],
    query_mode: Any | str,
) -> tuple[list[Any], list[Any], list[Any]]:
    """
    Extract fields from form data based on aliases and query mode.

    Args:
        rest_form_data (dict): The residual form data.
        query_field_aliases (dict): A mapping of key aliases.
        query_mode (str): The query mode, e.g. 'aggregate' or 'raw'.

    Returns:
        tuple: A tuple of three lists: (columns, metrics, orderby)
    """
    columns = []
    metrics = []
    orderby = []

    for key, value in rest_form_data.items():
        if value is None:
            continue

        normalized_key = query_field_aliases.get(key, key)

        if query_mode == "aggregate" and normalized_key == "columns":
            continue
        if query_mode == "raw" and normalized_key in ["groupby", "metrics"]:
            continue

        if normalized_key == "groupby":
            normalized_key = "columns"

        if normalized_key == "metrics":
            metrics.extend(value if isinstance(value, list) else [value])
        elif normalized_key == "columns":
            columns.extend(value if isinstance(value, list) else [value])
        elif normalized_key == "orderby":
            orderby.extend(value if isinstance(value, list) else [value])

    return columns, metrics, orderby


def extract_query_fields(
    form_data: dict[Any, Any], aliases: Any = None
) -> Union[dict[str, Any]]:
    """
    Extract query fields from form data.

    Args:
        form_data: Form data residual
        aliases: Query field aliases

    Returns:
        Dictionary with columns, metrics, and orderby fields
    """
    query_field_aliases = {
        "metric": "metrics",
        "metric_2": "metrics",
        "secondary_metric": "metrics",
        "x": "metrics",
        "y": "metrics",
        "size": "metrics",
        "all_columns": "columns",
        "series": "groupby",
        "order_by_cols": "orderby",
    }

    if aliases:
        query_field_aliases.update(aliases)
    query_mode = form_data.pop("query_mode", None)
    rest_form_data = form_data

    columns, metrics, orderby = extract_fields_from_form_data(
        rest_form_data, query_field_aliases, query_mode
    )

    result: dict[str, Any] = {
        "columns": remove_duplicates(
            [col for col in columns if col != ""], get_column_label
        ),
        "orderby": None,
    }
    if query_mode != "raw":
        result["metrics"] = remove_duplicates(metrics, get_metric_label)
    else:
        result["metrics"] = None
    if orderby:
        result["orderby"] = []
        for item in orderby:
            if isinstance(item, str):
                try:
                    result["orderby"].append(json.loads(item))
                except Exception as err:
                    raise ValueError("Found invalid orderby options") from err
            else:
                result["orderby"].append(item)

    return result


def extract_extras(form_data: dict[str, Any]) -> dict[str, Any]:
    """
    Extract extras from the form_data analogous to the TS version.
    """
    applied_time_extras: dict[str, Any] = {}
    filters: list[Any] = []
    extras: dict[str, Any] = {}
    extract: dict[str, Any] = {
        "filters": filters,
        "extras": extras,
        "applied_time_extras": applied_time_extras,
    }

    # Mapping reserved columns to query field names
    reserved_columns_to_query_field = {
        "__time_range": "time_range",
        "__time_col": "granularity_sqla",
        "__time_grain": "time_grain_sqla",
        "__granularity": "granularity",
    }

    extra_filters = form_data.get("extra_filters", [])
    for filter_item in extra_filters:
        col = filter_item.get("col")
        # Check if filter col is reserved
        if col in reserved_columns_to_query_field:
            query_field = reserved_columns_to_query_field[col]
            # Assign the filter value to the extract dict
            extract[query_field] = filter_item.get("val")
            applied_time_extras[col] = filter_item.get("val")
        else:
            filters.append(filter_item)

    # SQL: set extra properties based on TS logic
    if "time_grain_sqla" in form_data.keys() or "time_grain_sqla" in extract.keys():
        # If time_grain_sqla is set in form_data, use it
        # Otherwise, use the value from extract
        value = form_data.get("time_grain_sqla") or form_data.get("time_grain_sqla")
        extras["time_grain_sqla"] = value

    extract["granularity"] = (
        extract.get("granularity_sqla")
        or form_data.get("granularity")
        or form_data.get("granularity_sqla")
    )
    # Remove temporary keys
    extract.pop("granularity_sqla", None)
    extract.pop("time_grain_sqla", None)
    if extract["granularity"] is None:
        extract.pop("granularity", None)

    return extract


def is_defined(x: Any) -> bool:
    """
    Returns True if x is not None.
    This is equivalent to checking that x is neither null nor undefined in TypeScript.
    """
    return x is not None


def sanitize_clause(clause: str) -> str:
    """
    Sanitize a SQL clause. If the clause contains '--', append a newline.
    Then wrap the clause in parentheses.
    """
    if clause is None:
        return ""
    sanitized_clause = clause
    if "--" in clause:
        sanitized_clause = clause + "\n"
    return f"({sanitized_clause})"


def is_unary_operator(operator: Any | str) -> bool:
    """Return True if operator is unary."""
    return operator in unary_operator_set


def is_binary_operator(operator: Any | str) -> bool:
    """Return True if operator is binary."""
    return operator in binary_operator_set


def is_set_operator(operator: Any | str) -> bool:
    """Return True if operator is a set operator."""
    return operator in set_operator_set


def is_unary_adhoc_filter(filter_item: dict[str, Any]) -> bool:
    """Return True if the filter's operator is unary."""
    return is_unary_operator(filter_item.get("operator"))


def is_binary_adhoc_filter(filter_item: dict[str, Any]) -> bool:
    """Return True if the filter's operator is binary."""
    return is_binary_operator(filter_item.get("operator"))


def convert_filter(filter_item: dict[str, Any]) -> dict[str, Any]:
    """Convert an adhoc filter to a query clause dict."""
    subject = filter_item.get("subject")
    if is_unary_adhoc_filter(filter_item):
        operator = filter_item.get("operator")
        return {"col": subject, "op": operator}
    if is_binary_adhoc_filter(filter_item):
        operator = filter_item.get("operator")
        val = filter_item.get("comparator")
        result = {"col": subject, "op": operator}
        if val is not None:
            result["val"] = val
        return result
    operator = filter_item.get("operator")
    val = filter_item.get("comparator")
    result = {"col": subject, "op": operator}
    if val is not None:
        result["val"] = val
    return result


def is_simple_adhoc_filter(filter_item: dict[str, Any]) -> bool:
    """Return True if the filter is a simple adhoc filter."""
    return filter_item.get("expressionType") == "SIMPLE"


def process_filters(form_data: dict[str, Any]) -> dict[str, Any]:
    """
    Process filters from form_data:
      - Split adhoc_filters according to clause and expression type.
      - Build simple filter and freeform SQL clauses for WHERE/HAVING.
      - Place freeform clauses into extras.
    """
    adhoc_filters = form_data.get("adhoc_filters", [])
    extras = form_data.get("extras", {})
    filters_list = form_data.get("filters", [])

    # Copy filters_list into simple_where
    simple_where = filters_list[:]
    freeform_where = []
    freeform_having = []

    if where := form_data.get("where"):
        freeform_where.append(where)

    for filter_item in adhoc_filters:
        clause = filter_item.get("clause")
        if is_simple_adhoc_filter(filter_item):
            filter_clause = convert_filter(filter_item)
            if clause == "WHERE":
                simple_where.append(filter_clause)
        else:
            sql_expression = filter_item.get("sqlExpression")
            if clause == "WHERE":
                freeform_where.append(sql_expression)
            else:
                freeform_having.append(sql_expression)

    extras["having"] = " AND ".join([sanitize_clause(s) for s in freeform_having])
    extras["where"] = " AND ".join([sanitize_clause(s) for s in freeform_where])

    return {
        "filters": simple_where,
        "extras": extras,
    }


def override_extra_form_data(
    query_object: dict[str, Any], override_form_data: dict[str, Any]
) -> dict[str, Any]:
    """
    Override parts of the query_object with values from override_form_data.

    Mimics the behavior of the TypeScript function:
      - For keys in EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS,
        if set in override_form_data, assign the value in query_object
        under the mapped target key.
      - For keys in EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS,
        if present in override_form_data, add them to query_object['extras'].
    """
    # Create a copy of the query object
    overridden_form_data = query_object.copy()
    # Ensure extras is a mutable copy of what's in query_object (or an empty dict)
    overridden_extras = overridden_form_data.get("extras", {}).copy()

    # Process regular mappings
    for key, target in EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS.items():
        value = override_form_data.get(key)
        if value is not None:
            overridden_form_data[target] = value

    # Process extra keys
    for key in EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS:
        if key in override_form_data:
            overridden_extras[key] = override_form_data[key]

    if overridden_extras:
        overridden_form_data["extras"] = overridden_extras

    return overridden_form_data


def build_query_object(
    form_data: dict[str, Any], query_fields: Any = None
) -> dict[str, Any]:
    """
    Build a query object from form data.

    Args:
        form_data: Dictionary containing form data
        query_fields: Optional query field aliases

    Returns:
        Dictionary representing the query object
    """
    # Extract fields from form_data with defaults
    annotation_layers = form_data.get("annotation_layers", [])
    extra_form_data = form_data.get("extra_form_data", {})
    time_range = form_data.get("time_range")
    since = form_data.get("since")
    until = form_data.get("until")
    row_limit = form_data.get("row_limit")
    row_offset = form_data.get("row_offset")
    order_desc = form_data.get("order_desc")
    limit: Any | int = form_data.get("limit")
    timeseries_limit_metric = form_data.get("timeseries_limit_metric")
    granularity = form_data.get("granularity")
    url_params = form_data.get("url_params", {})
    custom_params = form_data.get("custom_params", {})
    series_columns = form_data.get("series_columns")
    series_limit: Any | str = form_data.get("series_limit")
    series_limit_metric = form_data.get("series_limit_metric")

    # Create residual_form_data by removing extracted fields
    residual_form_data = {
        k: v
        for k, v in form_data.items()
        if k
        not in [
            "annotation_layers",
            "extra_form_data",
            "time_range",
            "since",
            "until",
            "row_limit",
            "row_offset",
            "order_desc",
            "limit",
            "timeseries_limit_metric",
            "granularity",
            "url_params",
            "custom_params",
            "series_columns",
            "series_limit",
            "series_limit_metric",
        ]
    }

    # Extract fields from extra_form_data
    append_adhoc_filters = (
        extra_form_data.get("adhoc_filters", []) if extra_form_data else []
    )
    append_filters = extra_form_data.get("filters", []) if extra_form_data else []
    custom_form_data = (
        extra_form_data.get("custom_form_data", {}) if extra_form_data else {}
    )
    overrides = (
        {
            k: v
            for k, v in extra_form_data.items()
            if k not in ["adhoc_filters", "filters", "custom_form_data"]
        }
        if extra_form_data
        else {}
    )

    # Convert to numeric values
    numeric_row_limit: Any = float(row_limit) if row_limit is not None else None
    numeric_row_offset: Any = float(row_offset) if row_offset is not None else None

    # Extract query fields
    extracted_fields = extract_query_fields(residual_form_data, query_fields)
    metrics = extracted_fields.get("metrics")
    columns = extracted_fields.get("columns")
    orderby = extracted_fields.get("orderby")

    # Collect and process filters
    extras = extract_extras(form_data)
    extra_filters = extras.get("filters", [])
    filter_form_data = {
        "filters": extra_filters + append_filters,
        "adhoc_filters": (form_data.get("adhoc_filters") or []) + append_adhoc_filters,
    }
    extras_and_filters = process_filters({**form_data, **extras, **filter_form_data})

    def normalize_series_limit_metric(metric: Any) -> Optional[Any]:
        if is_query_form_metric(metric):
            return metric
        return None

    # Build the query object
    query_object: dict[Any, Any] = {
        **extras,
        **extras_and_filters,
        "columns": columns,
        "metrics": metrics,
        "orderby": orderby,
        "annotation_layers": annotation_layers,
        "series_columns": series_columns,
        "row_limit": (
            None
            if row_limit is None or math.isnan(numeric_row_limit)
            else int(numeric_row_limit)
        ),
        "series_limit": (
            series_limit
            if series_limit is not None
            else (int(limit) if is_defined(limit) else 0)
        ),
        "order_desc": True if order_desc is None else order_desc,
        "url_params": url_params,
        "custom_params": custom_params,
    }

    row_offset = (
        None
        if row_offset is None or math.isnan(numeric_row_offset)
        else numeric_row_offset
    )

    temp = normalize_series_limit_metric(series_limit_metric)
    series_limit_metric = temp if temp is not None else timeseries_limit_metric

    for key, value in [
        ("time_range", time_range),
        ("since", since),
        ("until", until),
        ("granularity", granularity),
        ("series_limit_metric", series_limit_metric),
        ("row_offset", row_offset),
    ]:
        if value is not None:
            query_object[key] = value

    # Override extra form data
    query_object = override_extra_form_data(query_object, overrides)

    query_object = {k: v for k, v in query_object.items() if v is not None}

    # Return the final query object with custom form data
    return {**query_object, "custom_form_data": custom_form_data}


def omit(d: dict[str, Any], keys: list[Any]) -> dict[str, Any]:
    """
    Return a copy of dictionary d without the specified keys.
    """
    return {k: v for k, v in d.items() if k not in keys}


def normalize_time_column(
    form_data: dict[str, Any], query_object: dict[str, Any]
) -> dict[str, Any]:
    """
    If x_axis is set in form_data, find its index in query_object's columns and update
      that column
    with timeGrain and columnType information. The updated query_object omits
      the 'is_timeseries' key.
    """
    if not is_x_axis_set(form_data):
        return query_object

    _columns: list[Any] = query_object.get("columns", [])
    _extras = query_object.get("extras", {})
    # Create a shallow copy of columns
    mutated_columns = list(_columns)
    x_axis: Any = form_data.get("x_axis")
    axis_idx = None

    # Find the index of the x_axis in the columns list
    for idx, col in enumerate(_columns):
        if (
            is_physical_column(col) and is_physical_column(x_axis) and col == x_axis
        ) or (
            is_adhoc_column(col)
            and is_adhoc_column(x_axis)
            and col.get("sqlExpression") == x_axis.get("sqlExpression")
        ):
            axis_idx = idx
            break

    if axis_idx is not None and axis_idx > -1 and x_axis and isinstance(_columns, list):
        if is_adhoc_column(_columns[axis_idx]):
            # Update the adhoc column with additional keys.
            updated = dict(_columns[axis_idx])
            updated["columnType"] = "BASE_AXIS"
            if _extras:
                if "time_grain_sqla" in _extras.keys():
                    updated["timeGrain"] = _extras["time_grain_sqla"]
            mutated_columns[axis_idx] = updated

        else:
            # For physical columns, create a new column entry.
            mutated_columns[axis_idx] = {
                "columnType": "BASE_AXIS",
                "sqlExpression": x_axis,
                "label": x_axis,
                "expressionType": "SQL",
            }
            if _extras:
                if "time_grain_sqla" in _extras.keys():
                    mutated_columns[axis_idx]["timeGrain"] = _extras["time_grain_sqla"]

        # Create a new query object without the 'is_timeseries' key.
        new_query_object = omit(query_object, ["is_timeseries"])
        new_query_object["columns"] = mutated_columns
        return new_query_object

    # Fallback: return the original query_object
    return query_object


def build_query_context(
    form_data: dict[str, Any], options: Any = None
) -> dict[str, Any]:
    # Handle options based on type
    def default_build_query(x: Any) -> list[Any]:
        return [x]

    if callable(options):
        query_fields = {}
        build_query = options
    elif options:
        query_fields = options.get("query_fields", {})
        build_query = options.get("build_query", lambda x: [x])
    else:
        query_fields = {}
        build_query = default_build_query

    queries = build_query(build_query_object(form_data, query_fields))

    for query in queries:
        if isinstance(query.get("post_processing"), list):
            query["post_processing"] = [p for p in query["post_processing"] if p]

    if is_x_axis_set(form_data):
        queries = [normalize_time_column(form_data, query) for query in queries]

    return {
        "datasource": DatasourceKey(form_data["datasource"]).to_object(),
        "force": form_data.get("force", False),
        "queries": queries,
        "form_data": form_data,
        "result_format": form_data.get("result_format", "json"),
        "result_type": form_data.get("result_type", "full"),
    }


def rolling_window_operator(
    form_data: dict[str, Any], query_object: dict[str, Any]
) -> Optional[dict[str, Any]]:
    """
    Builds a post-processing configuration for a rolling window.

    - If it's a time comparison, compute the columns from the metric offsets map.
    - Otherwise, derive the columns from query_object.metrics.
    - Then, based on the rolling_type, return a configuration dict.
    """
    # Determine the columns to operate on
    if is_time_comparison(form_data, query_object):
        metrics_map = get_metric_offsets_map(form_data, query_object)
        columns = list(metrics_map.values()) + list(metrics_map.keys())
    else:
        metrics = ensure_is_array(query_object.get("metrics"))
        columns = []
        for metric in metrics:
            if isinstance(metric, str):
                columns.append(metric)
            elif isinstance(metric, dict):
                columns.append(metric.get("label"))

    # Build a columns map from the list of columns
    columns_map = {col: col for col in columns if col is not None}

    # Determine the operation based on rolling_type
    rolling_type = form_data.get("rolling_type")

    if rolling_type == RollingType.Cumsum.value:
        return {
            "operation": "cum",
            "options": {
                "operator": "sum",
                "columns": columns_map,
            },
        }

    if rolling_type in [
        RollingType.Sum.value,
        RollingType.Mean.value,
        RollingType.Std.value,
    ]:
        return {
            "operation": "rolling",
            "options": {
                "rolling_type": rolling_type,
                "window": ensure_is_int(form_data.get("rolling_periods"), 1),
                "min_periods": ensure_is_int(form_data.get("min_periods"), 0),
                "columns": columns_map,
            },
        }

    return None


def time_compare_operator(
    form_data: Dict[str, Any], query_object: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Returns a post-processing configuration for time comparison if applicable.

    If time comparison is enabled and the comparison type is not 'values',
    builds a configuration dict that specifies the operation and options.
    """
    comparison_type = form_data.get("comparison_type")
    metric_offset_map = get_metric_offsets_map(form_data, query_object)

    if (
        is_time_comparison(form_data, query_object)
        and comparison_type != ComparisonType.Values.value
    ):
        return {
            "operation": "compare",
            "options": {
                "source_columns": list(metric_offset_map.values()),
                "compare_columns": list(metric_offset_map.keys()),
                "compare_type": comparison_type,
                "drop_original_columns": True,
            },
        }
    return None


def resample_operator(
    form_data: dict[str, Any], query_object: dict[str, Any]
) -> Any | dict[str, Any]:
    """
    Returns a post-processing configuration for resampling if the required
    resample_method and resample_rule are provided in form_data.
    """
    resample_zero_fill = form_data.get("resample_method") == "zerofill"
    resample_method = (
        "asfreq" if resample_zero_fill else form_data.get("resample_method")
    )
    resample_rule = form_data.get("resample_rule")

    if resample_method and resample_rule:
        return {
            "operation": "resample",
            "options": {
                "method": resample_method,
                "rule": resample_rule,
                "fill_value": 0 if resample_zero_fill else None,
            },
        }
    return None


def rename_operator(
    form_data: dict[str, Any], query_object: dict[str, Any]
) -> Optional[dict[str, Any]]:
    """
    Produces a post-processing configuration to rename columns based on the criteria:
      1) Only one metric exists.
      2) There is at least one dimension (series_columns or columns).
      3) An x-axis label exists.
      4) If time comparison is enabled and its comparison type is not one of
         [difference, ratio, percentage].
      5) The form data contains a truthy 'truncate_metric' flag.

    Additionally, if time comparison is active and the comparison type is 'values',
    the operator renames the metric with the corresponding offset label.
    """
    metrics: Any = ensure_is_array(query_object.get("metrics"))
    columns = ensure_is_array(
        query_object.get("series_columns")
        if query_object.get("series_columns") is not None
        else query_object.get("columns")
    )
    truncate_metric = form_data.get("truncate_metric")
    x_axis_label = get_x_axis_label(form_data)

    # Check conditions for renaming
    if (
        len(metrics) == 1
        and len(columns) > 0
        and x_axis_label
        and not (
            is_time_comparison(form_data, query_object)
            and form_data.get("comparison_type")
            in {
                ComparisonType.Difference.value,
                ComparisonType.Ratio.value,
                ComparisonType.Percentage.value,
            }
        )
        and truncate_metric is not None
        and bool(truncate_metric)
    ):
        rename_pairs: Any = []

        if (
            is_time_comparison(form_data, query_object)
            and form_data.get("comparison_type") == ComparisonType.Values.value
        ):
            metric_offset_map = get_metric_offsets_map(form_data, query_object)
            time_offsets = ensure_is_array(form_data.get("time_compare"))
            for metric_with_offset in list(metric_offset_map.keys()):
                offset_label = next(
                    (offset for offset in time_offsets if offset in metric_with_offset),
                    None,
                )
                rename_pairs.append((metric_with_offset, offset_label))

        rename_pairs.append((get_metric_label(metrics[0]), None))

        return {
            "operation": "rename",
            "options": {
                "columns": dict(rename_pairs),
                "level": 0,
                "inplace": True,
            },
        }

    return None


def contribution_operator(
    form_data: dict[str, Any], query_object: dict[str, Any], time_shifts: Any
) -> Optional[dict[str, Any]]:
    """
    Returns a post-processing configuration for contribution if
    form_data.contributionMode is truthy.
    """
    if form_data.get("contributionMode"):
        return {
            "operation": "contribution",
            "options": {
                "orientation": form_data.get("contributionMode"),
                "time_shifts": time_shifts,
            },
        }
    return None


def sort_operator(
    form_data: Dict[str, Any], query_object: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Build a sort post-processing configuration if the conditions are met.

    Conditions:
      - form_data.x_axis_sort and form_data.x_axis_sort_asc are defined.
      - The sort key exists in sortableLabels.
      - groupby is empty.

    If the sort key matches the x-axis label, sort using the index.
    Otherwise, sort by the provided sort key.
    """
    # Build the sortable labels list
    sortable_labels: list[Any] = [
        get_x_axis_label(form_data),
    ]
    sortable_labels += [
        get_metric_label(m) for m in ensure_is_array(form_data.get("metrics"))
    ]
    sortable_labels += [get_metric_label(m) for m in extract_extra_metrics(form_data)]
    # Filter out any falsy values
    sortable_labels = [label for label in sortable_labels if label]

    # Check the required conditions.
    if (
        is_defined(form_data.get("x_axis_sort"))
        and is_defined(form_data.get("x_axis_sort_asc"))
        and form_data.get("x_axis_sort") in sortable_labels
        and is_empty(form_data.get("groupby"))  ##
    ):
        if form_data.get("x_axis_sort") == get_x_axis_label(form_data):
            return {
                "operation": "sort",
                "options": {
                    "is_sort_index": True,
                    "ascending": form_data.get("x_axis_sort_asc"),
                },
            }
        return {
            "operation": "sort",
            "options": {
                "by": form_data.get("x_axis_sort"),
                "ascending": form_data.get("x_axis_sort_asc"),
            },
        }
    return None


def flatten_operator(
    form_data: dict[str, Any], query_object: dict[str, Any]
) -> dict[str, Any]:
    """
    Returns a post-processing configuration that indicates a flatten operation.
    """
    return {"operation": "flatten"}


def prophet_operator(
    form_data: dict[str, Any], query_object: dict[str, Any]
) -> Any | dict[str, Any]:
    """
    Returns a post-processing configuration for prophet forecasting
    if forecast is enabled and an x-axis label is present.
    """
    x_axis_label = get_x_axis_label(form_data)
    if form_data.get("forecastEnabled") and x_axis_label:
        try:
            periods = int(form_data.get("forecastPeriods", 0))
        except (TypeError, ValueError):
            periods = 0
        try:
            confidence_interval = float(form_data.get("forecastInterval", 0))
        except (TypeError, ValueError):
            confidence_interval = 0.0

        return {
            "operation": "prophet",
            "options": {
                "time_grain": form_data.get("time_grain_sqla"),
                "periods": periods,
                "confidence_interval": confidence_interval,
                "yearly_seasonality": form_data.get("forecastSeasonalityYearly"),
                "weekly_seasonality": form_data.get("forecastSeasonalityWeekly"),
                "daily_seasonality": form_data.get("forecastSeasonalityDaily"),
                "index": x_axis_label,
            },
        }
    return None


def rank_operator(
    form_data: dict[str, Any], query_object: dict[str, Any], options: dict[str, Any]
) -> dict[str, Any]:
    """
    Returns a post-processing configuration for ranking.

    Args:
        form_data (dict): The form data for the query.
        query_object (dict): The base query object.
        options (dict): Options for the rank operator.

    Returns:
        dict: A configuration dict with the ranking operation.
    """
    options_dict = options
    if options_dict.get("group_by") is None:
        options_dict.pop("group_by", None)
    return {
        "operation": "rank",
        "options": options_dict,
    }


def drop_none_values(options: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in options.items() if v is not None}


def histogram_operator(
    form_data: dict[str, str | Any], query_object: dict[str, Any]
) -> dict[str, Any]:
    """
    Build a histogram operator configuration.

    This function extracts histogram parameters from the form data and builds an
    operator configuration for generating a histogram. It attempts to parse the
    'bins' value as an integer (defaulting to 5 if parsing fails), retrieves the
    column and groupby details by using get_column_label, and collects additional
    options such as cumulative and normalize flags.

    Args:
        form_data (dict): Dictionary containing histogram parameters
        such as 'bins', 'column','cumulative', 'groupby', and 'normalize'.
        query_object (dict): Dictionary representing the query object

    Returns:
        dict: A dictionary with keys "operation" and "options"
          that defines the histogram operator.
    """
    bins: Any | int = form_data.get("bins")
    column = form_data.get("column")
    cumulative = form_data.get("cumulative")
    groupby = form_data.get("groupby", [])
    normalize = form_data.get("normalize")
    try:
        parsed_bins = int(bins)
    except (TypeError, ValueError):
        parsed_bins = 5
    parsed_column = get_column_label(column)
    parsed_groupby = [get_column_label(g) for g in groupby]

    options = {
        "column": parsed_column,
        "groupby": parsed_groupby,
        "bins": parsed_bins,
        "cumulative": cumulative,
        "normalize": normalize,
    }

    result = {"operation": "histogram", "options": drop_none_values(options)}

    return result


def retain_form_data_suffix(
    form_data: dict[str, Any], control_suffix: str
) -> dict[str, Any]:
    """
    Retain keys from the form data that end with a specified suffix
      and remove the suffix from them.

    The function creates a new form data dictionary. For keys ending
      with the provided
    control_suffix, it removes the suffix and assigns the corresponding
      value. If a key does
    not end with the suffix and is not already set in the new dictionary
    (i.e. via a suffixed key), it is retained as-is.

    Args:
        form_data (dict): The original form data dictionary.
        control_suffix (str): The suffix string to look for in keys.

    Returns:
        dict: A new dictionary containing the retained and modified keys.
    """
    new_form_data = {}
    entries = sorted(
        form_data.items(),
        key=lambda kv: 1 if kv[0].endswith(control_suffix) else 0,
        reverse=True,
    )
    for key, value in entries:
        if key.endswith(control_suffix):
            new_form_data[key[: -len(control_suffix)]] = value
        if not key.endswith(control_suffix) and key not in new_form_data.keys():
            new_form_data[key] = value
    return new_form_data


def remove_form_data_suffix(
    form_data: dict[str, Any], control_suffix: str
) -> dict[str, Any]:
    """
    Remove keys from the form data that end with a specified suffix.

    This function builds a new dictionary containing only those key-value pairs
    where the key does NOT end with the given control_suffix.

    Args:
        form_data (dict): The original form data dictionary.
        control_suffix (str): The suffix indicating which keys should be removed.

    Returns:
        dict: A new dictionary with the keys ending with control_suffix removed.
    """
    new_form_data = {}
    for key, value in form_data.items():
        if not key.endswith(control_suffix):
            new_form_data[key] = value
    return new_form_data
