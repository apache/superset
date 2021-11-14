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
# pylint: disable=invalid-name
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, NamedTuple, Optional, TYPE_CHECKING

from flask_babel import gettext as _
from pandas import DataFrame

from superset import app, db
from superset.common.chart_data import ChartDataResultType
from superset.connectors.base.models import BaseDatasource
from superset.connectors.connector_registry import ConnectorRegistry
from superset.exceptions import QueryObjectValidationError
from superset.typing import Metric, OrderBy
from superset.utils import pandas_postprocessing
from superset.utils.core import (
    apply_max_row_limit,
    DatasourceDict,
    DTTM_ALIAS,
    find_duplicates,
    get_metric_names,
    is_adhoc_metric,
    json_int_dttm_ser,
    QueryObjectFilterClause,
)
from superset.utils.date_parser import get_since_until, parse_human_timedelta
from superset.utils.hashing import md5_sha_from_dict
from superset.views.utils import get_time_range_endpoints

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext  # pragma: no cover


config = app.config
logger = logging.getLogger(__name__)

# TODO: Type Metrics dictionary with TypedDict when it becomes a vanilla python type
#  https://github.com/python/mypy/issues/5288


class DeprecatedField(NamedTuple):
    old_name: str
    new_name: str


DEPRECATED_FIELDS = (
    DeprecatedField(old_name="granularity_sqla", new_name="granularity"),
    DeprecatedField(old_name="groupby", new_name="columns"),
    DeprecatedField(old_name="timeseries_limit", new_name="series_limit"),
    DeprecatedField(old_name="timeseries_limit_metric", new_name="series_limit_metric"),
)

DEPRECATED_EXTRAS_FIELDS = (
    DeprecatedField(old_name="where", new_name="where"),
    DeprecatedField(old_name="having", new_name="having"),
    DeprecatedField(old_name="having_filters", new_name="having_druid"),
    DeprecatedField(old_name="druid_time_origin", new_name="druid_time_origin"),
)


class QueryObject:  # pylint: disable=too-many-instance-attributes
    """
    The query object's schema matches the interfaces of DB connectors like sqla
    and druid. The query objects are constructed on the client.
    """

    annotation_layers: List[Dict[str, Any]]
    applied_time_extras: Dict[str, str]
    apply_fetch_values_predicate: bool
    columns: List[str]
    datasource: Optional[BaseDatasource]
    extras: Dict[str, Any]
    filter: List[QueryObjectFilterClause]
    from_dttm: Optional[datetime]
    granularity: Optional[str]
    inner_from_dttm: Optional[datetime]
    inner_to_dttm: Optional[datetime]
    is_rowcount: bool
    is_timeseries: bool
    order_desc: bool
    orderby: List[OrderBy]
    metrics: Optional[List[Metric]]
    result_type: Optional[ChartDataResultType]
    row_limit: int
    row_offset: int
    series_columns: List[str]
    series_limit: int
    series_limit_metric: Optional[Metric]
    time_offsets: List[str]
    time_shift: Optional[timedelta]
    to_dttm: Optional[datetime]
    post_processing: List[Dict[str, Any]]

    def __init__(  # pylint: disable=too-many-arguments,too-many-locals
        self,
        query_context: "QueryContext",
        annotation_layers: Optional[List[Dict[str, Any]]] = None,
        applied_time_extras: Optional[Dict[str, str]] = None,
        apply_fetch_values_predicate: bool = False,
        columns: Optional[List[str]] = None,
        datasource: Optional[DatasourceDict] = None,
        extras: Optional[Dict[str, Any]] = None,
        filters: Optional[List[QueryObjectFilterClause]] = None,
        granularity: Optional[str] = None,
        is_rowcount: bool = False,
        is_timeseries: Optional[bool] = None,
        metrics: Optional[List[Metric]] = None,
        order_desc: bool = True,
        orderby: Optional[List[OrderBy]] = None,
        post_processing: Optional[List[Optional[Dict[str, Any]]]] = None,
        result_type: Optional[ChartDataResultType] = None,
        row_limit: Optional[int] = None,
        row_offset: Optional[int] = None,
        series_columns: Optional[List[str]] = None,
        series_limit: int = 0,
        series_limit_metric: Optional[Metric] = None,
        time_range: Optional[str] = None,
        time_shift: Optional[str] = None,
        **kwargs: Any,
    ):
        columns = columns or []
        extras = extras or {}
        annotation_layers = annotation_layers or []
        self.time_offsets = kwargs.get("time_offsets", [])
        self.inner_from_dttm = kwargs.get("inner_from_dttm")
        self.inner_to_dttm = kwargs.get("inner_to_dttm")
        if series_columns:
            self.series_columns = series_columns
        elif is_timeseries and metrics:
            self.series_columns = columns
        else:
            self.series_columns = []

        self.is_rowcount = is_rowcount
        self.datasource = None
        if datasource:
            self.datasource = ConnectorRegistry.get_datasource(
                str(datasource["type"]), int(datasource["id"]), db.session
            )
        self.result_type = result_type or query_context.result_type
        self.apply_fetch_values_predicate = apply_fetch_values_predicate or False
        self.annotation_layers = [
            layer
            for layer in annotation_layers
            # formula annotations don't affect the payload, hence can be dropped
            if layer["annotationType"] != "FORMULA"
        ]
        self.applied_time_extras = applied_time_extras or {}
        self.granularity = granularity
        self.from_dttm, self.to_dttm = get_since_until(
            relative_start=extras.get(
                "relative_start", config["DEFAULT_RELATIVE_START_TIME"]
            ),
            relative_end=extras.get(
                "relative_end", config["DEFAULT_RELATIVE_END_TIME"]
            ),
            time_range=time_range,
            time_shift=time_shift,
        )
        # is_timeseries is True if time column is in either columns or groupby
        # (both are dimensions)
        self.is_timeseries = (
            is_timeseries if is_timeseries is not None else DTTM_ALIAS in columns
        )
        self.time_range = time_range
        self.time_shift = parse_human_timedelta(time_shift)
        self.post_processing = [
            post_proc for post_proc in post_processing or [] if post_proc
        ]

        # Support metric reference/definition in the format of
        #   1. 'metric_name'   - name of predefined metric
        #   2. { label: 'label_name' }  - legacy format for a predefined metric
        #   3. { expressionType: 'SIMPLE' | 'SQL', ... } - adhoc metric
        self.metrics = metrics and [
            x if isinstance(x, str) or is_adhoc_metric(x) else x["label"]  # type: ignore
            for x in metrics
        ]

        default_row_limit = (
            config["SAMPLES_ROW_LIMIT"]
            if self.result_type == ChartDataResultType.SAMPLES
            else config["ROW_LIMIT"]
        )
        self.row_limit = apply_max_row_limit(row_limit or default_row_limit)
        self.row_offset = row_offset or 0
        self.filter = filters or []
        self.series_limit = series_limit
        self.series_limit_metric = series_limit_metric
        self.order_desc = order_desc
        self.extras = extras

        if config["SIP_15_ENABLED"]:
            self.extras["time_range_endpoints"] = get_time_range_endpoints(
                form_data=self.extras
            )

        self.columns = columns
        self.orderby = orderby or []

        self._rename_deprecated_fields(kwargs)
        self._move_deprecated_extra_fields(kwargs)

    def _rename_deprecated_fields(self, kwargs: Dict[str, Any]) -> None:
        # rename deprecated fields
        for field in DEPRECATED_FIELDS:
            if field.old_name in kwargs:
                logger.warning(
                    "The field `%s` is deprecated, please use `%s` instead.",
                    field.old_name,
                    field.new_name,
                )
                value = kwargs[field.old_name]
                if value:
                    if hasattr(self, field.new_name):
                        logger.warning(
                            "The field `%s` is already populated, "
                            "replacing value with contents from `%s`.",
                            field.new_name,
                            field.old_name,
                        )
                    setattr(self, field.new_name, value)

    def _move_deprecated_extra_fields(self, kwargs: Dict[str, Any]) -> None:
        # move deprecated extras fields to extras
        for field in DEPRECATED_EXTRAS_FIELDS:
            if field.old_name in kwargs:
                logger.warning(
                    "The field `%s` is deprecated and should "
                    "be passed to `extras` via the `%s` property.",
                    field.old_name,
                    field.new_name,
                )
                value = kwargs[field.old_name]
                if value:
                    if hasattr(self.extras, field.new_name):
                        logger.warning(
                            "The field `%s` is already populated in "
                            "`extras`, replacing value with contents "
                            "from `%s`.",
                            field.new_name,
                            field.old_name,
                        )
                    self.extras[field.new_name] = value

    @property
    def metric_names(self) -> List[str]:
        """Return metrics names (labels), coerce adhoc metrics to strings."""
        return get_metric_names(self.metrics or [])

    @property
    def column_names(self) -> List[str]:
        """Return column names (labels). Reserved for future adhoc calculated
        columns."""
        return self.columns

    def validate(
        self, raise_exceptions: Optional[bool] = True
    ) -> Optional[QueryObjectValidationError]:
        """Validate query object"""
        try:
            self._validate_there_are_no_missing_series()
            self._validate_no_have_duplicate_labels()
            return None
        except QueryObjectValidationError as ex:
            if raise_exceptions:
                raise ex
            return ex

    def _validate_no_have_duplicate_labels(self) -> None:
        all_labels = self.metric_names + self.column_names
        if len(set(all_labels)) < len(all_labels):
            dup_labels = find_duplicates(all_labels)
            raise QueryObjectValidationError(
                _(
                    "Duplicate column/metric labels: %(labels)s. Please make "
                    "sure all columns and metrics have a unique label.",
                    labels=", ".join(f'"{x}"' for x in dup_labels),
                )
            )

    def _validate_there_are_no_missing_series(self) -> None:
        missing_series = [col for col in self.series_columns if col not in self.columns]
        if missing_series:
            raise QueryObjectValidationError(
                _(
                    "The following entries in `series_columns` are missing "
                    "in `columns`: %(columns)s. ",
                    columns=", ".join(f'"{x}"' for x in missing_series),
                )
            )

    def to_dict(self) -> Dict[str, Any]:
        query_object_dict = {
            "apply_fetch_values_predicate": self.apply_fetch_values_predicate,
            "columns": self.columns,
            "extras": self.extras,
            "filter": self.filter,
            "from_dttm": self.from_dttm,
            "granularity": self.granularity,
            "inner_from_dttm": self.inner_from_dttm,
            "inner_to_dttm": self.inner_to_dttm,
            "is_rowcount": self.is_rowcount,
            "is_timeseries": self.is_timeseries,
            "metrics": self.metrics,
            "order_desc": self.order_desc,
            "orderby": self.orderby,
            "row_limit": self.row_limit,
            "row_offset": self.row_offset,
            "series_columns": self.series_columns,
            "series_limit": self.series_limit,
            "series_limit_metric": self.series_limit_metric,
            "to_dttm": self.to_dttm,
        }
        return query_object_dict

    def cache_key(self, **extra: Any) -> str:
        """
        The cache key is made out of the key/values from to_dict(), plus any
        other key/values in `extra`
        We remove datetime bounds that are hard values, and replace them with
        the use-provided inputs to bounds, which may be time-relative (as in
        "5 days ago" or "now").
        """
        cache_dict = self.to_dict()
        cache_dict.update(extra)

        # TODO: the below KVs can all be cleaned up and moved to `to_dict()` at some
        #  predetermined point in time when orgs are aware that the previously
        #  chached results will be invalidated.
        if not self.apply_fetch_values_predicate:
            del cache_dict["apply_fetch_values_predicate"]
        if self.datasource:
            cache_dict["datasource"] = self.datasource.uid
        if self.result_type:
            cache_dict["result_type"] = self.result_type
        if self.time_range:
            cache_dict["time_range"] = self.time_range
        if self.post_processing:
            cache_dict["post_processing"] = self.post_processing
        if self.time_offsets:
            cache_dict["time_offsets"] = self.time_offsets

        for k in ["from_dttm", "to_dttm"]:
            del cache_dict[k]

        annotation_fields = [
            "annotationType",
            "descriptionColumns",
            "intervalEndColumn",
            "name",
            "overrides",
            "sourceType",
            "timeColumn",
            "titleColumn",
            "value",
        ]
        annotation_layers = [
            {field: layer[field] for field in annotation_fields if field in layer}
            for layer in self.annotation_layers
        ]
        # only add to key if there are annotations present that affect the payload
        if annotation_layers:
            cache_dict["annotation_layers"] = annotation_layers

        return md5_sha_from_dict(cache_dict, default=json_int_dttm_ser, ignore_nan=True)

    def exec_post_processing(self, df: DataFrame) -> DataFrame:
        """
        Perform post processing operations on DataFrame.

        :param df: DataFrame returned from database model.
        :return: new DataFrame to which all post processing operations have been
                 applied
        :raises QueryObjectValidationError: If the post processing operation
                 is incorrect
        """
        for post_process in self.post_processing:
            operation = post_process.get("operation")
            if not operation:
                raise QueryObjectValidationError(
                    _("`operation` property of post processing object undefined")
                )
            if not hasattr(pandas_postprocessing, operation):
                raise QueryObjectValidationError(
                    _(
                        "Unsupported post processing operation: %(operation)s",
                        type=operation,
                    )
                )
            options = post_process.get("options", {})
            df = getattr(pandas_postprocessing, operation)(df, **options)
        return df
