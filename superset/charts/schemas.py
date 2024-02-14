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
# pylint: disable=too-many-lines
from __future__ import annotations

import inspect
from typing import Any, TYPE_CHECKING

from flask_babel import gettext as _
from marshmallow import EXCLUDE, fields, post_load, Schema, validate
from marshmallow.validate import Length, Range

from superset import app
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.db_engine_specs.base import builtin_time_grains
from superset.tags.models import TagType
from superset.utils import pandas_postprocessing, schema as utils
from superset.utils.core import (
    AnnotationType,
    DatasourceType,
    FilterOperator,
    PostProcessingBoxplotWhiskerType,
    PostProcessingContributionOrientation,
)

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_context_factory import QueryContextFactory

config = app.config

#
# RISON/JSON schemas for query parameters
#
get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}

width_height_schema = {
    "type": "array",
    "items": {"type": "integer"},
}
thumbnail_query_schema = {
    "type": "object",
    "properties": {"force": {"type": "boolean"}},
}
screenshot_query_schema = {
    "type": "object",
    "properties": {
        "force": {"type": "boolean"},
        "window_size": width_height_schema,
        "thumb_size": width_height_schema,
    },
}
get_export_ids_schema = {"type": "array", "items": {"type": "integer"}}

get_fav_star_ids_schema = {"type": "array", "items": {"type": "integer"}}

#
# Column schema descriptions
#
id_description = "The id of the chart."
slice_name_description = "The name of the chart."
description_description = "A description of the chart propose."
viz_type_description = "The type of chart visualization used."
owners_description = (
    "Owner are users ids allowed to delete or change this chart. "
    "If left empty you will be one of the owners of the chart."
)
params_description = (
    "Parameters are generated dynamically when clicking the save "
    "or overwrite button in the explore view. "
    "This JSON object for power users who may want to alter specific parameters."
)
query_context_description = (
    "The query context represents the queries that need to run "
    "in order to generate the data the visualization, and in what "
    "format the data should be returned."
)
query_context_generation_description = (
    "The query context generation represents whether the query_context"
    "is user generated or not so that it does not update user modified"
    "state."
)
cache_timeout_description = (
    "Duration (in seconds) of the caching timeout "
    "for this chart. Note this defaults to the datasource/table"
    " timeout if undefined."
)
datasource_id_description = (
    "The id of the dataset/datasource this new chart will use. "
    "A complete datasource identification needs `datasource_id` "
    "and `datasource_type`."
)
datasource_uid_description = (
    "The uid of the dataset/datasource this new chart will use. "
    "A complete datasource identification needs `datasource_uid` "
)
datasource_type_description = (
    "The type of dataset/datasource identified on `datasource_id`."
)
datasource_name_description = "The datasource name."
dashboards_description = "A list of dashboards to include this new chart to."
changed_on_description = "The ISO date that the chart was last changed."
slice_url_description = "The URL of the chart."
form_data_description = (
    "Form data from the Explore controls used to form the chart's data query."
)
description_markeddown_description = "Sanitized HTML version of the chart description."
owners_name_description = "Name of an owner of the chart."
certified_by_description = "Person or group that has certified this chart"
certification_details_description = "Details of the certification"

openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get a chart detail information"}},
    "get_list": {
        "get": {
            "summary": "Get a list of charts",
            "description": "Gets a list of charts, use Rison or JSON query "
            "parameters for filtering, sorting, pagination and "
            " for selecting specific columns and metadata.",
        }
    },
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
    "related": {
        "get": {
            "description": "Get a list of all possible owners for a chart. "
            "Use `owners` has the `column_name` parameter"
        }
    },
}


class TagSchema(Schema):
    id = fields.Int()
    name = fields.String()
    type = fields.Enum(TagType, by_value=True)


class ChartEntityResponseSchema(Schema):
    """
    Schema for a chart object
    """

    id = fields.Integer(metadata={"description": id_description})
    slice_name = fields.String(metadata={"description": slice_name_description})
    cache_timeout = fields.Integer(metadata={"description": cache_timeout_description})
    changed_on = fields.DateTime(metadata={"description": changed_on_description})
    description = fields.String(metadata={"description": description_description})
    description_markeddown = fields.String(
        metadata={"description": description_markeddown_description}
    )
    form_data = fields.Dict(metadata={"description": form_data_description})
    slice_url = fields.String(metadata={"description": slice_url_description})
    certified_by = fields.String(metadata={"description": certified_by_description})
    certification_details = fields.String(
        metadata={"description": certification_details_description}
    )


class ChartPostSchema(Schema):
    """
    Schema to add a new chart.
    """

    slice_name = fields.String(
        metadata={"description": slice_name_description},
        required=True,
        validate=Length(1, 250),
    )
    description = fields.String(
        metadata={"description": description_description}, allow_none=True
    )
    viz_type = fields.String(
        metadata={
            "description": viz_type_description,
            "example": ["bar", "area", "table"],
        },
        validate=Length(0, 250),
    )
    owners = fields.List(fields.Integer(metadata={"description": owners_description}))
    params = fields.String(
        metadata={"description": params_description},
        allow_none=True,
        validate=utils.validate_json,
    )
    query_context = fields.String(
        metadata={"description": query_context_description},
        allow_none=True,
        validate=utils.validate_json,
    )
    query_context_generation = fields.Boolean(
        metadata={"description": query_context_generation_description}, allow_none=True
    )
    cache_timeout = fields.Integer(
        metadata={"description": cache_timeout_description}, allow_none=True
    )
    datasource_id = fields.Integer(
        metadata={"description": datasource_id_description}, required=True
    )
    datasource_type = fields.String(
        metadata={"description": datasource_type_description},
        validate=validate.OneOf(choices=[ds.value for ds in DatasourceType]),
        required=True,
    )
    datasource_name = fields.String(
        metadata={"description": datasource_name_description}, allow_none=True
    )
    dashboards = fields.List(
        fields.Integer(metadata={"description": dashboards_description})
    )
    certified_by = fields.String(
        metadata={"description": certified_by_description}, allow_none=True
    )
    certification_details = fields.String(
        metadata={"description": certification_details_description}, allow_none=True
    )
    is_managed_externally = fields.Boolean(allow_none=True, dump_default=False)
    external_url = fields.String(allow_none=True)


class ChartPutSchema(Schema):
    """
    Schema to update or patch a chart
    """

    slice_name = fields.String(
        metadata={"description": slice_name_description},
        allow_none=True,
        validate=Length(0, 250),
    )
    description = fields.String(
        metadata={"description": description_description}, allow_none=True
    )
    viz_type = fields.String(
        metadata={
            "description": viz_type_description,
            "example": ["bar", "area", "table"],
        },
        allow_none=True,
        validate=Length(0, 250),
    )
    owners = fields.List(fields.Integer(metadata={"description": owners_description}))
    params = fields.String(
        metadata={"description": params_description}, allow_none=True
    )
    query_context = fields.String(
        metadata={"description": query_context_description}, allow_none=True
    )
    query_context_generation = fields.Boolean(
        metadata={"description": query_context_generation_description}, allow_none=True
    )
    cache_timeout = fields.Integer(
        metadata={"description": cache_timeout_description}, allow_none=True
    )
    datasource_id = fields.Integer(
        metadata={"description": datasource_id_description}, allow_none=True
    )
    datasource_type = fields.String(
        metadata={"description": datasource_type_description},
        validate=validate.OneOf(choices=[ds.value for ds in DatasourceType]),
        allow_none=True,
    )
    dashboards = fields.List(
        fields.Integer(metadata={"description": dashboards_description})
    )
    certified_by = fields.String(
        metadata={"description": certified_by_description}, allow_none=True
    )
    certification_details = fields.String(
        metadata={"description": certification_details_description}, allow_none=True
    )
    is_managed_externally = fields.Boolean(allow_none=True, dump_default=False)
    external_url = fields.String(allow_none=True)
    tags = fields.Nested(TagSchema, many=True)


class ChartGetDatasourceObjectDataResponseSchema(Schema):
    datasource_id = fields.Integer(
        metadata={"description": "The datasource identifier"}
    )
    datasource_type = fields.Integer(metadata={"description": "The datasource type"})


class ChartGetDatasourceObjectResponseSchema(Schema):
    label = fields.String(metadata={"description": "The name of the datasource"})
    value = fields.Nested(ChartGetDatasourceObjectDataResponseSchema)


class ChartGetDatasourceResponseSchema(Schema):
    count = fields.Integer(metadata={"description": "The total number of datasources"})
    result = fields.Nested(ChartGetDatasourceObjectResponseSchema)


class ChartCacheScreenshotResponseSchema(Schema):
    cache_key = fields.String(metadata={"description": "The cache key"})
    chart_url = fields.String(metadata={"description": "The url to render the chart"})
    image_url = fields.String(
        metadata={"description": "The url to fetch the screenshot"}
    )


class ChartDataColumnSchema(Schema):
    column_name = fields.String(
        metadata={"description": "The name of the target column", "example": "mycol"},
    )
    type = fields.String(
        metadata={"description": "Type of target column", "example": "BIGINT"}
    )


class ChartDataAdhocMetricSchema(Schema):
    """
    Ad-hoc metrics are used to define metrics outside the datasource.
    """

    expressionType = fields.String(
        metadata={"description": "Simple or SQL metric", "example": "SQL"},
        required=True,
        validate=validate.OneOf(choices=("SIMPLE", "SQL")),
    )
    aggregate = fields.String(
        metadata={
            "description": "Aggregation operator."
            "Only required for simple expression types."
        },
        validate=validate.OneOf(
            choices=("AVG", "COUNT", "COUNT_DISTINCT", "MAX", "MIN", "SUM")
        ),
    )
    column = fields.Nested(ChartDataColumnSchema)
    sqlExpression = fields.String(
        metadata={
            "description": "The metric as defined by a SQL aggregate expression. "
            "Only required for SQL expression type.",
            "example": "SUM(weight * observations) / SUM(weight)",
        },
    )
    label = fields.String(
        metadata={
            "description": "Label for the metric. Is automatically generated unless"
            "hasCustomLabel is true, in which case label must be defined.",
            "example": "Weighted observations",
        },
    )
    hasCustomLabel = fields.Boolean(
        metadata={
            "description": "When false, the label will be automatically generated based "
            "on the aggregate expression. When true, a custom label has to be specified.",
            "example": True,
        },
    )
    optionName = fields.String(
        metadata={
            "description": "Unique identifier. Can be any string value, as long as all "
            "metrics have a unique identifier. If undefined, a random name"
            "will be generated.",
            "example": "metric_aec60732-fac0-4b17-b736-93f1a5c93e30",
        },
    )
    timeGrain = fields.String(
        metadata={
            "description": "Optional time grain for temporal filters",
            "example": "PT1M",
        },
    )
    isExtra = fields.Boolean(
        metadata={
            "description": "Indicates if the filter has been added by a filter component "
            "as opposed to being a part of the original query."
        }
    )


class ChartDataAggregateConfigField(fields.Dict):
    def __init__(self) -> None:
        super().__init__(
            metadata={
                "description": "The keys are the name of the aggregate column to be "
                "created, and the values specify the details of how to apply the "
                "aggregation. If an operator requires additional options, "
                "these can be passed here to be unpacked in the operator call. The "
                "following numpy operators are supported: average, argmin, argmax, "
                "cumsum, cumprod, max, mean, median, nansum, nanmin, nanmax, nanmean, "
                "nanmedian, min, percentile, prod, product, std, sum, var. Any options "
                "required by the operator can be passed to the `options` object.\n"
                "\n"
                "In the example, a new column `first_quantile` is created based on "
                "values in the column `my_col` using the `percentile` operator with "
                "the `q=0.25` parameter.",
                "example": {
                    "first_quantile": {
                        "operator": "percentile",
                        "column": "my_col",
                        "options": {"q": 0.25},
                    }
                },
            },
        )


class ChartDataPostProcessingOperationOptionsSchema(Schema):
    pass


class ChartDataAggregateOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Aggregate operation config.
    """

    groupby = (
        fields.List(
            fields.String(
                allow_none=False,
                metadata={"description": "Columns by which to group by"},
            ),
            minLength=1,
            required=True,
        ),
    )
    aggregates = ChartDataAggregateConfigField()


class ChartDataRollingOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Rolling operation config.
    """

    columns = (
        fields.Dict(
            metadata={
                "description": "columns on which to perform rolling, mapping source "
                "column to target column. For instance, `{'y': 'y'}` will replace the "
                "column `y` with the rolling value in `y`, while `{'y': 'y2'}` will add "
                "a column `y2` based on rolling values calculated from `y`, leaving the "
                "original column `y` unchanged.",
                "example": {"weekly_rolling_sales": "sales"},
            },
        ),
    )
    rolling_type = fields.String(
        metadata={
            "description": "Type of rolling window. Any numpy function will work.",
            "example": "percentile",
        },
        validate=validate.OneOf(
            choices=(
                "average",
                "argmin",
                "argmax",
                "cumsum",
                "cumprod",
                "max",
                "mean",
                "median",
                "nansum",
                "nanmin",
                "nanmax",
                "nanmean",
                "nanmedian",
                "nanpercentile",
                "min",
                "percentile",
                "prod",
                "product",
                "std",
                "sum",
                "var",
            )
        ),
        required=True,
    )
    window = fields.Integer(
        metadata={"description": "Size of the rolling window in days.", "example": 7},
        required=True,
    )
    rolling_type_options = fields.Dict(
        metadata={
            "description": "Optional options to pass to rolling method. Needed for "
            "e.g. quantile operation.",
            "example": {},
        },
    )
    center = fields.Boolean(
        metadata={
            "description": "Should the label be at the center of the window."
            "Default: `false`",
            "example": False,
        },
    )
    win_type = fields.String(
        metadata={
            "description": "Type of window function. See "
            "[SciPy window functions](https://docs.scipy.org/doc/scipy/reference "
            "/signal.windows.html#module-scipy.signal.windows) "
            "for more details. Some window functions require passing "
            "additional parameters to `rolling_type_options`. For instance, "
            "to use `gaussian`, the parameter `std` needs to be provided."
            ""
        },
        validate=validate.OneOf(
            choices=(
                "boxcar",
                "triang",
                "blackman",
                "hamming",
                "bartlett",
                "parzen",
                "bohman",
                "blackmanharris",
                "nuttall",
                "barthann",
                "kaiser",
                "gaussian",
                "general_gaussian",
                "slepian",
                "exponential",
            )
        ),
    )
    min_periods = fields.Integer(
        metadata={
            "description": "The minimum amount of periods required for a row to be "
            "included in the result set.",
            "example": 7,
        },
    )


class ChartDataSelectOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Sort operation config.
    """

    columns = fields.List(
        fields.String(),
        metadata={
            "description": "Columns which to select from the input data, in the desired "
            "order. If columns are renamed, the original column name should be "
            "referenced here.",
            "example": ["country", "gender", "age"],
        },
    )
    exclude = fields.List(
        fields.String(),
        metadata={
            "description": "Columns to exclude from selection.",
            "example": ["my_temp_column"],
        },
    )
    rename = fields.List(
        fields.Dict(),
        metadata={
            "description": "columns which to rename, mapping source column to target "
            "column. For instance, `{'y': 'y2'}` will rename the column `y` to `y2`.",
            "example": [{"age": "average_age"}],
        },
    )


class ChartDataSortOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Sort operation config.
    """

    columns = fields.Dict(
        metadata={
            "description": "columns by by which to sort. The key specifies the column "
            "name, value specifies if sorting in ascending order.",
            "example": {"country": True, "gender": False},
        },
        required=True,
    )
    aggregates = ChartDataAggregateConfigField()


class ChartDataContributionOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Contribution operation config.
    """

    orientation = fields.String(
        metadata={
            "description": "Should cell values be calculated across the row or column.",
            "example": "row",
        },
        required=True,
        validate=validate.OneOf(
            choices=[val.value for val in PostProcessingContributionOrientation]
        ),
    )


class ChartDataProphetOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Prophet operation config.
    """

    time_grain = fields.String(
        metadata={
            "description": "Time grain used to specify time period increments in "
            "prediction. Supports "
            "[ISO 8601](https://en.wikipedia.org/wiki/ISO_8601#Durations) durations.",
            "example": "P1D",
        },
        validate=validate.OneOf(
            choices=[
                i
                for i in {**builtin_time_grains, **config["TIME_GRAIN_ADDONS"]}.keys()
                if i
            ]
        ),
        required=True,
    )
    periods = fields.Integer(
        metadata={
            "description": "Time periods (in units of `time_grain`) to predict into "
            "the future",
            "example": 7,
        },
        min=0,
        required=True,
    )
    confidence_interval = fields.Float(
        metadata={
            "description": "Width of predicted confidence interval",
            "example": 0.8,
        },
        validate=[
            Range(
                min=0,
                max=1,
                min_inclusive=False,
                max_inclusive=False,
                error=_("`confidence_interval` must be between 0 and 1 (exclusive)"),
            )
        ],
        required=True,
    )
    yearly_seasonality = fields.Raw(
        # TODO: add correct union type once supported by Marshmallow
        metadata={
            "description": "Should yearly seasonality be applied. "
            "An integer value will specify Fourier order of seasonality, `None` will "
            "automatically detect seasonality.",
            "example": False,
        },
    )
    weekly_seasonality = fields.Raw(
        # TODO: add correct union type once supported by Marshmallow
        metadata={
            "description": "Should weekly seasonality be applied. "
            "An integer value will specify Fourier order of seasonality, `None` will "
            "automatically detect seasonality.",
            "example": False,
        },
    )
    monthly_seasonality = fields.Raw(
        # TODO: add correct union type once supported by Marshmallow
        metadata={
            "description": "Should monthly seasonality be applied. "
            "An integer value will specify Fourier order of seasonality, `None` will "
            "automatically detect seasonality.",
            "example": False,
        },
    )


class ChartDataBoxplotOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Boxplot operation config.
    """

    groupby = fields.List(
        fields.String(
            metadata={"description": "Columns by which to group the query."},
        ),
        allow_none=True,
    )

    metrics = fields.List(
        fields.Raw(),
        metadata={
            "description": "Aggregate expressions. Metrics can be passed as both "
            "references to datasource metrics (strings), or ad-hoc metrics"
            "which are defined only within the query object. See "
            "`ChartDataAdhocMetricSchema` for the structure of ad-hoc metrics. "
            "When metrics is undefined or null, the query is executed without a groupby. "
            "However, when metrics is an array (length >= 0), a groupby clause is added "
            "to the query."
        },
        allow_none=True,
    )

    whisker_type = fields.String(
        metadata={
            "description": "Whisker type. Any numpy function will work.",
            "example": "tukey",
        },
        validate=validate.OneOf(
            choices=([val.value for val in PostProcessingBoxplotWhiskerType])
        ),
        required=True,
    )

    percentiles = fields.Tuple(
        (
            fields.Float(
                metadata={"description": "Lower percentile"},
                validate=[
                    Range(
                        min=0,
                        max=100,
                        min_inclusive=False,
                        max_inclusive=False,
                        error=_(
                            "lower percentile must be greater than 0 and less "
                            "than 100. Must be lower than upper percentile."
                        ),
                    ),
                ],
            ),
            fields.Float(
                metadata={"description": "Upper percentile"},
                validate=[
                    Range(
                        min=0,
                        max=100,
                        min_inclusive=False,
                        max_inclusive=False,
                        error=_(
                            "upper percentile must be greater than 0 and less "
                            "than 100. Must be higher than lower percentile."
                        ),
                    ),
                ],
            ),
        ),
        metadata={
            "description": "Upper and lower percentiles for percentile whisker type.",
            "example": [1, 99],
        },
    )


class ChartDataPivotOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Pivot operation config.
    """

    index = (
        fields.List(
            fields.String(allow_none=False),
            metadata={"description": "Columns to group by on the table index (=rows)"},
            minLength=1,
            required=True,
        ),
    )
    columns = fields.List(
        fields.String(allow_none=False),
        metadata={"description": "Columns to group by on the table columns"},
    )
    metric_fill_value = fields.Number(
        metadata={
            "description": "Value to replace missing values with in "
            "aggregate calculations."
        },
    )
    column_fill_value = fields.String(
        metadata={"description": "Value to replace missing pivot columns names with."}
    )
    drop_missing_columns = fields.Boolean(
        metadata={
            "description": "Do not include columns whose entries are all missing "
            "(default: `true`)."
        },
    )
    marginal_distributions = fields.Boolean(
        metadata={"description": "Add totals for row/column. (default: `false`)"},
    )
    marginal_distribution_name = fields.String(
        metadata={
            "description": "Name of marginal distribution row/column. "
            "(default: `All`)"
        },
    )
    aggregates = ChartDataAggregateConfigField()


class ChartDataGeohashDecodeOptionsSchema(
    ChartDataPostProcessingOperationOptionsSchema
):
    """
    Geohash decode operation config.
    """

    geohash = fields.String(
        metadata={"description": "Name of source column containing geohash string"},
        required=True,
    )
    latitude = fields.String(
        metadata={"description": "Name of target column for decoded latitude"},
        required=True,
    )
    longitude = fields.String(
        metadata={"description": "Name of target column for decoded longitude"},
        required=True,
    )


class ChartDataGeohashEncodeOptionsSchema(
    ChartDataPostProcessingOperationOptionsSchema
):
    """
    Geohash encode operation config.
    """

    latitude = fields.String(
        metadata={"description": "Name of source latitude column"},
        required=True,
    )
    longitude = fields.String(
        metadata={"description": "Name of source longitude column"},
        required=True,
    )
    geohash = fields.String(
        metadata={"description": "Name of target column for encoded geohash string"},
        required=True,
    )


class ChartDataGeodeticParseOptionsSchema(
    ChartDataPostProcessingOperationOptionsSchema
):
    """
    Geodetic point string parsing operation config.
    """

    geodetic = fields.String(
        metadata={
            "description": "Name of source column containing geodetic point strings"
        },
        required=True,
    )
    latitude = fields.String(
        metadata={"description": "Name of target column for decoded latitude"},
        required=True,
    )
    longitude = fields.String(
        metadata={"description": "Name of target column for decoded longitude"},
        required=True,
    )
    altitude = fields.String(
        metadata={
            "description": "Name of target column for decoded altitude. If omitted, "
            "altitude information in geodetic string is ignored."
        },
    )


class ChartDataPostProcessingOperationSchema(Schema):
    operation = fields.String(
        metadata={
            "description": "Post processing operation type",
            "example": "aggregate",
        },
        required=True,
        validate=validate.OneOf(
            choices=[
                name
                for name, value in inspect.getmembers(
                    pandas_postprocessing, inspect.isfunction
                )
            ]
        ),
    )
    options = fields.Dict(
        metadata={
            "description": "Options specifying how to perform the operation. Please "
            "refer to the respective post processing operation option schemas. "
            "For example, `ChartDataPostProcessingOperationOptions` specifies "
            "the required options for the pivot operation.",
            "example": {
                "groupby": ["country", "gender"],
                "aggregates": {
                    "age_q1": {
                        "operator": "percentile",
                        "column": "age",
                        "options": {"q": 0.25},
                    },
                    "age_mean": {
                        "operator": "mean",
                        "column": "age",
                    },
                },
            },
        },
    )


class ChartDataFilterSchema(Schema):
    col = fields.Raw(
        metadata={
            "description": "The column to filter by. Can be either a string (physical or "
            "saved expression) or an object (adhoc column)",
            "example": "country",
        },
        required=True,
    )
    op = fields.String(  # pylint: disable=invalid-name
        metadata={"description": "The comparison operator.", "example": "IN"},
        validate=utils.OneOfCaseInsensitive(
            choices=[filter_op.value for filter_op in FilterOperator]
        ),
        required=True,
    )
    val = fields.Raw(
        metadata={
            "description": "The value or values to compare against. Can be a string, "
            "integer, decimal, None or list, depending on the operator.",
            "example": ["China", "France", "Japan"],
        },
        allow_none=True,
    )
    grain = fields.String(
        metadata={
            "description": "Optional time grain for temporal filters",
            "example": "PT1M",
        },
    )
    isExtra = fields.Boolean(
        metadata={
            "description": "Indicates if the filter has been added by a filter "
            "component as opposed to being a part of the original query."
        }
    )


class ChartDataExtrasSchema(Schema):
    relative_start = fields.String(
        metadata={
            "description": "Start time for relative time deltas. "
            'Default: `config["DEFAULT_RELATIVE_START_TIME"]`'
        },
        validate=validate.OneOf(choices=("today", "now")),
    )
    relative_end = fields.String(
        metadata={
            "description": "End time for relative time deltas. "
            'Default: `config["DEFAULT_RELATIVE_START_TIME"]`'
        },
        validate=validate.OneOf(choices=("today", "now")),
    )
    where = fields.String(
        metadata={
            "description": "WHERE clause to be added to queries using AND operator."
        },
    )
    having = fields.String(
        metadata={
            "description": "HAVING clause to be added to aggregate queries using "
            "AND operator."
        },
    )
    time_grain_sqla = fields.String(
        metadata={
            "description": "To what level of granularity should the temporal column be "
            "aggregated. Supports "
            "[ISO 8601](https://en.wikipedia.org/wiki/ISO_8601#Durations) durations.",
            "example": "P1D",
        },
        validate=validate.OneOf(
            choices=[
                i
                for i in {**builtin_time_grains, **config["TIME_GRAIN_ADDONS"]}.keys()
                if i
            ]
        ),
        allow_none=True,
    )


class AnnotationLayerSchema(Schema):
    annotationType = fields.String(
        metadata={"description": "Type of annotation layer"},
        validate=validate.OneOf(choices=[ann.value for ann in AnnotationType]),
    )
    color = fields.String(
        metadata={"description": "Layer color"},
        allow_none=True,
    )
    descriptionColumns = fields.List(
        fields.String(),
        metadata={
            "description": "Columns to use as the description. If none are provided, "
            "all will be shown."
        },
    )
    hideLine = fields.Boolean(
        metadata={
            "description": "Should line be hidden. Only applies to line annotations"
        },
        allow_none=True,
    )
    intervalEndColumn = fields.String(
        metadata={
            "description": "Column containing end of interval. "
            "Only applies to interval layers"
        },
        allow_none=True,
    )
    name = fields.String(metadata={"description": "Name of layer"}, required=True)
    opacity = fields.String(
        metadata={"description": "Opacity of layer"},
        validate=validate.OneOf(
            choices=("", "opacityLow", "opacityMedium", "opacityHigh"),
        ),
        allow_none=True,
        required=False,
    )
    overrides = fields.Dict(
        keys=fields.String(
            metadata={"description": "Name of property to be overridden"},
            validate=validate.OneOf(
                choices=("granularity", "time_grain_sqla", "time_range", "time_shift"),
            ),
        ),
        values=fields.Raw(allow_none=True),
        metadata={"description": "which properties should be overridable"},
        allow_none=True,
    )
    show = fields.Boolean(
        metadata={"description": "Should the layer be shown"}, required=True
    )
    showLabel = fields.Boolean(
        metadata={"description": "Should the label always be shown"},
        allow_none=True,
    )
    showMarkers = fields.Boolean(
        metadata={
            "description": "Should markers be shown. Only applies to line annotations."
        },
        required=True,
    )
    sourceType = fields.String(
        metadata={"description": "Type of source for annotation data"},
        validate=validate.OneOf(
            choices=(
                "",
                "line",
                "NATIVE",
                "table",
            )
        ),
    )
    style = fields.String(
        metadata={"description": "Line style. Only applies to time-series annotations"},
        validate=validate.OneOf(
            choices=(
                "dashed",
                "dotted",
                "solid",
                "longDashed",
            )
        ),
    )
    timeColumn = fields.String(
        metadata={"description": "Column with event date or interval start date"},
        allow_none=True,
    )
    titleColumn = fields.String(
        metadata={"description": "Column with title"},
        allow_none=True,
    )
    width = fields.Float(
        metadata={"description": "Width of annotation line"},
        validate=[
            Range(
                min=0,
                min_inclusive=True,
                error=_("`width` must be greater or equal to 0"),
            )
        ],
    )
    value = fields.Raw(
        metadata={
            "description": "For formula annotations, this contains the formula. "
            "For other types, this is the primary key of the source object."
        },
        required=True,
    )


class ChartDataDatasourceSchema(Schema):
    description = "Chart datasource"
    id = fields.Integer(
        metadata={"description": "Datasource id"},
        required=True,
    )
    type = fields.String(
        metadata={"description": "Datasource type"},
        validate=validate.OneOf(choices=[ds.value for ds in DatasourceType]),
    )


class ChartDataQueryObjectSchema(Schema):
    class Meta:  # pylint: disable=too-few-public-methods
        unknown = EXCLUDE

    datasource = fields.Nested(ChartDataDatasourceSchema, allow_none=True)
    result_type = fields.Enum(ChartDataResultType, by_value=True, allow_none=True)

    annotation_layers = fields.List(
        fields.Nested(AnnotationLayerSchema),
        metadata={"description": "Annotation layers to apply to chart"},
        allow_none=True,
    )
    applied_time_extras = fields.Dict(
        metadata={
            "description": "A mapping of temporal extras that have been applied to "
            "the query",
            "example": {"__time_range": "1 year ago : now"},
        },
        allow_none=True,
    )
    apply_fetch_values_predicate = fields.Boolean(
        metadata={
            "description": "Add fetch values predicate (where clause) to query "
            "if defined in datasource"
        },
        allow_none=True,
    )
    filters = fields.List(fields.Nested(ChartDataFilterSchema), allow_none=True)
    granularity = fields.String(
        metadata={"description": "Name of temporal column used for time filtering. "},
        allow_none=True,
    )
    granularity_sqla = fields.String(
        metadata={
            "description": "Name of temporal column used for time filtering for SQL "
            "datasources. This field is deprecated, use `granularity` "
            "instead.",
            "deprecated": True,
        },
        allow_none=True,
    )
    groupby = fields.List(
        fields.Raw(),
        metadata={
            "description": "Columns by which to group the query. "
            "This field is deprecated, use `columns` instead."
        },
        allow_none=True,
    )
    metrics = fields.List(
        fields.Raw(),
        metadata={
            "description": "Aggregate expressions. Metrics can be passed as both "
            "references to datasource metrics (strings), or ad-hoc metrics"
            "which are defined only within the query object. See "
            "`ChartDataAdhocMetricSchema` for the structure of ad-hoc metrics."
        },
        allow_none=True,
    )
    post_processing = fields.List(
        fields.Nested(ChartDataPostProcessingOperationSchema, allow_none=True),
        allow_none=True,
        metadata={
            "description": "Post processing operations to be applied to the result set. "
            "Operations are applied to the result set in sequential order."
        },
    )
    time_range = fields.String(
        metadata={
            "description": "A time rage, either expressed as a colon separated string "
            "`since : until` or human readable freeform. Valid formats for "
            "`since` and `until` are: \n"
            "- ISO 8601\n"
            "- X days/years/hours/day/year/weeks\n"
            "- X days/years/hours/day/year/weeks ago\n"
            "- X days/years/hours/day/year/weeks from now\n"
            "\n"
            "Additionally, the following freeform can be used:\n"
            "\n"
            "- Last day\n"
            "- Last week\n"
            "- Last month\n"
            "- Last quarter\n"
            "- Last year\n"
            "- No filter\n"
            "- Last X seconds/minutes/hours/days/weeks/months/years\n"
            "- Next X seconds/minutes/hours/days/weeks/months/years\n",
            "example": "Last week",
        },
        allow_none=True,
    )
    time_shift = fields.String(
        metadata={
            "description": "A human-readable date/time string. "
            "Please refer to [parsdatetime](https://github.com/bear/parsedatetime) "
            "documentation for details on valid values."
        },
        allow_none=True,
    )
    is_timeseries = fields.Boolean(
        metadata={"description": "Is the `query_object` a timeseries."},
        allow_none=True,
    )
    series_columns = fields.List(
        fields.Raw(),
        metadata={
            "description": "Columns to use when limiting series count. "
            "All columns must be present in the `columns` property. "
            "Requires `series_limit` and `series_limit_metric` to be set."
        },
        allow_none=True,
    )
    series_limit = fields.Integer(
        metadata={
            "description": "Maximum number of series. "
            "Requires `series` and `series_limit_metric` to be set."
        },
        allow_none=True,
    )
    series_limit_metric = fields.Raw(
        metadata={
            "description": "Metric used to limit timeseries queries by. "
            "Requires `series` and `series_limit` to be set."
        },
        allow_none=True,
    )
    timeseries_limit = fields.Integer(
        metadata={
            "description": "Maximum row count for timeseries queries. "
            "This field is deprecated, use `series_limit` instead."
            "Default: `0`"
        },
        allow_none=True,
    )
    timeseries_limit_metric = fields.Raw(
        metadata={
            "description": "Metric used to limit timeseries queries by. "
            "This field is deprecated, use `series_limit_metric` instead."
        },
        allow_none=True,
    )
    row_limit = fields.Integer(
        metadata={
            "description": "Maximum row count (0=disabled). "
            'Default: `config["ROW_LIMIT"]`'
        },
        allow_none=True,
        validate=[
            Range(min=0, error=_("`row_limit` must be greater than or equal to 0"))
        ],
    )
    row_offset = fields.Integer(
        metadata={"description": "Number of rows to skip. Default: `0`"},
        allow_none=True,
        validate=[
            Range(min=0, error=_("`row_offset` must be greater than or equal to 0"))
        ],
    )
    order_desc = fields.Boolean(
        metadata={"description": "Reverse order. Default: `false`"},
        allow_none=True,
    )
    extras = fields.Nested(
        ChartDataExtrasSchema,
        metadata={"description": "Extra parameters to add to the query."},
        allow_none=True,
    )
    columns = fields.List(
        fields.Raw(),
        metadata={"description": "Columns which to select in the query."},
        allow_none=True,
    )
    orderby = fields.List(
        fields.Tuple(
            (
                fields.Raw(
                    validate=[
                        Length(min=1, error=_("orderby column must be populated"))
                    ],
                    allow_none=False,
                ),
                fields.Boolean(),
            )
        ),
        metadata={
            "description": "Expects a list of lists where the first element is the "
            "column name which to sort by, and the second element is a boolean.",
            "example": [("my_col_1", False), ("my_col_2", True)],
        },
        allow_none=True,
    )
    where = fields.String(
        metadata={
            "description": "WHERE clause to be added to queries using AND operator."
            "This field is deprecated and should be passed to `extras`.",
            "deprecated": True,
        },
        allow_none=True,
    )
    having = fields.String(
        metadata={
            "description": "HAVING clause to be added to aggregate queries using "
            "AND operator. This field is deprecated and should be passed "
            "to `extras`.",
            "deprecated": True,
        },
        allow_none=True,
    )
    url_params = fields.Dict(
        metadata={
            "description": "Optional query parameters passed to a dashboard or Explore "
            " view"
        },
        keys=fields.String(metadata={"description": "The query parameter"}),
        values=fields.String(
            metadata={"description": "The value of the query parameter"}
        ),
        allow_none=True,
    )
    is_rowcount = fields.Boolean(
        metadata={"description": "Should the rowcount of the actual query be returned"},
        allow_none=True,
    )
    time_offsets = fields.List(
        fields.String(),
        allow_none=True,
    )


class ChartDataQueryContextSchema(Schema):
    query_context_factory: QueryContextFactory | None = None
    datasource = fields.Nested(ChartDataDatasourceSchema)
    queries = fields.List(fields.Nested(ChartDataQueryObjectSchema))
    custom_cache_timeout = fields.Integer(
        metadata={"description": "Override the default cache timeout"},
        required=False,
        allow_none=True,
    )

    force = fields.Boolean(
        metadata={
            "description": "Should the queries be forced to load from the source. "
            "Default: `false`"
        },
        allow_none=True,
    )

    result_type = fields.Enum(ChartDataResultType, by_value=True)
    result_format = fields.Enum(ChartDataResultFormat, by_value=True)

    form_data = fields.Raw(allow_none=True, required=False)

    # pylint: disable=unused-argument
    @post_load
    def make_query_context(self, data: dict[str, Any], **kwargs: Any) -> QueryContext:
        query_context = self.get_query_context_factory().create(**data)
        return query_context

    def get_query_context_factory(self) -> QueryContextFactory:
        if self.query_context_factory is None:
            # pylint: disable=import-outside-toplevel
            from superset.common.query_context_factory import QueryContextFactory

            self.query_context_factory = QueryContextFactory()
        return self.query_context_factory


class AnnotationDataSchema(Schema):
    columns = fields.List(
        fields.String(),
        metadata={"description": "columns available in the annotation result"},
        required=True,
    )
    records = fields.List(
        fields.Dict(
            keys=fields.String(),
        ),
        metadata={"description": "records mapping the column name to it's value"},
        required=True,
    )


class ChartDataResponseResult(Schema):
    annotation_data = fields.List(
        fields.Dict(
            keys=fields.String(metadata={"description": "Annotation layer name"}),
            values=fields.String(),
        ),
        metadata={"description": "All requested annotation data"},
        allow_none=True,
    )
    cache_key = fields.String(
        metadata={"description": "Unique cache key for query object"},
        required=True,
        allow_none=True,
    )
    cached_dttm = fields.String(
        metadata={"description": "Cache timestamp"},
        required=True,
        allow_none=True,
    )
    cache_timeout = fields.Integer(
        metadata={
            "description": "Cache timeout in following order: custom timeout, datasource "
            "timeout, cache default timeout, config default cache timeout."
        },
        required=True,
        allow_none=True,
    )
    error = fields.String(
        metadata={"description": "Error"},
        allow_none=True,
    )
    is_cached = fields.Boolean(
        metadata={"description": "Is the result cached"},
        required=True,
        allow_none=None,
    )
    query = fields.String(
        metadata={"description": "The executed query statement"},
        required=True,
        allow_none=False,
    )
    status = fields.String(
        metadata={"description": "Status of the query"},
        validate=validate.OneOf(
            choices=(
                "stopped",
                "failed",
                "pending",
                "running",
                "scheduled",
                "success",
                "timed_out",
            )
        ),
        allow_none=False,
    )
    stacktrace = fields.String(
        metadata={"description": "Stacktrace if there was an error"},
        allow_none=True,
    )
    rowcount = fields.Integer(
        metadata={"description": "Amount of rows in result set"},
        allow_none=False,
    )
    data = fields.List(fields.Dict(), metadata={"description": "A list with results"})
    colnames = fields.List(
        fields.String(), metadata={"description": "A list of column names"}
    )
    coltypes = fields.List(
        fields.Integer(),
        metadata={"description": "A list of generic data types of each column"},
    )
    applied_filters = fields.List(
        fields.Dict(), metadata={"description": "A list with applied filters"}
    )
    rejected_filters = fields.List(
        fields.Dict(), metadata={"description": "A list with rejected filters"}
    )
    from_dttm = fields.Integer(
        metadata={"description": "Start timestamp of time range"},
        required=False,
        allow_none=True,
    )
    to_dttm = fields.Integer(
        metadata={"description": "End timestamp of time range"},
        required=False,
        allow_none=True,
    )


class ChartDataResponseSchema(Schema):
    result = fields.List(
        fields.Nested(ChartDataResponseResult),
        metadata={
            "description": "A list of results for each corresponding query in the "
            "request."
        },
    )


class ChartDataAsyncResponseSchema(Schema):
    channel_id = fields.String(
        metadata={"description": "Unique session async channel ID"},
        allow_none=False,
    )
    job_id = fields.String(
        metadata={"description": "Unique async job ID"},
        allow_none=False,
    )
    user_id = fields.String(
        metadata={"description": "Requesting user ID"},
        allow_none=True,
    )
    status = fields.String(
        metadata={"description": "Status value for async job"},
        allow_none=False,
    )
    result_url = fields.String(
        metadata={"description": "Unique result URL for fetching async query data"},
        allow_none=False,
    )


class ChartFavStarResponseResult(Schema):
    id = fields.Integer(metadata={"description": "The Chart id"})
    value = fields.Boolean(metadata={"description": "The FaveStar value"})


class GetFavStarIdsSchema(Schema):
    result = fields.List(
        fields.Nested(ChartFavStarResponseResult),
        metadata={
            "description": "A list of results for each corresponding chart in the request"
        },
    )


class ImportV1ChartSchema(Schema):
    slice_name = fields.String(required=True)
    description = fields.String(allow_none=True)
    certified_by = fields.String(allow_none=True)
    certification_details = fields.String(allow_none=True)
    viz_type = fields.String(required=True)
    params = fields.Dict()
    query_context = fields.String(allow_none=True, validate=utils.validate_json)
    cache_timeout = fields.Integer(allow_none=True)
    uuid = fields.UUID(required=True)
    version = fields.String(required=True)
    dataset_uuid = fields.UUID(required=True)
    is_managed_externally = fields.Boolean(allow_none=True, dump_default=False)
    external_url = fields.String(allow_none=True)


class ChartCacheWarmUpRequestSchema(Schema):
    chart_id = fields.Integer(
        required=True,
        metadata={"description": "The ID of the chart to warm up cache for"},
    )
    dashboard_id = fields.Integer(
        metadata={
            "description": "The ID of the dashboard to get filters for when warming cache"
        }
    )
    extra_filters = fields.String(
        metadata={"description": "Extra filters to apply when warming up cache"}
    )


class ChartCacheWarmUpResponseSingleSchema(Schema):
    chart_id = fields.Integer(
        metadata={"description": "The ID of the chart the status belongs to"}
    )
    viz_error = fields.String(
        metadata={"description": "Error that occurred when warming cache for chart"}
    )
    viz_status = fields.String(
        metadata={"description": "Status of the underlying query for the viz"}
    )


class ChartCacheWarmUpResponseSchema(Schema):
    result = fields.List(
        fields.Nested(ChartCacheWarmUpResponseSingleSchema),
        metadata={
            "description": "A list of each chart's warmup status and errors if any"
        },
    )


CHART_SCHEMAS = (
    ChartCacheWarmUpRequestSchema,
    ChartCacheWarmUpResponseSchema,
    ChartDataQueryContextSchema,
    ChartDataResponseSchema,
    ChartDataAsyncResponseSchema,
    # TODO: These should optimally be included in the QueryContext schema as an `anyOf`
    #  in ChartDataPostProcessingOperation.options, but since `anyOf` is not
    #  by Marshmallow<3, this is not currently possible.
    ChartDataAdhocMetricSchema,
    ChartDataAggregateOptionsSchema,
    ChartDataContributionOptionsSchema,
    ChartDataProphetOptionsSchema,
    ChartDataBoxplotOptionsSchema,
    ChartDataPivotOptionsSchema,
    ChartDataRollingOptionsSchema,
    ChartDataSelectOptionsSchema,
    ChartDataSortOptionsSchema,
    ChartDataGeohashDecodeOptionsSchema,
    ChartDataGeohashEncodeOptionsSchema,
    ChartDataGeodeticParseOptionsSchema,
    ChartEntityResponseSchema,
    ChartGetDatasourceResponseSchema,
    ChartCacheScreenshotResponseSchema,
    GetFavStarIdsSchema,
)
