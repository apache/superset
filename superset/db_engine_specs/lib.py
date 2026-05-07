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
            "limit_method": spec.limit_method.value,
            "limit_clause": getattr(spec, "allow_limit_clause", True),
            "joins": spec.allows_joins,
            "subqueries": spec.allows_subqueries,
            "alias_in_select": spec.allows_alias_in_select,
            "alias_in_orderby": spec.allows_alias_in_orderby,
            "time_groupby_inline": spec.time_groupby_inline,
            "alias_to_source_column": not spec.allows_alias_to_source_column,
            "order_by_not_in_select": spec.allows_hidden_orderby_agg,
            "expressions_in_orderby": spec.allows_hidden_cc_in_orderby,
            "cte_in_subquery": spec.allows_cte_in_subquery,
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
                or has_custom_method(spec, "impersonate_user")
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


def format_markdown_table(headers: list[str], rows: list[list[Any]]) -> str:
    """
    Format headers and rows into a markdown table.
    """
    lines = []
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row in rows:
        lines.append("| " + " | ".join(str(col) for col in row) + " |")
    return "\n".join(lines)


def generate_focused_table(
    info: dict[str, dict[str, Any]],
    feature_keys: list[str],
    column_labels: list[str],
    filter_fn: Any = None,
    value_extractor: Any = None,
    preserve_order: bool = False,
) -> tuple[str, list[str]]:
    """
    Generate a focused markdown table with databases as rows.

    Args:
        info: Dictionary mapping database names to their feature info
        feature_keys: List of feature keys to extract from db_info
        column_labels: List of column header labels
        filter_fn: Optional function to filter databases (receives db_info dict)
        value_extractor: Optional function to extract value (receives db_info, key)

    Returns:
        Tuple of (markdown table string, list of excluded database names)
    """
    # Filter databases if filter function provided
    filtered_info = {}
    excluded_dbs = []

    for db_name, db_info in info.items():
        if filter_fn is None or filter_fn(db_info):
            filtered_info[db_name] = db_info
        else:
            excluded_dbs.append(db_name)

    if not filtered_info:
        return "", excluded_dbs

    # Build headers: Database + feature columns
    headers = ["Database"] + column_labels

    # Build rows
    rows = []
    # Sort by database name unless preserve_order is True
    db_names = (
        list(filtered_info.keys()) if preserve_order else sorted(filtered_info.keys())
    )

    for db_name in db_names:
        db_info = filtered_info[db_name]
        row = [db_name]

        for key in feature_keys:
            if value_extractor:
                value = value_extractor(db_info, key)
            else:
                value = db_info.get(key, "")
            row.append(value)

        rows.append(row)

    return format_markdown_table(headers, rows), excluded_dbs


def calculate_support_level(db_info: dict[str, Any], feature_keys: list[str]) -> str:
    """
    Calculate support level for a group of features.

    Returns: "Supported", "Partial", or "Not supported"
    """
    if not feature_keys:
        return "Not supported"

    # Handle time grain features specially
    if all(k.startswith("time_grains.") for k in feature_keys):
        grain_keys = [k.split(".", 1)[1] for k in feature_keys]
        supported = sum(
            1 for grain in grain_keys if db_info["time_grains"].get(grain, False)
        )
    else:
        supported = sum(1 for k in feature_keys if db_info.get(k, False))

    total = len(feature_keys)
    if supported == 0:
        return "Not supported"
    elif supported == total:
        return "Supported"
    else:
        return "Partial"


def generate_feature_tables() -> str:
    """
    Generate multiple focused markdown tables organized by feature categories.

    Returns a complete markdown document with 7 tables optimized for readability.
    """
    info = {}
    for spec in sorted(load_engine_specs(), key=get_name):
        info[get_name(spec)] = diagnose(spec)

    # remove 3rd party DB engine specs
    info = {k: v for k, v in info.items() if v["module"].startswith("superset")}

    # Sort by score descending for overview table
    sorted_info = dict(sorted(info.items(), key=lambda x: x[1]["score"], reverse=True))

    output = []

    # Table 1: Feature Overview
    output.append("### Feature Overview\n")

    # Define feature groups for summary
    sql_basics = [
        "joins",
        "subqueries",
        "alias_in_select",
        "alias_in_orderby",
        "cte_in_subquery",
    ]
    advanced_sql = [
        "time_groupby_inline",
        "alias_to_source_column",
        "order_by_not_in_select",
        "expressions_in_orderby",
    ]
    common_grains = [
        f"time_grains.{g}"
        for g in ["SECOND", "MINUTE", "HOUR", "DAY", "WEEK", "MONTH", "QUARTER", "YEAR"]
    ]
    extended_grains = [
        f"time_grains.{g}"
        for g in [
            "FIVE_SECONDS",
            "THIRTY_SECONDS",
            "FIVE_MINUTES",
            "TEN_MINUTES",
            "FIFTEEN_MINUTES",
            "THIRTY_MINUTES",
            "HALF_HOUR",
            "SIX_HOURS",
            "WEEK_STARTING_SUNDAY",
            "WEEK_STARTING_MONDAY",
            "WEEK_ENDING_SATURDAY",
            "WEEK_ENDING_SUNDAY",
            "QUARTER_YEAR",
        ]
    ]
    integrations = [
        "ssh_tunneling",
        "query_cancelation",
        "get_metrics",
        "get_extra_table_metadata",
        "dbapi_exception_mapping",
        "custom_errors",
        "dynamic_schema",
        "where_latest_partition",
    ]
    advanced_features = [
        "user_impersonation",
        "expand_data",
        "query_cost_estimation",
        "sql_validation",
    ]

    headers = [
        "Database",
        "Score",
        "SQL Basics",
        "Advanced SQL",
        "Common Time Grains",
        "Extended Time Grains",
        "Integrations",
        "Advanced Features",
    ]
    rows = []
    for db_name, db_info in sorted_info.items():
        row = [
            db_name,
            db_info["score"],
            calculate_support_level(db_info, sql_basics),
            calculate_support_level(db_info, advanced_sql),
            calculate_support_level(db_info, common_grains),
            calculate_support_level(db_info, extended_grains),
            calculate_support_level(db_info, integrations),
            calculate_support_level(db_info, advanced_features),
        ]
        rows.append(row)
    output.append(format_markdown_table(headers, rows))

    # Table 2: Database Information
    output.append("\n### Database Information\n")

    # Custom value extractor for database info to handle limit_method enum
    def extract_db_info(db_info: dict[str, Any], key: str) -> str:
        if key == "limit_method":
            # Convert enum value to name
            from superset.sql.parse import LimitMethod

            return LimitMethod(db_info[key]).name
        return db_info.get(key, "")

    table, _ = generate_focused_table(
        info,
        feature_keys=["module", "limit_method", "limit_clause", "max_column_name"],
        column_labels=["Module", "Limit Method", "Limit Clause", "Max Column Name"],
        value_extractor=extract_db_info,
    )
    output.append(table)

    # Table 3: SQL Capabilities (combined SQL Capabilities + Advanced SQL)
    output.append("\n### SQL Capabilities\n")
    table, _ = generate_focused_table(
        info,
        feature_keys=[
            "joins",
            "subqueries",
            "alias_in_select",
            "alias_in_orderby",
            "cte_in_subquery",
            "sql_comments",
            "escaped_colons",
            "time_groupby_inline",
            "alias_to_source_column",
            "order_by_not_in_select",
            "expressions_in_orderby",
        ],
        column_labels=[
            "JOINs",
            "Subqueries",
            "Aliases in SELECT",
            "Aliases in ORDER BY",
            "CTEs",
            "Comments",
            "Escaped Colons",
            "Inline Time Groupby",
            "Source Column When Aliased",
            "Aggregations in ORDER BY",
            "Expressions in ORDER BY",
        ],
    )
    output.append(table)

    # Helper to extract time grain values
    def extract_time_grain(db_info: dict[str, Any], grain_name: str) -> str:
        return db_info["time_grains"].get(grain_name, False)

    # Table 4: Time Grains – Common
    output.append("\n### Time Grains – Common\n")
    common_grains = [
        "SECOND",
        "MINUTE",
        "HOUR",
        "DAY",
        "WEEK",
        "MONTH",
        "QUARTER",
        "YEAR",
    ]
    table, _ = generate_focused_table(
        info,
        feature_keys=common_grains,
        column_labels=common_grains,
        value_extractor=extract_time_grain,
    )
    output.append(table)

    # Table 5: Time Grains – Extended
    output.append("\n### Time Grains – Extended\n")
    extended_grains = [
        "FIVE_SECONDS",
        "THIRTY_SECONDS",
        "FIVE_MINUTES",
        "TEN_MINUTES",
        "FIFTEEN_MINUTES",
        "THIRTY_MINUTES",
        "HALF_HOUR",
        "SIX_HOURS",
        "WEEK_STARTING_SUNDAY",
        "WEEK_STARTING_MONDAY",
        "WEEK_ENDING_SATURDAY",
        "WEEK_ENDING_SUNDAY",
        "QUARTER_YEAR",
    ]
    table, _ = generate_focused_table(
        info,
        feature_keys=extended_grains,
        column_labels=extended_grains,
        value_extractor=extract_time_grain,
    )
    output.append(table)

    # Table 6: Core Platform & Metadata Features
    output.append("\n### Core Platform & Metadata Features\n")
    output.append("\nIntegration with platform features and metadata handling.\n")
    table, _ = generate_focused_table(
        info,
        feature_keys=[
            "masked_encrypted_extra",
            "column_type_mapping",
            "function_names",
            "file_upload",
            "dynamic_schema",
            "catalog",
            "dynamic_catalog",
            "ssh_tunneling",
            "where_latest_partition",
            "query_cancelation",
            "get_metrics",
            "get_extra_table_metadata",
            "dbapi_exception_mapping",
            "custom_errors",
        ],
        column_labels=[
            "Masked Encrypted Extra",
            "Column Type Mappings",
            "Function Names",
            "File Upload",
            "Dynamic Schema",
            "Catalog",
            "Dynamic Catalog",
            "SSH Tunneling",
            "Latest Partition",
            "Query Cancellation",
            "Get Metrics",
            "Extra Table Metadata",
            "Exception Mapping",
            "Custom Errors",
        ],
    )
    output.append(table)

    # Table 7: Operational & Advanced Features
    output.append("\n### Operational & Advanced Features\n")
    table, _ = generate_focused_table(
        info,
        feature_keys=[
            "user_impersonation",
            "expand_data",
            "query_cost_estimation",
            "sql_validation",
        ],
        column_labels=[
            "User Impersonation",
            "Expand Data",
            "Cost Estimation",
            "SQL Validation",
        ],
    )
    output.append(table)

    return "\n".join(output)


def generate_table() -> list[list[Any]]:
    """
    Generate a table showing info for all DB engine specs.

    DEPRECATED: This function is kept for backward compatibility.
    Use generate_feature_tables() instead for better readability.
    """
    info = {}
    for spec in sorted(load_engine_specs(), key=get_name):
        info[get_name(spec)] = diagnose(spec)

    # remove 3rd party DB engine specs
    info = {k: v for k, v in info.items() if v["module"].startswith("superset")}

    rows = []  # pylint: disable=redefined-outer-name
    rows.append(["Feature"] + list(info))  # header row
    rows.append(["Module"] + [db_info["module"] for db_info in info.values()])

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
            [DATABASE_DETAILS[key]] + [db_info[key] for db_info in info.values()]
        )

    # basic
    for time_grain in TimeGrain:
        rows.append(
            [f"Has time grain {time_grain.name}"]
            + [db_info["time_grains"][time_grain.name] for db_info in info.values()]
        )
    keys = [
        "masked_encrypted_extra",
        "column_type_mapping",
        "function_names",
    ]
    for key in keys:
        rows.append([BASIC_FEATURES[key]] + [db_info[key] for db_info in info.values()])

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
            [NICE_TO_HAVE_FEATURES[key]] + [db_info[key] for db_info in info.values()]
        )

    # advanced
    keys = [
        "expand_data",
        "query_cost_estimation",
        "sql_validation",
    ]
    for key in keys:
        rows.append(
            [ADVANCED_FEATURES[key]] + [db_info[key] for db_info in info.values()]
        )

    rows.append(["Score"] + [db_info["score"] for db_info in info.values()])

    return rows


if __name__ == "__main__":
    from superset.app import create_app

    app = create_app()
    with app.app_context():
        output = generate_feature_tables()

    print(output)
