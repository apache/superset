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
"""Bounded, explicit checks of partition transforms against stored row pairs."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

import pandas as pd
from flask_babel import gettext as _

from superset.common.query_context_factory import QueryContextFactory
from superset.connectors.sqla.partition_mapping import (
    _declined_for_reading_by_type,
    _native_generic_type,
    _to_python_scalar,
    evaluate_transform,
    has_active_advanced_data_type,
    stored_expression_error,
    validate_partition_mapping,
)
from superset.utils.core import GenericDataType, QueryStatus, remove_duplicates

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable


def validate_partition_data(
    datasource: SqlaTable,
    *,
    mapped_column: str,
    partition_column: str | None,
    value_transform: str | None,
    partition_values: list[str],
) -> dict[str, Any]:
    """Compare fresh transform outputs with keys from the same authorized rows.

    Partition keys are supplied independently of the transform. Filtering by
    its output could exclude precisely the rows that demonstrate a mismatch.
    Sampling is diagnostic, never a persistent or universal mirror verdict.
    """
    result: dict[str, Any] = {
        "status": "inconclusive",
        "checked_rows": 0,
        "skipped_rows": 0,
        "mismatch_count": 0,
        "partitions_checked": 0,
        "partitions_requested": len(set(partition_values)),
        "examples": [],
    }
    target_name = partition_column or datasource.partition_column
    columns = {col.column_name: col for col in datasource.columns}
    source = columns.get(mapped_column)
    target = columns.get(target_name)
    if (
        datasource.sql
        or source is None
        or target is None
        or source.expression
        or target.expression
        or has_active_advanced_data_type(source)
        or _native_generic_type(target) != GenericDataType.NUMERIC
    ):
        result["message"] = _(
            "Data validation requires physical columns and a numeric partition key."
        )
        return result
    issues = validate_partition_mapping(
        column_names=set(columns),
        partition_column=target_name,
        partition_mapped_column=mapped_column,
        main_dttm_col=datasource.main_dttm_col,
        transform=value_transform,
        engine=datasource.database.backend,
    )
    if issues or not value_transform:
        result["message"] = _("Correct the mapping expression before validating data.")
        return result
    if error := stored_expression_error(
        datasource.database, datasource.catalog, datasource.schema, value_transform
    ):
        result["message"] = str(error)
        return result

    keys = remove_duplicates(int(value) for value in partition_values)
    result["partitions_requested"] = len(keys)
    context = QueryContextFactory().create(
        datasource={"type": datasource.type, "id": datasource.id},
        queries=[
            {
                "columns": [mapped_column, target_name],
                "metrics": [],
                "filters": [{"col": target_name, "op": "==", "val": key}],
                "row_limit": 50,
                "time_range": "No filter",
                "orderby": [],
            }
            for key in keys
        ],
        force=True,
    )
    # Editorship alone does not authorize reading the underlying data.
    context.raise_for_access()
    failed = False
    for query in context.queries:
        try:
            # The raw datasource result retains exact integers and stored
            # timestamps, before display offsets/JSON datetime normalization.
            # Query assembly retains RLS; no chart cache or COUNT(*) is used.
            sample = datasource.query(query.to_dict())
            if sample.status != QueryStatus.SUCCESS:
                failed = True
                continue
            pairs = [
                (_to_python_scalar(value), _to_python_scalar(key))
                for value, key in sample.df[[mapped_column, target_name]]
                .head(50)
                .itertuples(index=False, name=None)
            ]
            if _check_row_pairs(datasource, value_transform, pairs, result):
                result["partitions_checked"] += 1
            else:
                failed = True
        except Exception:  # pylint: disable=broad-except
            # Never turn an engine failure or incomplete sample into success.
            failed = True
    if result["mismatch_count"]:
        result["status"] = "mismatch"
        result["message"] = _("The transform does not match the stored partition keys.")
    elif not failed and result["partitions_checked"] == len(keys):
        result["status"] = "matched"
        result["message"] = _(
            "The transform matched the sampled rows, not the entire dataset."
        )
    else:
        result["message"] = _(
            "Some partitions had no checkable rows, or the query or transform failed."
        )
    return result


def _check_row_pairs(
    datasource: SqlaTable,
    transform: str,
    pairs: list[tuple[Any, Any]],
    result: dict[str, Any],
) -> bool:
    """Record mismatches and return whether this partition had checkable rows."""
    checkable = []
    for value, key in pairs:
        if pd.isna(value) or pd.isna(key):
            result["skipped_rows"] += 1
        else:
            checkable.append((value, key))
    if not checkable:
        return False
    inputs = [value for value, _key in checkable]
    text_answers: list[tuple[int, Any]] = []
    answers = evaluate_transform(
        datasource.database,
        datasource.catalog,
        datasource.schema,
        transform,
        inputs,
        text_answers=text_answers,
        fresh=True,
    )
    if answers is None or _declined_for_reading_by_type(
        inputs, answers, text_answers, []
    ):
        return False
    for (value, key), answer in zip(checkable, answers, strict=True):
        result["checked_rows"] += 1
        if answer != key:
            result["mismatch_count"] += 1
            if len(result["examples"]) < 5:
                result["examples"].append(
                    {
                        "source_value": str(value),
                        "stored_key": str(key),
                        "transformed_value": None if answer is None else str(answer),
                    }
                )
    return True
