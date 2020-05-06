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
from typing import Any, Dict, Union

from marshmallow import fields, post_load, Schema, validate, ValidationError
from marshmallow.validate import Length

from superset.common.query_context import QueryContext
from superset.exceptions import SupersetException
from superset.utils import core as utils

#
# RISON/JSON schemas for query parameters
#
get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}
thumbnail_query_schema = {
    "type": "object",
    "properties": {"force": {"type": "boolean"}},
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
""" Overrides GET methods OpenApi descriptions """


def validate_json(value: Union[bytes, bytearray, str]) -> None:
    try:
        utils.validate_json(value)
    except SupersetException:
        raise ValidationError("JSON not valid")


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
        description=params_description, allow_none=True, validate=validate_json
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
        required=False,
        validate=validate.OneOf(
            choices=("AVG", "COUNT", "COUNT_DISTINCT", "MAX", "MIN", "SUM")
        ),
    )
    column = fields.Nested(ChartDataColumnSchema)
    sqlExpression = fields.String(
        description="The metric as defined by a SQL aggregate expression. "
        "Only required for SQL expression type.",
        required=False,
        example="SUM(weight * observations) / SUM(weight)",
    )
    label = fields.String(
        description="Label for the metric. Is automatically generated unless "
        "hasCustomLabel is true, in which case label must be defined.",
        required=False,
        example="Weighted observations",
    )
    hasCustomLabel = fields.Boolean(
        description="When false, the label will be automatically generated based on "
        "the aggregate expression. When true, a custom label has to be "
        "specified.",
        required=False,
        example=True,
    )
    optionName = fields.String(
        description="Unique identifier. Can be any string value, as long as all "
        "metrics have a unique identifier. If undefined, a random name "
        "will be generated.",
        required=False,
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
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)


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
        required=False,
        example={},
    )
    center = fields.Boolean(
        description="Should the label be at the center of the window. Default: `false`",
        required=False,
        example=False,
    )
    win_type = fields.String(
        description="Type of window function. See "
        "[SciPy window functions](https://docs.scipy.org/doc/scipy/reference"
        "/signal.windows.html#module-scipy.signal.windows) "
        "for more details. Some window functions require passing "
        "additional parameters to `rolling_type_options`. For instance, "
        "to use `gaussian`, the parameter `std` needs to be provided.",
        required=False,
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
        required=False,
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
        required=False,
    )
    exclude = fields.List(
        fields.String(),
        description="Columns to exclude from selection.",
        example=["my_temp_column"],
        required=False,
    )
    rename = fields.List(
        fields.Dict(),
        description="columns which to rename, mapping source column to target column. "
        "For instance, `{'y': 'y2'}` will rename the column `y` to `y2`.",
        example=[{"age": "average_age"}],
        required=False,
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
        minLength=1,
        required=True,
    )
    metric_fill_value = fields.Number(
        required=False,
        description="Value to replace missing values with in aggregate calculations.",
    )
    column_fill_value = fields.String(
        required=False, description="Value to replace missing pivot columns names with."
    )
    drop_missing_columns = fields.Boolean(
        description="Do not include columns whose entries are all missing "
        "(default: `true`).",
        required=False,
    )
    marginal_distributions = fields.Boolean(
        description="Add totals for row/column. (default: `false`)", required=False,
    )
    marginal_distribution_name = fields.String(
        description="Name of marginal distribution row/column. (default: `All`)",
        required=False,
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
        required=False,
    )


class ChartDataPostProcessingOperationSchema(Schema):
    operation = fields.String(
        description="Post processing operation type",
        required=True,
        validate=validate.OneOf(
            choices=(
                "aggregate",
                "geodetic_parse",
                "geohash_decode",
                "geohash_encode",
                "pivot",
                "rolling",
                "select",
                "sort",
            )
        ),
        example="aggregate",
    )
    options = fields.Nested(
        ChartDataPostProcessingOperationOptionsSchema,
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
        validate=validate.OneOf(
            choices=[filter_op.value for filter_op in utils.FilterOperator]
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
            required=False,
        )
    )
    relative_start = fields.String(
        description="Start time for relative time deltas. "
        'Default: `config["DEFAULT_RELATIVE_START_TIME"]`',
        validate=validate.OneOf(choices=("today", "now")),
        required=False,
    )
    relative_end = fields.String(
        description="End time for relative time deltas. "
        'Default: `config["DEFAULT_RELATIVE_START_TIME"]`',
        validate=validate.OneOf(choices=("today", "now")),
        required=False,
    )
    where = fields.String(
        description="WHERE clause to be added to queries using AND operator.",
        required=False,
    )
    having = fields.String(
        description="HAVING clause to be added to aggregate queries using "
        "AND operator.",
        required=False,
    )
    having_druid = fields.List(
        fields.Nested(ChartDataFilterSchema),
        description="HAVING filters to be added to legacy Druid datasource queries.",
        required=False,
    )
    time_grain_sqla = fields.String(
        description="To what level of granularity should the temporal column be "
        "aggregated. Supports "
        "[ISO 8601](https://en.wikipedia.org/wiki/ISO_8601#Durations) durations.",
        validate=validate.OneOf(
            choices=(
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
            ),
        ),
        required=False,
        example="P1D",
    )
    druid_time_origin = fields.String(
        description="Starting point for time grain counting on legacy Druid "
        "datasources. Used to change e.g. Monday/Sunday first-day-of-week.",
        required=False,
    )


class ChartDataQueryObjectSchema(Schema):
    filters = fields.List(fields.Nested(ChartDataFilterSchema), required=False)
    granularity = fields.String(
        description="Name of temporal column used for time filtering. For legacy Druid "
        "datasources this defines the time grain.",
        required=False,
    )
    granularity_sqla = fields.String(
        description="Name of temporal column used for time filtering for SQL "
        "datasources. This field is deprecated, use `granularity` "
        "instead.",
        required=False,
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
        required=False,
    )
    post_processing = fields.List(
        fields.Nested(ChartDataPostProcessingOperationSchema),
        description="Post processing operations to be applied to the result set. "
        "Operations are applied to the result set in sequential order.",
        required=False,
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
        required=False,
        example="Last week",
    )
    time_shift = fields.String(
        description="A human-readable date/time string. "
        "Please refer to [parsdatetime](https://github.com/bear/parsedatetime) "
        "documentation for details on valid values.",
        required=False,
    )
    is_timeseries = fields.Boolean(
        description="Is the `query_object` a timeseries.", required=False
    )
    timeseries_limit = fields.Integer(
        description="Maximum row count for timeseries queries. Default: `0`",
        required=False,
    )
    row_limit = fields.Integer(
        description='Maximum row count. Default: `config["ROW_LIMIT"]`', required=False,
    )
    order_desc = fields.Boolean(
        description="Reverse order. Default: `false`", required=False
    )
    extras = fields.Nested(ChartDataExtrasSchema, required=False)
    columns = fields.List(fields.String(), description="", required=False,)
    orderby = fields.List(
        fields.List(fields.Raw()),
        description="Expects a list of lists where the first element is the column "
        "name which to sort by, and the second element is a boolean ",
        required=False,
        example=[["my_col_1", False], ["my_col_2", True]],
    )
    where = fields.String(
        description="WHERE clause to be added to queries using AND operator."
        "This field is deprecated and should be passed to `extras`.",
        required=False,
        deprecated=True,
    )
    having = fields.String(
        description="HAVING clause to be added to aggregate queries using "
        "AND operator. This field is deprecated and should be passed "
        "to `extras`.",
        required=False,
        deprecated=True,
    )
    having_filters = fields.List(
        fields.Dict(),
        description="HAVING filters to be added to legacy Druid datasource queries. "
        "This field is deprecated and should be passed to `extras` "
        "as `filters_druid`.",
        required=False,
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

    # pylint: disable=no-self-use
    @post_load
    def make_query_context(self, data: Dict[str, Any]) -> QueryContext:
        query_context = QueryContext(**data)
        return query_context

    # pylint: enable=no-self-use


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


CHART_DATA_SCHEMAS = (
    ChartDataQueryContextSchema,
    ChartDataResponseSchema,
    # TODO: These should optimally be included in the QueryContext schema as an `anyOf`
    #  in ChartDataPostPricessingOperation.options, but since `anyOf` is not
    #  by Marshmallow<3, this is not currently possible.
    ChartDataAdhocMetricSchema,
    ChartDataAggregateOptionsSchema,
    ChartDataPivotOptionsSchema,
    ChartDataRollingOptionsSchema,
    ChartDataSelectOptionsSchema,
    ChartDataSortOptionsSchema,
    ChartDataGeohashDecodeOptionsSchema,
    ChartDataGeohashEncodeOptionsSchema,
    ChartDataGeodeticParseOptionsSchema,
)
