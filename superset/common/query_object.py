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
# pylint: disable=R
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, NamedTuple, Optional, Union

import simplejson as json
from flask_babel import gettext as _
from pandas import DataFrame

from superset import app, is_feature_enabled
from superset.exceptions import QueryObjectValidationError
from superset.typing import Metric
from superset.utils import pandas_postprocessing
from superset.utils.core import (
    DTTM_ALIAS,
    get_since_until,
    json_int_dttm_ser,
    parse_human_timedelta,
)
from superset.views.utils import get_time_range_endpoints

config = app.config
logger = logging.getLogger(__name__)

# TODO: Type Metrics dictionary with TypedDict when it becomes a vanilla python type
#  https://github.com/python/mypy/issues/5288


class DeprecatedField(NamedTuple):
    old_name: str
    new_name: str


DEPRECATED_FIELDS = (
    DeprecatedField(old_name="granularity_sqla", new_name="granularity"),
)

DEPRECATED_EXTRAS_FIELDS = (
    DeprecatedField(old_name="where", new_name="where"),
    DeprecatedField(old_name="having", new_name="having"),
    DeprecatedField(old_name="having_filters", new_name="having_druid"),
    DeprecatedField(old_name="druid_time_origin", new_name="druid_time_origin"),
)


class QueryObject:
    """
    The query object's schema matches the interfaces of DB connectors like sqla
    and druid. The query objects are constructed on the client.
    """

    annotation_layers: List[Dict[str, Any]]
    applied_time_extras: Dict[str, str]
    granularity: Optional[str]
    from_dttm: Optional[datetime]
    to_dttm: Optional[datetime]
    is_timeseries: bool
    time_shift: Optional[timedelta]
    groupby: List[str]
    metrics: List[Union[Dict[str, Any], str]]
    row_limit: int
    row_offset: int
    filter: List[Dict[str, Any]]
    timeseries_limit: int
    timeseries_limit_metric: Optional[Metric]
    order_desc: bool
    extras: Dict[str, Any]
    columns: List[str]
    orderby: List[List[str]]
    post_processing: List[Dict[str, Any]]

    def __init__(
        self,
        annotation_layers: Optional[List[Dict[str, Any]]] = None,
        applied_time_extras: Optional[Dict[str, str]] = None,
        granularity: Optional[str] = None,
        metrics: Optional[List[Union[Dict[str, Any], str]]] = None,
        groupby: Optional[List[str]] = None,
        filters: Optional[List[Dict[str, Any]]] = None,
        time_range: Optional[str] = None,
        time_shift: Optional[str] = None,
        is_timeseries: Optional[bool] = None,
        timeseries_limit: int = 0,
        row_limit: Optional[int] = None,
        row_offset: Optional[int] = None,
        timeseries_limit_metric: Optional[Metric] = None,
        order_desc: bool = True,
        extras: Optional[Dict[str, Any]] = None,
        columns: Optional[List[str]] = None,
        orderby: Optional[List[List[str]]] = None,
        post_processing: Optional[List[Optional[Dict[str, Any]]]] = None,
        **kwargs: Any,
    ):
        annotation_layers = annotation_layers or []
        metrics = metrics or []
        extras = extras or {}
        is_sip_38 = is_feature_enabled("SIP_38_VIZ_REARCHITECTURE")
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
        # is_timeseries is True if time column is in groupby
        self.is_timeseries = (
            is_timeseries
            if is_timeseries is not None
            else (DTTM_ALIAS in groupby if groupby else False)
        )
        self.time_range = time_range
        self.time_shift = parse_human_timedelta(time_shift)
        self.post_processing = [
            post_proc for post_proc in post_processing or [] if post_proc
        ]
        if not is_sip_38:
            self.groupby = groupby or []

        # Support metric reference/definition in the format of
        #   1. 'metric_name'   - name of predefined metric
        #   2. { label: 'label_name' }  - legacy format for a predefined metric
        #   3. { expressionType: 'SIMPLE' | 'SQL', ... } - adhoc metric
        self.metrics = [
            metric
            if isinstance(metric, str) or "expressionType" in metric
            else metric["label"]  # type: ignore
            for metric in metrics
        ]

        self.row_limit = row_limit or config["ROW_LIMIT"]
        self.row_offset = row_offset or 0
        self.filter = filters or []
        self.timeseries_limit = timeseries_limit
        self.timeseries_limit_metric = timeseries_limit_metric
        self.order_desc = order_desc
        self.extras = extras

        if config["SIP_15_ENABLED"] and "time_range_endpoints" not in self.extras:
            self.extras["time_range_endpoints"] = get_time_range_endpoints(form_data={})

        self.columns = columns or []
        if is_sip_38 and groupby:
            self.columns += groupby
            logger.warning(
                "The field `groupby` is deprecated. Viz plugins should "
                "pass all selectables via the `columns` field"
            )

        self.orderby = orderby or []

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

    def to_dict(self) -> Dict[str, Any]:
        query_object_dict = {
            "granularity": self.granularity,
            "from_dttm": self.from_dttm,
            "to_dttm": self.to_dttm,
            "is_timeseries": self.is_timeseries,
            "metrics": self.metrics,
            "row_limit": self.row_limit,
            "row_offset": self.row_offset,
            "filter": self.filter,
            "timeseries_limit": self.timeseries_limit,
            "timeseries_limit_metric": self.timeseries_limit_metric,
            "order_desc": self.order_desc,
            "extras": self.extras,
            "columns": self.columns,
            "orderby": self.orderby,
        }
        if not is_feature_enabled("SIP_38_VIZ_REARCHITECTURE"):
            query_object_dict["groupby"] = self.groupby

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

        for k in ["from_dttm", "to_dttm"]:
            del cache_dict[k]
        if self.time_range:
            cache_dict["time_range"] = self.time_range
        if self.post_processing:
            cache_dict["post_processing"] = self.post_processing

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

        json_data = self.json_dumps(cache_dict, sort_keys=True)
        return hashlib.md5(json_data.encode("utf-8")).hexdigest()

    @staticmethod
    def json_dumps(obj: Any, sort_keys: bool = False) -> str:
        return json.dumps(
            obj, default=json_int_dttm_ser, ignore_nan=True, sort_keys=sort_keys
        )

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
