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

from __future__ import annotations

from typing import Any

from superset.constants import TimeGrain
from superset.db_engine_specs import load_engine_specs
from superset.db_engine_specs.base import BaseEngineSpec

LIMIT_METHODS = {
    "FORCE_LIMIT": (
        "modifies the query, replacing an existing LIMIT or adding a new one"
    ),  # E: line too long (89 > 79 characters)
    "WRAP_SQL": "wraps the original query in a SELECT * with a LIMIT",
    "FETCH_MANY": (
        "runs the query unmodified but fetchs only LIMIT rows from the cursor"
    ),  # E: line too long (89 > 79 characters)
}

DATABASE_DETAILS = {
    "limit_method": "Method used to limit the rows in the subquery",
    "joins": "Supports JOINs",
    "subqueries": "Supports subqueries",
    "alias_in_select": "Allows aliases in the SELECT statement",
    "alias_in_orderby": "Allows referencing aliases in the ORDER BY statement",
    "time_groupby_inline": (
        "Allows omitting time filters from inline GROUP BYs"
    ),  # E: line too long (80 > 79 characters)
    "alias_to_source_column": (
        "Able to use source column when an alias overshadows it"
    ),  # E: line too long (87 > 79 characters)
    "order_by_not_in_select": (
        "Allows aggregations in ORDER BY not present in the SELECT"
    ),  # E: line too long (90 > 79 characters)
    "expressions_in_orderby": "Allows expressions in ORDER BY",
    "cte_in_subquery": "Allows CTE as a subquery",
    "limit_clause": "Allows LIMIT clause (instead of TOP)",
    "max_column_name": "Maximum column name",
    "sql_comments": "Allows comments",
    "escaped_colons": "Colons must be escaped",
}
BASIC_FEATURES = {
    "masked_encrypted_extra": "Masks/unmasks encrypted_extra",
    "column_type_mapping": "Has column type mappings",
    "function_names": "Returns a list of function names",
}
NICE_TO_HAVE_FEATURES = {
    "user_impersonation": "Supports user impersonation",
    "file_upload": "Support file upload",
    "get_extra_table_metadata": "Returns extra table metadata",
    "dbapi_exception_mapping": "Maps driver exceptions to Superset exceptions",
    "custom_errors": "Parses error messages and returns Superset errors",
    "dynamic_schema": "Supports changing the schema per-query",
    "catalog": "Supports catalogs",
    "dynamic_catalog": "Supports changing the catalog per-query",
    "ssh_tunneling": "Can be connected thru an SSH tunnel",
    "query_cancelation": "Allows query to be canceled",
    "get_metrics": "Returns additional metrics on dataset creation",
    "where_latest_partition": "Supports querying the latest partition only",
}
ADVANCED_FEATURES = {
    "expand_data": "Expands complex types (arrays, structs) into rows/columns",
    "query_cost_estimation": "Supports query cost estimation",
    "sql_validation": "Supports validating SQL before running query",
}


def has_custom_method(spec: type[BaseEngineSpec], method: str) -> bool:
    """
    Check if a class has a custom implementation of a method.

    Since some classes don't inherit directly from ``BaseEngineSpec`` we need
    to check the attributes of the spec and the base class.
    """
    return bool(
        getattr(spec, method, False)
        and getattr(BaseEngineSpec, method, False)
        and getattr(spec, method).__qualname__
        != getattr(BaseEngineSpec, method).__qualname__
    )


def diagnose(spec: type[BaseEngineSpec]) -> dict[str, Any]:
    """
    Run basic diagnostics on a given DB engine spec.
    """
    # pylint: disable=import-outside-toplevel
    from superset.sql_validators.postgres import PostgreSQLValidator
    from superset.sql_validators.presto_db import PrestoDBSQLValidator

    sql_validators = {
        "presto": PrestoDBSQLValidator,
        "postgresql": PostgreSQLValidator,
    }

    output: dict[str, Any] = {}

    output["time_grains"] = {}
    supported_time_grains = spec.get_time_grain_expressions()
    for time_grain in TimeGrain:
        output["time_grains"][time_grain.name] = time_grain in supported_time_grains

    output.update(
        {
            "module": spec.__module__,
            "limit_method": spec.limit_method.upper(),
            "joins": spec.allows_joins,
            "subqueries": spec.allows_subqueries,
            "alias_in_select": spec.allows_alias_in_select,
            "alias_in_orderby": spec.allows_alias_in_orderby,
            "time_groupby_inline": spec.time_groupby_inline,
            "alias_to_source_column": not spec.allows_alias_to_source_column,
            "order_by_not_in_select": spec.allows_hidden_orderby_agg,
            "expressions_in_orderby": spec.allows_hidden_cc_in_orderby,
            "cte_in_subquery": spec.allows_cte_in_subquery,
            "limit_clause": spec.allow_limit_clause,
            "max_column_name": spec.max_column_name_length,
            "sql_comments": spec.allows_sql_comments,
            "escaped_colons": spec.allows_escaped_colons,
            "masked_encrypted_extra": has_custom_method(spec, "mask_encrypted_extra"),
            "column_type_mapping": bool(spec.column_type_mappings),
            "function_names": has_custom_method(spec, "get_function_names"),
            # there are multiple ways of implementing user impersonation
            "user_impersonation": (
                has_custom_method(spec, "update_impersonation_config")
                or has_custom_method(spec, "get_url_for_impersonation")
            ),
            "file_upload": spec.supports_file_upload,
            "get_extra_table_metadata": has_custom_method(
                spec, "get_extra_table_metadata"
            ),
            "dbapi_exception_mapping": has_custom_method(
                spec, "get_dbapi_exception_mapping"
            ),
            "custom_errors": (
                has_custom_method(spec, "extract_errors")
                or has_custom_method(spec, "custom_errors")
            ),
            "dynamic_schema": spec.supports_dynamic_schema,
            "catalog": spec.supports_catalog,
            "dynamic_catalog": spec.supports_dynamic_catalog,
            "ssh_tunneling": not spec.disable_ssh_tunneling,
            "query_cancelation": (
                has_custom_method(spec, "cancel_query") or spec.has_implicit_cancel()
            ),
            "get_metrics": has_custom_method(spec, "get_metrics"),
            "where_latest_partition": has_custom_method(spec, "where_latest_partition"),
            "expand_data": has_custom_method(spec, "expand_data"),
            "query_cost_estimation": has_custom_method(spec, "estimate_query_cost")
            or has_custom_method(spec, "estimate_statement_cost"),
            # SQL validation is implemented in external classes
            "sql_validation": spec.engine in sql_validators,
        },
    )

    # compute score
    score = 0

    # each time grain is 1 point
    score += sum(output["time_grains"][time_grain.name] for time_grain in TimeGrain)

    basic = ["masked_encrypted_extra", "column_type_mapping", "function_names"]
    nice_to_have = [
        "user_impersonation",
        "file_upload",
        "get_extra_table_metadata",
        "dbapi_exception_mapping",
        "custom_errors",
        "dynamic_schema",
        "catalog",
        "dynamic_catalog",
        "ssh_tunneling",
        "query_cancelation",
        "get_metrics",
        "where_latest_partition",
    ]
    advanced = ["expand_data", "query_cost_estimation", "sql_validation"]
    score += sum(10 * int(output[key]) for key in basic)
    score += sum(10 * int(output[key]) for key in nice_to_have)
    score += sum(10 * int(output[key]) for key in advanced)
    output["score"] = score
    output["max_score"] = (
        len(TimeGrain) + 10 * len(basic) + 10 * len(nice_to_have) + 10 * len(advanced)
    )

    return output


def get_name(spec: type[BaseEngineSpec]) -> str:
    """
    Return a name for a given DB engine spec.
    """
    return spec.engine_name or spec.engine


def generate_table() -> list[list[Any]]:
    """
    Generate a table showing info for all DB engine specs.
    """
    info = {}
    for spec in sorted(load_engine_specs(), key=get_name):
        info[get_name(spec)] = diagnose(spec)

    # remove 3rd party DB engine specs
    info = {k: v for k, v in info.items() if v["module"].startswith("superset")}

    rows = []  # pylint: disable=redefined-outer-name
    rows.append(["Feature"] + list(info))  # header row
    rows.append(["Module"] + list(db_info["module"] for db_info in info.values()))

    # descriptive
    keys = [
        "limit_method",
        "joins",
        "subqueries",
        "alias_in_select",
        "alias_in_orderby",
        "time_groupby_inline",
        "alias_to_source_column",
        "order_by_not_in_select",
        "expressions_in_orderby",
        "cte_in_subquery",
        "limit_clause",
        "max_column_name",
        "sql_comments",
        "escaped_colons",
    ]
    for key in keys:
        rows.append(
            [DATABASE_DETAILS[key]] + list(db_info[key] for db_info in info.values())
        )

    # basic
    for time_grain in TimeGrain:
        rows.append(
            [f"Has time grain {time_grain.name}"]
            + list(db_info["time_grains"][time_grain.name] for db_info in info.values())
        )
    keys = [
        "masked_encrypted_extra",
        "column_type_mapping",
        "function_names",
    ]
    for key in keys:
        rows.append(
            [BASIC_FEATURES[key]] + list(db_info[key] for db_info in info.values())
        )

    # nice to have
    keys = [
        "user_impersonation",
        "file_upload",
        "get_extra_table_metadata",
        "dbapi_exception_mapping",
        "custom_errors",
        "dynamic_schema",
        "catalog",
        "dynamic_catalog",
        "ssh_tunneling",
        "query_cancelation",
        "get_metrics",
        "where_latest_partition",
    ]
    for key in keys:
        rows.append(
            [NICE_TO_HAVE_FEATURES[key]]
            + list(db_info[key] for db_info in info.values())
        )

    # advanced
    keys = [
        "expand_data",
        "query_cost_estimation",
        "sql_validation",
    ]
    for key in keys:
        rows.append(
            [ADVANCED_FEATURES[key]] + list(db_info[key] for db_info in info.values())
        )

    rows.append(["Score"] + list(db_info["score"] for db_info in info.values()))

    return rows


if __name__ == "__main__":
    from superset.app import create_app

    app = create_app()
    with app.app_context():
        rows = generate_table()

    headers = rows.pop(0)
    print("| " + " | ".join(headers) + " |")
    print("| " + " ---| " * len(headers))
    for row in rows:
        print("| " + " | ".join(str(col) for col in row) + " |")
