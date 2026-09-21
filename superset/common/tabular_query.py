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

"""Name-based tabular querying for any Explorable datasource.

Shared by the REST query endpoint and the MCP query tools so the resolve →
validate → build → execute sequence exists once. The REST endpoint owns this
contract; other surfaces adapt to it.

Type dispatch is deliberately absent: ``Explorable.get_query_result`` already
routes datasets to SQL execution and semantic views to the semantic-layer
mapper, so callers pass the datasource type as data and never branch on it.
"""

from __future__ import annotations

import difflib
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any, TYPE_CHECKING

from superset.charts.data.form_data import set_query_context_form_data
from superset.common.chart_data import ChartDataResultFormat
from superset.common.utils.time_range_utils import get_since_until_from_time_range
from superset.daos.datasource import DatasourceDAO
from superset.superset_typing import Column, Metric
from superset.utils.core import DatasourceType, FilterOperator

if TYPE_CHECKING:
    from superset.explorables.base import Explorable


# (column name, descending) — mirrors SemanticQuery's OrderTuple, which pairs a
# metric/dimension with an OrderDirection.
OrderSpec = tuple[str, bool]


class TabularQueryValidationError(ValueError):
    """Raised when a request cannot be satisfied by the target datasource."""


@dataclass
class ResolvedExplorable:
    """A datasource resolved and authorized, with its queryable name sets."""

    explorable: Explorable
    display_name: str
    time_column: str | None
    valid_dimensions: set[str]
    valid_metrics: set[str]
    dttm_columns: set[str] = field(default_factory=set)

    def resolve_grain_column(
        self, time_column: str | None, dimensions: Sequence[Column] | None
    ) -> str | None:
        """Pick the column a requested time grain should bucket.

        Precedence: an explicit ``time_column``, else a temporal name already
        listed in ``dimensions`` (the natural way to ask for buckets), else the
        column a ``time_range`` resolved to.
        """
        if time_column:
            return time_column
        for dimension in dimensions or []:
            if isinstance(dimension, str) and dimension in self.dttm_columns:
                return dimension
        return self.time_column


def validate_names(
    requested: Sequence[str],
    valid: set[str],
    kind: str,
    *,
    empty_hint: str | None = None,
    list_valid_on_miss: bool = False,
    full_list_hint: str = "call get_dataset_info for the full list",
) -> list[str]:
    """Return error messages for names not found in *valid*.

    Includes close-match suggestions when available. When *valid* is empty,
    appends *empty_hint* instead of a useless fuzzy match. When no close
    match exists and *list_valid_on_miss* is set, lists the valid names so
    the caller does not have to guess again; *full_list_hint* names the tool
    to call when the valid list is truncated.
    """
    errors: list[str] = []
    for name in requested:
        if name not in valid:
            msg = f"Unknown {kind}: '{name}'"
            if not valid:
                if empty_hint:
                    msg += f". {empty_hint}"
            else:
                suggestions = difflib.get_close_matches(name, valid, n=3, cutoff=0.6)
                if suggestions:
                    msg += f". Did you mean: {', '.join(suggestions)}?"
                elif list_valid_on_miss:
                    shown = sorted(valid)[:10]
                    more = len(valid) - len(shown)
                    suffix = f" (and {more} more; {full_list_hint})" if more > 0 else ""
                    msg += f". Valid {kind}s: {', '.join(shown)}{suffix}"
            errors.append(msg)
    return errors


def _display_name(explorable: Explorable) -> str:
    """Best available human label; ``Explorable`` does not mandate one."""
    for attr in ("table_name", "name"):
        if value := getattr(explorable, attr, None):
            return str(value)
    return f"{explorable.type} {explorable.id}"


def _resolve_time_column(
    explorable: Explorable,
    display_name: str,
    time_column: str | None,
    has_time_range: bool,
) -> str | None:
    """Resolve and validate the temporal column a time range applies to.

    Datasets carry ``main_dttm_col``; semantic views do not, so a lone datetime
    dimension is inferred. Only inferred when a time range was given — an
    unfiltered query must not acquire a temporal axis it did not ask for.
    """
    valid_columns = {column.column_name for column in explorable.columns}
    dttm_columns = [
        column.column_name for column in explorable.columns if column.is_dttm
    ]

    resolved = time_column
    if resolved is None and has_time_range:
        resolved = getattr(explorable, "main_dttm_col", None)
        if not resolved and len(dttm_columns) > 1:
            # A semantic view's dimensions arrive as an unordered set, so
            # picking one here would vary between processes.
            raise TabularQueryValidationError(
                f"'{display_name}' has multiple datetime dimensions "
                f"({', '.join(sorted(dttm_columns))}). Set time_column to "
                "choose one."
            )
        resolved = resolved or (dttm_columns[0] if dttm_columns else None)
        if not resolved:
            raise TabularQueryValidationError(
                "time_range was provided but no temporal column is configured "
                f"on '{display_name}'. Set time_column explicitly."
            )

    if resolved is not None and resolved not in set(dttm_columns):
        subject = (
            f"time_column '{resolved}'"
            if time_column
            else f"the configured temporal column '{resolved}'"
        )
        if resolved in valid_columns:
            raise TabularQueryValidationError(
                f"{subject} on '{display_name}' is not marked as a datetime column."
            )
        raise TabularQueryValidationError(f"Unknown {subject} on '{display_name}'.")
    return resolved


def resolve_explorable(
    datasource_type: DatasourceType | str,
    datasource_id: int,
    *,
    time_column: str | None = None,
    has_time_range: bool = False,
) -> ResolvedExplorable:
    """Look up a datasource, authorize it, and collect its queryable names.

    Raises ``DatasourceNotFound`` / ``DatasourceTypeNotSupportedError`` from
    the DAO and ``SupersetSecurityException`` from the access check; callers
    map these to their own transport's error shape.
    """
    explorable: Explorable = DatasourceDAO.get_datasource(
        DatasourceType(datasource_type), datasource_id
    )
    explorable.raise_for_access()

    display_name = _display_name(explorable)
    return ResolvedExplorable(
        explorable=explorable,
        display_name=display_name,
        time_column=_resolve_time_column(
            explorable, display_name, time_column, has_time_range
        ),
        valid_dimensions={column.column_name for column in explorable.columns},
        valid_metrics={metric.metric_name for metric in explorable.metrics},
        dttm_columns={
            column.column_name for column in explorable.columns if column.is_dttm
        },
    )


NO_METRICS_HINT = (
    "This datasource has no metrics defined. Query dimensions only, or add a "
    "saved metric to the datasource."
)


def validate_query_names(
    valid_metrics: set[str],
    valid_dimensions: set[str],
    *,
    metrics: Sequence[Metric] | None = None,
    dimensions: Sequence[Column] | None = None,
    filters: Sequence[dict[str, Any]] | None = None,
    order_names: Sequence[str] | None = None,
    metrics_empty_hint: str | None = None,
    metrics_full_list_hint: str | None = None,
) -> list[str]:
    """Validate every name in a request against the datasource's definitions.

    Takes plain name sets rather than a resolved datasource so callers that
    resolve differently — the MCP tools use per-type DAOs — can share it.

    Ad-hoc metrics and columns are dicts rather than names and are skipped
    here: datasets accept them, and semantic views reject them downstream in
    the mapper, which owns that rule.
    """
    errors: list[str] = []
    errors.extend(
        validate_names(
            [name for name in (dimensions or []) if isinstance(name, str)],
            valid_dimensions,
            "dimension",
        )
    )
    errors.extend(
        validate_names(
            [name for name in (metrics or []) if isinstance(name, str)],
            valid_metrics,
            "metric",
            empty_hint=metrics_empty_hint or NO_METRICS_HINT,
            list_valid_on_miss=True,
            # The default names get_dataset_info, which cannot resolve a
            # semantic view; callers serving views must name their own tool.
            **(
                {"full_list_hint": metrics_full_list_hint}
                if metrics_full_list_hint
                else {}
            ),
        )
    )
    errors.extend(
        validate_names(
            [
                clause["col"]
                for clause in (filters or [])
                if isinstance(clause.get("col"), str)
            ],
            valid_dimensions,
            "filter column",
        )
    )
    if order_names:
        errors.extend(
            validate_names(
                order_names,
                valid_dimensions | valid_metrics,
                "order_by",
            )
        )
    return errors


def _time_range_filters(
    time_column: str, time_range: str, rewrite_one_sided: bool
) -> list[dict[str, Any]]:
    """Express *time_range* as query filters.

    Semantic views need a one-sided range rewritten as an explicit comparison:
    ``_apply_granularity`` deletes every filter on the granularity column once a
    ``TEMPORAL_RANGE`` filter is present, and the mapper's ``_get_time_filter``
    emits nothing unless both bounds resolve, so the range would vanish and the
    query would scan the whole view.

    Datasets must keep ``TEMPORAL_RANGE``. ``SqlaTable.get_time_filter`` accepts
    either bound alone and is the only path that applies the dataset's timezone,
    the legacy hour offset and grain-aware truncation, so rewriting would shift
    one-sided results relative to two-sided ones and leave ``from_dttm`` /
    ``to_dttm`` unset for Jinja.
    """
    temporal_range = [
        {
            "col": time_column,
            "op": FilterOperator.TEMPORAL_RANGE.value,
            "val": time_range,
        }
    ]
    if not rewrite_one_sided:
        return temporal_range

    since, until = get_since_until_from_time_range(time_range=time_range)
    if since and until:
        return temporal_range

    bounds = (
        (FilterOperator.GREATER_THAN_OR_EQUALS, since),
        (FilterOperator.LESS_THAN, until),
    )
    return [
        {"col": time_column, "op": operator.value, "val": value.isoformat(sep=" ")}
        for operator, value in bounds
        if value
    ]


def build_query_dict(
    *,
    time_column: str | None = None,
    metrics: Sequence[Metric] | None = None,
    dimensions: Sequence[Column] | None = None,
    filters: Sequence[dict[str, Any]] | None = None,
    time_range: str | None = None,
    time_grain: str | None = None,
    grain_column: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    order: Sequence[OrderSpec] | None = None,
    order_desc: bool = True,
    rewrite_one_sided_time_range: bool = False,
) -> dict[str, Any]:
    """Assemble a QueryObject-shaped dict from a name-based request.

    Parameter names follow ``SemanticQuery`` (``limit``, ``offset``, ``order``)
    rather than ``QueryObject``; the translation to ``row_limit`` /
    ``row_offset`` / ``orderby`` happens here so the request vocabulary stays
    independent of the execution model.
    """
    query_filters: list[dict[str, Any]] = list(filters or [])
    if time_range and time_column:
        query_filters.extend(
            _time_range_filters(time_column, time_range, rewrite_one_sided_time_range)
        )

    query_columns: list[Column] = list(dimensions or [])
    if time_grain and grain_column:
        # A grain only takes effect on a BASE_AXIS adhoc column
        # (`SqlaTable.adhoc_column_to_sqla` gates on it); `extras.time_grain_sqla`
        # alone is read by the semantic-layer mapper but ignored for datasets.
        query_columns = [
            column
            for column in query_columns
            if not (isinstance(column, str) and column == grain_column)
        ]
        query_columns.insert(
            0,
            {
                "label": grain_column,
                "sqlExpression": grain_column,
                # `_normalize_column` rejects adhoc dimensions without this,
                # so semantic views would raise on every time_grain query.
                "isColumnReference": True,
                "columnType": "BASE_AXIS",
                "timeGrain": time_grain,
            },
        )

    query_dict: dict[str, Any] = {
        "filters": query_filters,
        "columns": query_columns,
        "metrics": list(metrics or []),
        "row_limit": limit,
        # Drives series-limit ordering, which has no per-column form. Taken as
        # a parameter rather than derived from ``order``, so an empty ``order``
        # does not silently flip it.
        "order_desc": order_desc,
    }
    if offset:
        query_dict["row_offset"] = offset
    if time_column:
        query_dict["granularity"] = time_column
    if time_grain:
        query_dict["extras"] = {"time_grain_sqla": time_grain}
    if order:
        # QueryObject.orderby is (name, ascending); the wire carries per-column
        # descending flags, so invert each one rather than applying a single
        # direction to every column.
        query_dict["orderby"] = [(name, not descending) for name, descending in order]
    return query_dict


def execute_tabular_query(
    datasource_id: int,
    datasource_type: str,
    query_dict: dict[str, Any],
    *,
    result_format: ChartDataResultFormat = ChartDataResultFormat.JSON,
    use_cache: bool = True,
    force: bool = False,
    cache_timeout: int | None = None,
) -> dict[str, Any]:
    """Execute via the standard pipeline and return the command payload.

    Entering at ``QueryContextFactory`` rather than below it is what keeps
    caching, RLS, post-processing, and event logging intact.
    ``ChartDataCommand.validate`` is the authorization gate.
    """
    # Imported here: both modules pull in the datasource stack, which imports
    # this one during app setup.
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.query_context_factory import QueryContextFactory

    query_context = QueryContextFactory().create(
        datasource={"id": datasource_id, "type": datasource_type},
        queries=[query_dict],
        form_data={},
        result_format=result_format,
        force=force or not use_cache,
        custom_cache_timeout=cache_timeout,
    )
    # Without this, Jinja macros such as {{ current_username() }} cannot see
    # the query context and virtual datasets render differently than they do
    # through the chart data API.
    set_query_context_form_data(query_context, datasource_id, datasource_type)

    command = ChartDataCommand(query_context)
    command.validate()
    return command.run()
