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
from typing import Any, Dict

from flask_babel import gettext as _
from marshmallow import fields, post_load, Schema, validate
from marshmallow.validate import Length, Range

from superset.common.query_context import QueryContext
from superset.utils import schema as utils
from superset.utils.core import FilterOperator

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

#
# Column schema descriptions
#
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
cache_timeout_description = (
    "Duration (in seconds) of the caching timeout "
    "for this chart. Note this defaults to the datasource/table"
    " timeout if undefined."
)
datasource_id_description = (
    "The id of the dataset/datasource this new chart will use. "
    "A complete datasource identification needs `datasouce_id` "
    "and `datasource_type`."
)
datasource_type_description = (
    "The type of dataset/datasource identified on `datasource_id`."
)
datasource_name_description = "The datasource name."
dashboards_description = "A list of dashboards to include this new chart to."

#
# OpenAPI method specification overrides
#
openapi_spec_methods_override = {
    "get": {"get": {"description": "Get a chart detail information."}},
    "get_list": {
        "get": {
            "description": "Get a list of charts, use Rison or JSON query "
            "parameters for filtering, sorting, pagination and "
            " for selecting specific columns and metadata.",
        }
    },
    "info": {
        "get": {
            "description": "Several metadata information about chart API endpoints.",
        }
    },
    "related": {
        "get": {"description": "Get a list of all possible owners for a chart."}
    },
}


TIME_GRAINS = (
    "PT1S",
    "PT1M",
    "PT5M",
    "PT10M",
    "PT15M",
    "PT0.5H",
    "PT1H",
    "P1D",
    "P1W",
    "P1M",
    "P0.25Y",
    "P1Y",
    "1969-12-28T00:00:00Z/P1W",  # Week starting Sunday
    "1969-12-29T00:00:00Z/P1W",  # Week starting Monday
    "P1W/1970-01-03T00:00:00Z",  # Week ending Saturday
    "P1W/1970-01-04T00:00:00Z",  # Week ending Sunday
)


class ChartPostSchema(Schema):
    """
    Schema to add a new chart.
    """

    slice_name = fields.String(
        description=slice_name_description, required=True, validate=Length(1, 250)
    )
    description = fields.String(description=description_description, allow_none=True)
    viz_type = fields.String(
        description=viz_type_description,
        validate=Length(0, 250),
        example=["bar", "line_multi", "area", "table"],
    )
    owners = fields.List(fields.Integer(description=owners_description))
    params = fields.String(
        description=params_description, allow_none=True, validate=utils.validate_json
    )
    cache_timeout = fields.Integer(
        description=cache_timeout_description, allow_none=True
    )
    datasource_id = fields.Integer(description=datasource_id_description, required=True)
    datasource_type = fields.String(
        description=datasource_type_description,
        validate=validate.OneOf(choices=("druid", "table", "view")),
        required=True,
    )
    datasource_name = fields.String(
        description=datasource_name_description, allow_none=True
    )
    dashboards = fields.List(fields.Integer(description=dashboards_description))


class ChartPutSchema(Schema):
    """
    Schema to update or patch a chart
    """

    slice_name = fields.String(
        description=slice_name_description, allow_none=True, validate=Length(0, 250)
    )
    description = fields.String(description=description_description, allow_none=True)
    viz_type = fields.String(
        description=viz_type_description,
        allow_none=True,
        validate=Length(0, 250),
        example=["bar", "line_multi", "area", "table"],
    )
    owners = fields.List(fields.Integer(description=owners_description))
    params = fields.String(description=params_description, allow_none=True)
    cache_timeout = fields.Integer(
        description=cache_timeout_description, allow_none=True
    )
    datasource_id = fields.Integer(
        description=datasource_id_description, allow_none=True
    )
    datasource_type = fields.String(
        description=datasource_type_description,
        validate=validate.OneOf(choices=("druid", "table", "view")),
        allow_none=True,
    )
    dashboards = fields.List(fields.Integer(description=dashboards_description))


class ChartGetDatasourceObjectDataResponseSchema(Schema):
    datasource_id = fields.Integer(description="The datasource identifier")
    datasource_type = fields.Integer(description="The datasource type")


class ChartGetDatasourceObjectResponseSchema(Schema):
    label = fields.String(description="The name of the datasource")
    value = fields.Nested(ChartGetDatasourceObjectDataResponseSchema)


class ChartGetDatasourceResponseSchema(Schema):
    count = fields.Integer(description="The total number of datasources")
    result = fields.Nested(ChartGetDatasourceObjectResponseSchema)


class ChartCacheScreenshotResponseSchema(Schema):
    cache_key = fields.String(description="The cache key")
    chart_url = fields.String(description="The url to render the chart")
    image_url = fields.String(description="The url to fetch the screenshot")


class ChartDataColumnSchema(Schema):
    column_name = fields.String(
        description="The name of the target column", example="mycol",
    )
    type = fields.String(description="Type of target column", example="BIGINT")


class ChartDataAdhocMetricSchema(Schema):
    """
    Ad-hoc metrics are used to define metrics outside the datasource.
    """

    expressionType = fields.String(
        description="Simple or SQL metric",
        required=True,
        validate=validate.OneOf(choices=("SIMPLE", "SQL")),
        example="SQL",
    )
    aggregate = fields.String(
        description="Aggregation operator. Only required for simple expression types.",
        validate=validate.OneOf(
            choices=("AVG", "COUNT", "COUNT_DISTINCT", "MAX", "MIN", "SUM")
        ),
    )
    column = fields.Nested(ChartDataColumnSchema)
    sqlExpression = fields.String(
        description="The metric as defined by a SQL aggregate expression. "
        "Only required for SQL expression type.",
        example="SUM(weight * observations) / SUM(weight)",
    )
    label = fields.String(
        description="Label for the metric. Is automatically generated unless "
        "hasCustomLabel is true, in which case label must be defined.",
        example="Weighted observations",
    )
    hasCustomLabel = fields.Boolean(
        description="When false, the label will be automatically generated based on "
        "the aggregate expression. When true, a custom label has to be "
        "specified.",
        example=True,
    )
    optionName = fields.String(
        description="Unique identifier. Can be any string value, as long as all "
        "metrics have a unique identifier. If undefined, a random name "
        "will be generated.",
        example="metric_aec60732-fac0-4b17-b736-93f1a5c93e30",
    )


class ChartDataAggregateConfigField(fields.Dict):
    def __init__(self) -> None:
        super().__init__(
            description="The keys are the name of the aggregate column to be created, "
            "and the values specify the details of how to apply the "
            "aggregation. If an operator requires additional options, "
            "these can be passed here to be unpacked in the operator call. The "
            "following numpy operators are supported: average, argmin, argmax, cumsum, "
            "cumprod, max, mean, median, nansum, nanmin, nanmax, nanmean, nanmedian, "
            "min, percentile, prod, product, std, sum, var. Any options required by "
            "the operator can be passed to the `options` object.\n"
            "\n"
            "In the example, a new column `first_quantile` is created based on values "
            "in the column `my_col` using the `percentile` operator with "
            "the `q=0.25` parameter.",
            example={
                "first_quantile": {
                    "operator": "percentile",
                    "column": "my_col",
                    "options": {"q": 0.25},
                }
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
                allow_none=False, description="Columns by which to group by",
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
            description="columns on which to perform rolling, mapping source column to "
            "target column. For instance, `{'y': 'y'}` will replace the "
            "column `y` with the rolling value in `y`, while `{'y': 'y2'}` "
            "will add a column `y2` based on rolling values calculated "
            "from `y`, leaving the original column `y` unchanged.",
            example={"weekly_rolling_sales": "sales"},
        ),
    )
    rolling_type = fields.String(
        description="Type of rolling window. Any numpy function will work.",
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
        example="percentile",
    )
    window = fields.Integer(
        description="Size of the rolling window in days.", required=True, example=7,
    )
    rolling_type_options = fields.Dict(
        desctiption="Optional options to pass to rolling method. Needed for "
        "e.g. quantile operation.",
        example={},
    )
    center = fields.Boolean(
        description="Should the label be at the center of the window. Default: `false`",
        example=False,
    )
    win_type = fields.String(
        description="Type of window function. See "
        "[SciPy window functions](https://docs.scipy.org/doc/scipy/reference"
        "/signal.windows.html#module-scipy.signal.windows) "
        "for more details. Some window functions require passing "
        "additional parameters to `rolling_type_options`. For instance, "
        "to use `gaussian`, the parameter `std` needs to be provided.",
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
        description="The minimum amount of periods required for a row to be included "
        "in the result set.",
        example=7,
    )


class ChartDataSelectOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Sort operation config.
    """

    columns = fields.List(
        fields.String(),
        description="Columns which to select from the input data, in the desired "
        "order. If columns are renamed, the original column name should be "
        "referenced here.",
        example=["country", "gender", "age"],
    )
    exclude = fields.List(  # type: ignore
        fields.String(),
        description="Columns to exclude from selection.",
        example=["my_temp_column"],
    )
    rename = fields.List(
        fields.Dict(),
        description="columns which to rename, mapping source column to target column. "
        "For instance, `{'y': 'y2'}` will rename the column `y` to `y2`.",
        example=[{"age": "average_age"}],
    )


class ChartDataSortOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Sort operation config.
    """

    columns = fields.Dict(
        description="columns by by which to sort. The key specifies the column name, "
        "value specifies if sorting in ascending order.",
        example={"country": True, "gender": False},
        required=True,
    )
    aggregates = ChartDataAggregateConfigField()


class ChartDataContributionOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Contribution operation config.
    """

    orientation = fields.String(
        description="Should cell values be calculated across the row or column.",
        required=True,
        validate=validate.OneOf(choices=("row", "column",)),
        example="row",
    )


class ChartDataProphetOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Prophet operation config.
    """

    time_grain = fields.String(
        description="Time grain used to specify time period increments in prediction. "
        "Supports [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601#Durations) "
        "durations.",
        validate=validate.OneOf(choices=TIME_GRAINS),
        example="P1D",
        required=True,
    )
    periods = fields.Integer(
        descrption="Time periods (in units of `time_grain`) to predict into the future",
        min=1,
        example=7,
        required=True,
    )
    confidence_interval = fields.Float(
        description="Width of predicted confidence interval",
        validate=[
            Range(
                min=0,
                max=1,
                min_inclusive=False,
                max_inclusive=False,
                error=_("`confidence_interval` must be between 0 and 1 (exclusive)"),
            )
        ],
        example=0.8,
        required=True,
    )
    yearly_seasonality = fields.Raw(
        # TODO: add correct union type once supported by Marshmallow
        description="Should yearly seasonality be applied. "
        "An integer value will specify Fourier order of seasonality, `None` will "
        "automatically detect seasonality.",
        example=False,
    )
    weekly_seasonality = fields.Raw(
        # TODO: add correct union type once supported by Marshmallow
        description="Should weekly seasonality be applied. "
        "An integer value will specify Fourier order of seasonality, `None` will "
        "automatically detect seasonality.",
        example=False,
    )
    monthly_seasonality = fields.Raw(
        # TODO: add correct union type once supported by Marshmallow
        description="Should monthly seasonality be applied. "
        "An integer value will specify Fourier order of seasonality, `None` will "
        "automatically detect seasonality.",
        example=False,
    )


class ChartDataPivotOptionsSchema(ChartDataPostProcessingOperationOptionsSchema):
    """
    Pivot operation config.
    """

    index = (
        fields.List(
            fields.String(
                allow_none=False,
                description="Columns to group by on the table index (=rows)",
            ),
            minLength=1,
            required=True,
        ),
    )
    columns = fields.List(
        fields.String(
            allow_none=False, description="Columns to group by on the table columns",
        ),
    )
    metric_fill_value = fields.Number(
        description="Value to replace missing values with in aggregate calculations.",
    )
    column_fill_value = fields.String(
        description="Value to replace missing pivot columns names with."
    )
    drop_missing_columns = fields.Boolean(
        description="Do not include columns whose entries are all missing "
        "(default: `true`).",
    )
    marginal_distributions = fields.Boolean(
        description="Add totals for row/column. (default: `false`)",
    )
    marginal_distribution_name = fields.String(
        description="Name of marginal distribution row/column. (default: `All`)",
    )
    aggregates = ChartDataAggregateConfigField()


class ChartDataGeohashDecodeOptionsSchema(
    ChartDataPostProcessingOperationOptionsSchema
):
    """
    Geohash decode operation config.
    """

    geohash = fields.String(
        description="Name of source column containing geohash string", required=True,
    )
    latitude = fields.String(
        description="Name of target column for decoded latitude", required=True,
    )
    longitude = fields.String(
        description="Name of target column for decoded longitude", required=True,
    )


class ChartDataGeohashEncodeOptionsSchema(
    ChartDataPostProcessingOperationOptionsSchema
):
    """
    Geohash encode operation config.
    """

    latitude = fields.String(
        description="Name of source latitude column", required=True,
    )
    longitude = fields.String(
        description="Name of source longitude column", required=True,
    )
    geohash = fields.String(
        description="Name of target column for encoded geohash string", required=True,
    )


class ChartDataGeodeticParseOptionsSchema(
    ChartDataPostProcessingOperationOptionsSchema
):
    """
    Geodetic point string parsing operation config.
    """

    geodetic = fields.String(
        description="Name of source column containing geodetic point strings",
        required=True,
    )
    latitude = fields.String(
        description="Name of target column for decoded latitude", required=True,
    )
    longitude = fields.String(
        description="Name of target column for decoded longitude", required=True,
    )
    altitude = fields.String(
        description="Name of target column for decoded altitude. If omitted, "
        "altitude information in geodetic string is ignored.",
    )


class ChartDataPostProcessingOperationSchema(Schema):
    operation = fields.String(
        description="Post processing operation type",
        required=True,
        validate=validate.OneOf(
            choices=(
                "aggregate",
                "contribution",
                "cum",
                "geodetic_parse",
                "geohash_decode",
                "geohash_encode",
                "pivot",
                "prophet",
                "rolling",
                "select",
                "sort",
            )
        ),
        example="aggregate",
    )
    options = fields.Dict(
        description="Options specifying how to perform the operation. Please refer "
        "to the respective post processing operation option schemas. "
        "For example, `ChartDataPostProcessingOperationOptions` specifies "
        "the required options for the pivot operation.",
        example={
            "groupby": ["country", "gender"],
            "aggregates": {
                "age_q1": {
                    "operator": "percentile",
                    "column": "age",
                    "options": {"q": 0.25},
                },
                "age_mean": {"operator": "mean", "column": "age",},
            },
        },
    )


class ChartDataFilterSchema(Schema):
    col = fields.String(
        description="The column to filter.", required=True, example="country"
    )
    op = fields.String(  # pylint: disable=invalid-name
        description="The comparison operator.",
        validate=utils.OneOfCaseInsensitive(
            choices=[filter_op.value for filter_op in FilterOperator]
        ),
        required=True,
        example="IN",
    )
    val = fields.Raw(
        description="The value or values to compare against. Can be a string, "
        "integer, decimal or list, depending on the operator.",
        example=["China", "France", "Japan"],
    )


class ChartDataExtrasSchema(Schema):

    time_range_endpoints = fields.List(
        fields.String(
            validate=validate.OneOf(choices=("INCLUSIVE", "EXCLUSIVE")),
            description="A list with two values, stating if start/end should be "
            "inclusive/exclusive.",
        )
    )
    relative_start = fields.String(
        description="Start time for relative time deltas. "
        'Default: `config["DEFAULT_RELATIVE_START_TIME"]`',
        validate=validate.OneOf(choices=("today", "now")),
    )
    relative_end = fields.String(
        description="End time for relative time deltas. "
        'Default: `config["DEFAULT_RELATIVE_START_TIME"]`',
        validate=validate.OneOf(choices=("today", "now")),
    )
    where = fields.String(
        description="WHERE clause to be added to queries using AND operator.",
    )
    having = fields.String(
        description="HAVING clause to be added to aggregate queries using "
        "AND operator.",
    )
    having_druid = fields.List(
        fields.Nested(ChartDataFilterSchema),
        description="HAVING filters to be added to legacy Druid datasource queries.",
    )
    time_grain_sqla = fields.String(
        description="To what level of granularity should the temporal column be "
        "aggregated. Supports "
        "[ISO 8601](https://en.wikipedia.org/wiki/ISO_8601#Durations) durations.",
        validate=validate.OneOf(choices=TIME_GRAINS),
        example="P1D",
        allow_none=True,
    )
    druid_time_origin = fields.String(
        description="Starting point for time grain counting on legacy Druid "
        "datasources. Used to change e.g. Monday/Sunday first-day-of-week.",
        allow_none=True,
    )


class ChartDataQueryObjectSchema(Schema):
    filters = fields.List(fields.Nested(ChartDataFilterSchema), required=False)
    granularity = fields.String(
        description="Name of temporal column used for time filtering. For legacy Druid "
        "datasources this defines the time grain.",
    )
    granularity_sqla = fields.String(
        description="Name of temporal column used for time filtering for SQL "
        "datasources. This field is deprecated, use `granularity` "
        "instead.",
        deprecated=True,
    )
    groupby = fields.List(
        fields.String(description="Columns by which to group the query.",),
    )
    metrics = fields.List(
        fields.Raw(),
        description="Aggregate expressions. Metrics can be passed as both "
        "references to datasource metrics (strings), or ad-hoc metrics"
        "which are defined only within the query object. See "
        "`ChartDataAdhocMetricSchema` for the structure of ad-hoc metrics.",
    )
    post_processing = fields.List(
        fields.Nested(ChartDataPostProcessingOperationSchema, allow_none=True),
        description="Post processing operations to be applied to the result set. "
        "Operations are applied to the result set in sequential order.",
    )
    time_range = fields.String(
        description="A time rage, either expressed as a colon separated string "
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
        example="Last week",
    )
    time_shift = fields.String(
        description="A human-readable date/time string. "
        "Please refer to [parsdatetime](https://github.com/bear/parsedatetime) "
        "documentation for details on valid values.",
    )
    is_timeseries = fields.Boolean(
        description="Is the `query_object` a timeseries.", required=False
    )
    timeseries_limit = fields.Integer(
        description="Maximum row count for timeseries queries. Default: `0`",
    )
    timeseries_limit_metric = fields.Raw(
        description="Metric used to limit timeseries queries by.", allow_none=True,
    )
    row_limit = fields.Integer(
        description='Maximum row count. Default: `config["ROW_LIMIT"]`',
        validate=[
            Range(min=1, error=_("`row_limit` must be greater than or equal to 1"))
        ],
    )
    row_offset = fields.Integer(
        description="Number of rows to skip. Default: `0`",
        validate=[
            Range(min=0, error=_("`row_offset` must be greater than or equal to 0"))
        ],
    )
    order_desc = fields.Boolean(
        description="Reverse order. Default: `false`", required=False
    )
    extras = fields.Nested(ChartDataExtrasSchema, required=False)
    columns = fields.List(fields.String(), description="",)
    orderby = fields.List(
        fields.List(fields.Raw()),
        description="Expects a list of lists where the first element is the column "
        "name which to sort by, and the second element is a boolean ",
        example=[["my_col_1", False], ["my_col_2", True]],
    )
    where = fields.String(
        description="WHERE clause to be added to queries using AND operator."
        "This field is deprecated and should be passed to `extras`.",
        deprecated=True,
    )
    having = fields.String(
        description="HAVING clause to be added to aggregate queries using "
        "AND operator. This field is deprecated and should be passed "
        "to `extras`.",
        deprecated=True,
    )
    having_filters = fields.List(
        fields.Dict(),
        description="HAVING filters to be added to legacy Druid datasource queries. "
        "This field is deprecated and should be passed to `extras` "
        "as `having_druid`.",
        deprecated=True,
    )


class ChartDataDatasourceSchema(Schema):
    description = "Chart datasource"
    id = fields.Integer(description="Datasource id", required=True,)
    type = fields.String(
        description="Datasource type",
        validate=validate.OneOf(choices=("druid", "table")),
    )


class ChartDataQueryContextSchema(Schema):
    datasource = fields.Nested(ChartDataDatasourceSchema)
    queries = fields.List(fields.Nested(ChartDataQueryObjectSchema))
    force = fields.Boolean(
        description="Should the queries be forced to load from the source. "
        "Default: `false`",
    )
    result_type = fields.String(
        description="Type of results to return",
        validate=validate.OneOf(choices=("full", "query", "results", "samples")),
    )
    result_format = fields.String(
        description="Format of result payload",
        validate=validate.OneOf(choices=("json", "csv")),
    )

    # pylint: disable=no-self-use,unused-argument
    @post_load
    def make_query_context(self, data: Dict[str, Any], **kwargs: Any) -> QueryContext:
        query_context = QueryContext(**data)
        return query_context

    # pylint: enable=no-self-use,unused-argument


class ChartDataResponseResult(Schema):
    cache_key = fields.String(
        description="Unique cache key for query object", required=True, allow_none=True,
    )
    cached_dttm = fields.String(
        description="Cache timestamp", required=True, allow_none=True,
    )
    cache_timeout = fields.Integer(
        description="Cache timeout in following order: custom timeout, datasource "
        "timeout, default config timeout.",
        required=True,
        allow_none=True,
    )
    error = fields.String(description="Error", allow_none=True,)
    is_cached = fields.Boolean(
        description="Is the result cached", required=True, allow_none=None,
    )
    query = fields.String(
        description="The executed query statement", required=True, allow_none=False,
    )
    status = fields.String(
        description="Status of the query",
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
        desciption="Stacktrace if there was an error", allow_none=True,
    )
    rowcount = fields.Integer(
        description="Amount of rows in result set", allow_none=False,
    )
    data = fields.List(fields.Dict(), description="A list with results")


class ChartDataResponseSchema(Schema):
    result = fields.List(
        fields.Nested(ChartDataResponseResult),
        description="A list of results for each corresponding query in the request.",
    )


CHART_SCHEMAS = (
    ChartDataQueryContextSchema,
    ChartDataResponseSchema,
    # TODO: These should optimally be included in the QueryContext schema as an `anyOf`
    #  in ChartDataPostPricessingOperation.options, but since `anyOf` is not
    #  by Marshmallow<3, this is not currently possible.
    ChartDataAdhocMetricSchema,
    ChartDataAggregateOptionsSchema,
    ChartDataContributionOptionsSchema,
    ChartDataPivotOptionsSchema,
    ChartDataRollingOptionsSchema,
    ChartDataSelectOptionsSchema,
    ChartDataSortOptionsSchema,
    ChartDataGeohashDecodeOptionsSchema,
    ChartDataGeohashEncodeOptionsSchema,
    ChartDataGeodeticParseOptionsSchema,
    ChartGetDatasourceResponseSchema,
    ChartCacheScreenshotResponseSchema,
)
