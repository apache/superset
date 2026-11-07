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
from marshmallow import EXCLUDE, fields, Schema, validate

CHART_RANGES_MAX_CHARTS = 50


class TimeRangeLimitsRuleSchema(Schema):
    quantity = fields.Integer(metadata={"description": "How many time grains."})
    time_grain = fields.String(
        metadata={"description": "The ISO 8601 time grain, e.g. P1W."}
    )


class TimeRangeLimitsPolicySchema(Schema):
    max_span = fields.Nested(TimeRangeLimitsRuleSchema, allow_none=True)
    max_look_back = fields.Nested(TimeRangeLimitsRuleSchema, allow_none=True)
    max_look_forward = fields.Nested(TimeRangeLimitsRuleSchema, allow_none=True)


class TimeRangeLimitsTimeGrainSchema(Schema):
    value = fields.String()
    label = fields.String()


class TimeRangeLimitsDisplayLabelsSchema(Schema):
    max_span = fields.String(
        allow_none=True, metadata={"description": "e.g. 12 weeks; null when unset."}
    )
    max_look_back = fields.String(
        allow_none=True, metadata={"description": "e.g. 12 weeks; null when unset."}
    )
    max_look_forward = fields.String(
        allow_none=True, metadata={"description": "e.g. 12 weeks; null when unset."}
    )


class TimeRangeLimitsResponseSchema(Schema):
    schema_version = fields.Integer()
    revision = fields.Integer(
        metadata={"description": "Always 0: the global policy comes from config."}
    )
    policy = fields.Nested(TimeRangeLimitsPolicySchema)
    display_labels = fields.Nested(TimeRangeLimitsDisplayLabelsSchema)
    eligible_time_grains = fields.List(
        fields.Nested(TimeRangeLimitsTimeGrainSchema),
        metadata={"description": "The time grains a rule may use."},
    )


class TimeRangeLimitsConstraintSchema(TimeRangeLimitsRuleSchema):
    source = fields.String(metadata={"description": "global or dashboard"})


class TimeRangeLimitsEffectiveRuleSchema(Schema):
    constraints = fields.List(fields.Nested(TimeRangeLimitsConstraintSchema))
    display_label = fields.String()


class TimeRangeLimitsEffectiveSchema(Schema):
    active = fields.Boolean()
    max_span = fields.Nested(TimeRangeLimitsEffectiveRuleSchema)
    max_look_back = fields.Nested(TimeRangeLimitsEffectiveRuleSchema)
    max_look_forward = fields.Nested(TimeRangeLimitsEffectiveRuleSchema)


class TimeRangeLimitsNeedsReviewSchema(Schema):
    rule = fields.String()
    reason = fields.String(
        metadata={"description": "LOOSER_THAN_GLOBAL or UNIT_MISMATCH"}
    )


class TimeRangeLimitsDatasetErrorSchema(Schema):
    message = fields.String()
    error_type = fields.String()
    extra = fields.Dict(
        metadata={
            "description": (
                "POLICY_UNAVAILABLE details; stored value is included only "
                "for dataset editors on GET and is omitted on PUT."
            )
        }
    )


class TimeRangeLimitsDatasetSchema(Schema):
    id = fields.Integer()
    name = fields.String()
    policy = fields.Nested(TimeRangeLimitsPolicySchema, allow_none=True)
    error = fields.Nested(
        TimeRangeLimitsDatasetErrorSchema,
        metadata={
            "description": (
                "Present when this dataset's policy cannot be loaded; policy is null. "
                "Only this dataset's charts must remain held."
            )
        },
    )


class TimeRangeLimitsEditorNoticeSchema(Schema):
    kind = fields.String(
        validate=validate.OneOf(["turned_on", "tightened"]),
        metadata={"description": "turned_on or tightened"},
    )


class TimeRangeLimitsDashboardSchema(Schema):
    schema_version = fields.Integer()
    global_revision = fields.Integer(metadata={"description": "Always 0."})
    global_ = fields.Nested(TimeRangeLimitsPolicySchema, data_key="global")
    dashboard = fields.Nested(TimeRangeLimitsPolicySchema)
    effective = fields.Nested(TimeRangeLimitsEffectiveSchema)
    needs_review = fields.List(fields.Nested(TimeRangeLimitsNeedsReviewSchema))
    datasets = fields.List(
        fields.Nested(TimeRangeLimitsDatasetSchema),
        metadata={
            "description": (
                "The dashboard's chart datasets with a policy "
                "that the caller can read, "
                "including authorized embedded member datasets. Datasets the caller "
                "cannot read are omitted; their charts are not held client-side "
                "because of that omission and retain server access "
                "and limit checks."
            )
        },
    )
    timezone = fields.String(
        metadata={
            "description": (
                "The server's time zone, to show: an IANA name when TZ is set, "
                "else an abbreviation such as CEST."
            )
        }
    )
    eligible_time_grains = fields.List(
        fields.Nested(TimeRangeLimitsTimeGrainSchema),
        metadata={"description": "The time grains a rule may use."},
    )
    time_grain_labels = fields.Dict(
        keys=fields.String(),
        values=fields.String(),
        metadata={
            "description": (
                "The label of every time grain the registry knows, eligible or "
                "not, by value."
            )
        },
    )
    editor_notice = fields.Nested(
        TimeRangeLimitsEditorNoticeSchema,
        allow_none=True,
        metadata={
            "description": (
                "The notice the current user gets as a dashboard editor when the "
                "global time range limits turned on or got stricter since they "
                "acknowledged them; null for everyone else."
            )
        },
    )


class TimeRangeLimitsDatasetLimitsSchema(Schema):
    schema_version = fields.Integer()
    global_revision = fields.Integer(metadata={"description": "Always 0."})
    global_ = fields.Nested(TimeRangeLimitsPolicySchema, data_key="global")
    dataset = fields.Nested(TimeRangeLimitsPolicySchema)
    needs_review = fields.List(fields.Nested(TimeRangeLimitsNeedsReviewSchema))
    eligible_time_grains = fields.List(
        fields.Nested(TimeRangeLimitsTimeGrainSchema),
        metadata={"description": "The time grains a rule may use."},
    )
    time_grain_labels = fields.Dict(
        keys=fields.String(),
        values=fields.String(),
        metadata={
            "description": (
                "The label of every time grain the registry knows, eligible or "
                "not, by value."
            )
        },
    )


# ``policy`` takes any value, so a bad policy gets the policy errors, not FAB's 400.
get_time_range_limits_charts_schema = {
    "type": "object",
    "properties": {"policy": {}},
}


class TimeRangeLimitsChartLinkSchema(Schema):
    id = fields.Integer()
    slice_name = fields.String()
    url = fields.String(metadata={"description": "The chart's Explore URL."})


class TimeRangeLimitsRefusedChartSchema(TimeRangeLimitsChartLinkSchema):
    range = fields.String(
        allow_none=True,
        metadata={"description": "The chart's saved time range; null: No filter."},
    )
    time_offset = fields.String(
        allow_none=True,
        metadata={"description": "The time comparison that fails, else null."},
    )
    reason_code = fields.String()
    rule = fields.String(allow_none=True)
    source = fields.String(allow_none=True)
    message = fields.String()


class TimeRangeLimitsRefusedFilterSchema(Schema):
    id = fields.String()
    name = fields.String()
    range = fields.String(
        allow_none=True, metadata={"description": "The filter's default value."}
    )
    no_default = fields.Boolean(
        metadata={"description": "The filter has no default, or No filter."}
    )
    reason_code = fields.String(allow_none=True)
    rule = fields.String(allow_none=True)
    source = fields.String(allow_none=True)
    message = fields.String(allow_none=True)


class TimeRangeLimitsChartsSchema(Schema):
    charts = fields.List(
        fields.Nested(TimeRangeLimitsRefusedChartSchema),
        metadata={"description": "The saved charts the policy would refuse."},
    )
    filters = fields.List(
        fields.Nested(TimeRangeLimitsRefusedFilterSchema),
        metadata={"description": "The time range filter defaults it would refuse."},
    )
    unlimited = fields.List(
        fields.Nested(TimeRangeLimitsChartLinkSchema),
        metadata={"description": "Charts on a dataset with no temporal column."},
    )
    unchecked = fields.List(
        fields.Nested(TimeRangeLimitsChartLinkSchema),
        metadata={"description": "Charts whose query can't be built."},
    )
    truncated = fields.Boolean(
        metadata={
            "description": "The dashboard or dataset has more readable charts than "
            "the first 50 checked."
        }
    )


class ChartRangesEntrySchema(Schema):
    key = fields.String(metadata={"description": "The caller's name for the chart."})
    query_context = fields.Dict(
        metadata={"description": "The body the chart sends to /api/v1/chart/data."}
    )


class ChartRangesRequestSchema(Schema):
    class Meta:  # pylint: disable=too-few-public-methods
        unknown = EXCLUDE

    charts = fields.List(
        fields.Raw(),
        required=True,
        validate=validate.Length(max=CHART_RANGES_MAX_CHARTS),
        metadata={
            "description": "One entry per chart, at most 50: a key with its "
            "`query_context`."
        },
    )


class ChartRangeSourceSchema(Schema):
    kind = fields.String(
        metadata={
            "description": "time_range, adhoc_filter, granularity, time_comparison "
            "or time_shift."
        }
    )
    query_index = fields.Integer(metadata={"description": "The query it is in."})
    index = fields.Integer(
        allow_none=True,
        metadata={
            "description": "The filter's index in the query's filters, or the time "
            "comparison's index; null otherwise."
        },
    )


class ChartRangeSchema(Schema):
    since = fields.String(allow_none=True, metadata={"description": "Naive ISO."})
    until = fields.String(allow_none=True, metadata={"description": "Naive ISO."})
    time_offset = fields.String(
        allow_none=True, metadata={"description": "The time comparison, if any."}
    )
    source = fields.List(
        fields.Nested(ChartRangeSourceSchema),
        allow_none=True,
        metadata={"description": "Where the range comes from; null when unknown."},
    )


class ChartRangesErrorSchema(Schema):
    status = fields.Integer(metadata={"description": "The chart route's status."})
    body = fields.Dict(metadata={"description": "The chart route's JSON body."})


class ChartRangesChartSchema(Schema):
    key = fields.String()
    status = fields.String(metadata={"description": "ok or error."})
    ranges = fields.List(fields.Nested(ChartRangeSchema))
    dataset_id = fields.Integer(allow_none=True)
    dashboard_id = fields.Integer(
        allow_none=True,
        metadata={"description": "The dashboard whose limits apply, if any."},
    )
    error = fields.Nested(ChartRangesErrorSchema)


class ChartRangesResponseSchema(Schema):
    now = fields.String(metadata={"description": "The server clock, naive ISO."})
    today = fields.String(metadata={"description": "Midnight of now, naive ISO."})
    timezone = fields.String()
    charts = fields.List(fields.Nested(ChartRangesChartSchema))
