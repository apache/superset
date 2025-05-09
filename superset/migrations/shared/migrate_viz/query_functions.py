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
from typing import Any, Dict, List, Optional, Union
from enum import Enum


class ComparisonType(Enum):
    VALUES = "values"
    DIFFERENCE = "difference"
    PERCENTAGE = "percentage"
    RATIO = "ratio"


TIME_COMPARISON_SEPARATOR = "__"


def ensure_is_array(value: Optional[Union[List[Any], Any]] = None) -> List[Any]:
    """
    Ensure a nullable value input is a list. Useful when consolidating
    input format from a select control.
    """
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def is_saved_metric(metric: any) -> bool:
    return isinstance(metric, str)


def is_adhoc_metric_simple(metric: any) -> bool:
    return (
        not isinstance(metric, str)
        and isinstance(metric, dict)
        and metric.get("expressionType") == "SIMPLE"
    )


def is_adhoc_metric_sql(metric: any) -> bool:
    return (
        not isinstance(metric, str)
        and isinstance(metric, dict)
        and metric.get("expressionType") == "SQL"
    )


def is_query_form_metric(metric: any) -> bool:
    return (
        is_saved_metric(metric)
        or is_adhoc_metric_simple(metric)
        or is_adhoc_metric_sql(metric)
    )


def get_metric_label(metric: dict) -> str:
    """
    Get the label for a given metric.

    Args:
        metric (dict): The metric object.

    Returns:
        str: The label of the metric.
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
    form_data: Dict[str, List[str]], query_object: Dict[str, List[str]]
) -> Dict[str, str]:
    """
    Return a dictionary mapping metric offset-labels to metric-labels.

    Args:
        form_data (Dict[str, List[str]]): The form data containing time comparisons.
        query_object (Dict[str, List[str]]): The query object containing metrics.

    Returns:
        Dict[str, str]: A dictionary with offset-labels as keys and metric-labels as values.
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


def is_time_comparison(form_data: dict, query_object: dict) -> bool:
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

    return comparison_type in ComparisonType.values() and len(metric_offset_map) > 0
