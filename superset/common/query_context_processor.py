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

import logging
import re
from typing import Any, cast, ClassVar, Sequence, TYPE_CHECKING

import pandas as pd
from flask import current_app
from flask_babel import gettext as _

from superset.common.chart_data import ChartDataResultFormat
from superset.common.db_query_status import QueryStatus
from superset.common.query_actions import get_query_results
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.common.utils.time_range_utils import get_since_until_from_time_range
from superset.constants import CACHE_DISABLED_TIMEOUT, CacheRegion
from superset.daos.annotation_layer import AnnotationLayerDAO
from superset.daos.chart import ChartDAO
from superset.exceptions import (
    QueryObjectValidationError,
    SupersetException,
)
from superset.explorables.base import Explorable
from superset.extensions import cache_manager, security_manager
from superset.models.helpers import QueryResult
from superset.superset_typing import AdhocColumn, AdhocMetric
from superset.utils import csv, excel
from superset.utils.cache import generate_cache_key, set_and_log_cache
from superset.utils.core import (
    DatasourceType,
    DTTM_ALIAS,
    error_msg_from_exception,
    GenericDataType,
    get_column_names_from_columns,
    get_column_names_from_metrics,
    is_adhoc_column,
    is_adhoc_metric,
)
from superset.utils.pandas_postprocessing.utils import unescape_separator
from superset.views.utils import get_viz
from superset.viz import viz_types

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject

logger = logging.getLogger(__name__)


class QueryContextProcessor:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    _query_context: QueryContext
    _qc_datasource: Explorable

    def __init__(self, query_context: QueryContext):
        self._query_context = query_context
        self._qc_datasource = query_context.datasource

    cache_type: ClassVar[str] = "df"
    enforce_numerical_metrics: ClassVar[bool] = True

    def get_df_payload(
        self, query_obj: QueryObject, force_cached: bool | None = False
    ) -> dict[str, Any]:
        """Handles caching around the df payload retrieval"""
        if query_obj:
            # Always validate the query object before generating cache key
            # This ensures sanitize_clause() is called and extras are normalized
            query_obj.validate()

        cache_key = self.query_cache_key(query_obj)
        timeout = self.get_cache_timeout()
        force_query = self._query_context.force or timeout == CACHE_DISABLED_TIMEOUT
        cache = QueryCacheManager.get(
            key=cache_key,
            region=CacheRegion.DATA,
            force_query=force_query,
            force_cached=force_cached,
        )

        # If cache is loaded but missing applied_filter_columns and query has filters,
        # treat as cache miss to ensure fresh query with proper applied_filter_columns
        if (
            query_obj
            and cache_key
            and cache.is_loaded
            and not cache.applied_filter_columns
            and query_obj.filter
            and len(query_obj.filter) > 0
        ):
            cache.is_loaded = False

        if query_obj and cache_key and not cache.is_loaded:
            try:
                if invalid_columns := [
                    col
                    for col in get_column_names_from_columns(query_obj.columns)
                    + get_column_names_from_metrics(query_obj.metrics or [])
                    if (
                        col not in self._qc_datasource.column_names
                        and col != DTTM_ALIAS
                    )
                ]:
                    raise QueryObjectValidationError(
                        _(
                            "Columns missing in dataset: %(invalid_columns)s",
                            invalid_columns=invalid_columns,
                        )
                    )

                query_result = self.get_query_result(query_obj)
                annotation_data = self.get_annotation_data(query_obj)
                cache.set_query_result(
                    key=cache_key,
                    query_result=query_result,
                    annotation_data=annotation_data,
                    force_query=force_query,
                    timeout=self.get_cache_timeout(),
                    datasource_uid=self._qc_datasource.uid,
                    region=CacheRegion.DATA,
                )
            except QueryObjectValidationError as ex:
                cache.error_message = str(ex)
                cache.status = QueryStatus.FAILED

        # the N-dimensional DataFrame has converted into flat DataFrame
        # by `flatten operator`, "comma" in the column is escaped by `escape_separator`
        # the result DataFrame columns should be unescaped
        label_map = {
            unescape_separator(col): [
                unescape_separator(col) for col in re.split(r"(?<!\\),\s", col)
            ]
            for col in cache.df.columns.values
        }
        label_map.update(
            {
                column_name: [
                    (
                        str(query_obj.columns[idx])
                        if not is_adhoc_column(query_obj.columns[idx])
                        else cast(AdhocColumn, query_obj.columns[idx])["sqlExpression"]
                    ),
                ]
                for idx, column_name in enumerate(query_obj.column_names)
            }
        )
        label_map.update(
            {
                metric_name: [
                    (
                        str(query_obj.metrics[idx])
                        if not is_adhoc_metric(query_obj.metrics[idx])
                        else (
                            str(
                                cast(AdhocMetric, query_obj.metrics[idx])[
                                    "sqlExpression"
                                ]
                            )
                            if cast(AdhocMetric, query_obj.metrics[idx])[
                                "expressionType"
                            ]
                            == "SQL"
                            else metric_name
                        )
                    ),
                ]
                for idx, metric_name in enumerate(query_obj.metric_names)
                if query_obj and query_obj.metrics
            }
        )
        cache.df.columns = [unescape_separator(col) for col in cache.df.columns.values]

        return {
            "cache_key": cache_key,
            "cached_dttm": cache.cache_dttm,
            "queried_dttm": cache.queried_dttm,
            "cache_timeout": self.get_cache_timeout(),
            "df": cache.df,
            "applied_template_filters": cache.applied_template_filters,
            "applied_filter_columns": cache.applied_filter_columns,
            "rejected_filter_columns": cache.rejected_filter_columns,
            "annotation_data": cache.annotation_data,
            "error": cache.error_message,
            "is_cached": cache.is_cached,
            "query": cache.query,
            "status": cache.status,
            "stacktrace": cache.stacktrace,
            "rowcount": len(cache.df.index),
            "sql_rowcount": cache.sql_rowcount,
            "from_dttm": query_obj.from_dttm,
            "to_dttm": query_obj.to_dttm,
            "label_map": label_map,
        }

    def query_cache_key(self, query_obj: QueryObject, **kwargs: Any) -> str | None:
        """
        Returns a QueryObject cache key for objects in self.queries
        """
        datasource = self._qc_datasource
        extra_cache_keys = datasource.get_extra_cache_keys(query_obj.to_dict())

        cache_key = (
            query_obj.cache_key(
                datasource=datasource.uid,
                extra_cache_keys=extra_cache_keys,
                rls=security_manager.get_rls_cache_key(datasource),
                changed_on=datasource.changed_on,
                **kwargs,
            )
            if query_obj
            else None
        )
        return cache_key

    def get_query_result(self, query_object: QueryObject) -> QueryResult:
        """
        Returns a pandas dataframe based on the query object.

        This method delegates to the datasource's get_query_result method,
        which handles query execution, normalization, time offsets, and
        post-processing.
        """
        return self._qc_datasource.get_query_result(query_object)

    def get_data(
        self, df: pd.DataFrame, coltypes: list[GenericDataType]
    ) -> str | list[dict[str, Any]]:
        if self._query_context.result_format in ChartDataResultFormat.table_like():
            include_index = not isinstance(df.index, pd.RangeIndex)
            columns = list(df.columns)
            verbose_map = self._qc_datasource.data.get("verbose_map", {})
            if verbose_map:
                df.columns = [verbose_map.get(column, column) for column in columns]

            result = None
            if self._query_context.result_format == ChartDataResultFormat.CSV:
                result = csv.df_to_escaped_csv(
                    df, index=include_index, **current_app.config["CSV_EXPORT"]
                )
            elif self._query_context.result_format == ChartDataResultFormat.XLSX:
                excel.apply_column_types(df, coltypes)
                result = excel.df_to_excel(
                    df, index=include_index, **current_app.config["EXCEL_EXPORT"]
                )
            return result or ""

        return df.to_dict(orient="records")

    def _prepare_contribution_totals(self) -> tuple[list[int], int | None]:
        """
        Identify contribution queries and normalize the totals query so cache keys
        align with cached results.
        """
        queries_needing_totals: list[int] = []
        totals_idx: int | None = None

        for i, query in enumerate(self._query_context.queries):
            needs_totals = any(
                pp.get("operation") == "contribution"
                for pp in getattr(query, "post_processing", []) or []
            )

            if needs_totals:
                queries_needing_totals.append(i)

            is_totals_query = (
                not query.columns and query.metrics and not query.post_processing
            )
            if is_totals_query and totals_idx is None:
                totals_idx = i

        if queries_needing_totals and totals_idx is not None:
            totals_query = self._query_context.queries[totals_idx]
            totals_query.row_limit = None

        return queries_needing_totals, totals_idx

    def ensure_totals_available(
        self,
        queries_needing_totals: Sequence[int] | None = None,
        totals_idx: int | None = None,
    ) -> None:
        if queries_needing_totals is None or totals_idx is None:
            queries_needing_totals, totals_idx = self._prepare_contribution_totals()

        if not queries_needing_totals or totals_idx is None:
            return

        totals_query = self._query_context.queries[totals_idx]

        result = self._query_context.get_query_result(totals_query)
        df = result.df

        totals = {
            col: df[col].sum() for col in df.columns if df[col].dtype.kind in "biufc"
        }

        for idx in queries_needing_totals:
            query = self._query_context.queries[idx]
            if hasattr(query, "post_processing") and query.post_processing:
                for pp in query.post_processing:
                    if pp.get("operation") == "contribution":
                        pp["options"]["contribution_totals"] = totals

    def get_payload(
        self,
        cache_query_context: bool | None = False,
        force_cached: bool = False,
    ) -> dict[str, Any]:
        """Returns the query results with both metadata and data"""

        queries_needing_totals, totals_idx = self._prepare_contribution_totals()

        # Skip ensure_totals_available when force_cached=True
        # This prevents recalculating contribution_totals from cached results
        if not force_cached:
            self.ensure_totals_available(queries_needing_totals, totals_idx)

            # Update cache_values to reflect modifications made by
            # ensure_totals_available()
            # This ensures cache keys are generated from the actual query state
            # We merge the original query dict with the updated query dict to preserve
            # any fields that might not be in to_dict() but were in the original request
            self._query_context.cache_values["queries"] = [
                {**cached_query, **query.to_dict()}
                for cached_query, query in zip(
                    self._query_context.cache_values["queries"],
                    self._query_context.queries,
                    strict=True,
                )
            ]

        query_results = [
            get_query_results(
                query_obj.result_type or self._query_context.result_type,
                self._query_context,
                query_obj,
                force_cached,
            )
            for query_obj in self._query_context.queries
        ]

        return_value = {"queries": query_results}

        if cache_query_context:
            cache_key = self.cache_key()
            set_and_log_cache(
                cache_manager.cache,
                cache_key,
                {
                    "data": {
                        # setting form_data into query context cache value as well
                        # so that it can be used to reconstruct form_data field
                        # for query context object when reading from cache
                        "form_data": self._query_context.form_data,
                        **self._query_context.cache_values,
                    },
                },
                self.get_cache_timeout(),
            )
            return_value["cache_key"] = cache_key  # type: ignore

        return return_value

    def get_cache_timeout(self) -> int:
        if cache_timeout_rv := self._query_context.get_cache_timeout():
            return cache_timeout_rv
        if (
            data_cache_timeout := current_app.config["DATA_CACHE_CONFIG"].get(
                "CACHE_DEFAULT_TIMEOUT"
            )
        ) is not None:
            return data_cache_timeout
        return current_app.config["CACHE_DEFAULT_TIMEOUT"]

    def cache_key(self, **extra: Any) -> str:
        """
        The QueryContext cache key is made out of the key/values from
        self.cached_values, plus any other key/values in `extra`. It includes only data
        required to rehydrate a QueryContext object.
        """
        key_prefix = "qc-"
        cache_dict = self._query_context.cache_values.copy()
        cache_dict.update(extra)

        return generate_cache_key(cache_dict, key_prefix)

    def get_annotation_data(self, query_obj: QueryObject) -> dict[str, Any]:
        annotation_data: dict[str, Any] = self.get_native_annotation_data(query_obj)
        for annotation_layer in [
            layer
            for layer in query_obj.annotation_layers
            if layer["sourceType"] in ("line", "table")
        ]:
            name = annotation_layer["name"]
            annotation_data[name] = self.get_viz_annotation_data(
                annotation_layer, self._query_context.force
            )
        return annotation_data

    @staticmethod
    def get_native_annotation_data(query_obj: QueryObject) -> dict[str, Any]:
        annotation_data = {}
        annotation_layers = [
            layer
            for layer in query_obj.annotation_layers
            if layer["sourceType"] == "NATIVE"
        ]
        layer_ids = [layer["value"] for layer in annotation_layers]
        layer_objects = {
            layer_object.id: layer_object
            for layer_object in AnnotationLayerDAO.find_by_ids(layer_ids)
        }

        # annotations
        for layer in annotation_layers:
            layer_id = layer["value"]
            layer_name = layer["name"]
            columns = [
                "start_dttm",
                "end_dttm",
                "short_descr",
                "long_descr",
                "json_metadata",
            ]
            layer_object = layer_objects[layer_id]
            records = [
                {column: getattr(annotation, column) for column in columns}
                for annotation in layer_object.annotation
            ]
            result = {"columns": columns, "records": records}
            annotation_data[layer_name] = result
        return annotation_data

    @staticmethod
    def get_viz_annotation_data(  # noqa: C901
        annotation_layer: dict[str, Any], force: bool
    ) -> dict[str, Any]:
        # pylint: disable=import-outside-toplevel
        from superset.commands.chart.data.get_data_command import ChartDataCommand

        if not (chart := ChartDAO.find_by_id(annotation_layer["value"])):
            raise QueryObjectValidationError(
                _(
                    f"""Chart with ID {annotation_layer["value"]} (referenced by
                    annotation layer '{annotation_layer["name"]}') was not found.
                    Please verify that the chart exists and is accessible."""
                )
            )

        try:
            if chart.viz_type in viz_types:
                if not chart.datasource:
                    raise QueryObjectValidationError(
                        _(
                            f"""The dataset for chart ID {chart.id} (referenced by
                            annotation layer '{annotation_layer["name"]}') was
                            not found. Please check that the dataset exists and
                            is accessible."""
                        )
                    )

                form_data = chart.form_data.copy()
                form_data.update(annotation_layer.get("overrides", {}))

                payload = get_viz(
                    datasource_type=chart.datasource.type,
                    datasource_id=chart.datasource.id,
                    form_data=form_data,
                    force=force,
                ).get_payload()

                return payload["data"]

            if not (query_context := chart.get_query_context()):
                raise QueryObjectValidationError(
                    _(
                        f"""The query context for chart ID {chart.id} (referenced
                        by annotation layer '{annotation_layer["name"]}') was not found.
                        Please ensure the chart is properly configured and has a valid
                        query context."""
                    )
                )

            if overrides := annotation_layer.get("overrides"):
                if time_grain_sqla := overrides.get("time_grain_sqla"):
                    for query_object in query_context.queries:
                        query_object.extras["time_grain_sqla"] = time_grain_sqla

                if time_range := overrides.get("time_range"):
                    from_dttm, to_dttm = get_since_until_from_time_range(time_range)

                    for query_object in query_context.queries:
                        query_object.from_dttm = from_dttm
                        query_object.to_dttm = to_dttm

            query_context.force = force
            command = ChartDataCommand(query_context)
            command.validate()
            payload = command.run()
            return {"records": payload["queries"][0]["data"]}
        except SupersetException as ex:
            raise QueryObjectValidationError(error_msg_from_exception(ex)) from ex

    def raise_for_access(self) -> None:
        """
        Raise an exception if the user cannot access the resource.

        :raises SupersetSecurityException: If the user cannot access the resource
        """
        for query in self._query_context.queries:
            query.validate()

        if self._qc_datasource.type == DatasourceType.QUERY:
            security_manager.raise_for_access(query=self._qc_datasource)
        else:
            security_manager.raise_for_access(query_context=self._query_context)
