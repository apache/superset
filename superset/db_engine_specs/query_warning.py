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

import math
from typing import (
    Any,
    Literal,
    NamedTuple,
    NotRequired,
    Protocol,
    TYPE_CHECKING,
    TypedDict,
)

from flask_babel import gettext as __, lazy_gettext as _
from marshmallow import (
    fields,
    INCLUDE,
    RAISE,
    Schema,
    validates_schema,
    ValidationError,
)

from superset import is_feature_enabled
from superset.utils.core import JS_MAX_INTEGER

if TYPE_CHECKING:
    from superset.models.core import Database


class QueryWarningDetail(TypedDict):
    """Plain-text information rendered by any warning confirmation UI."""

    label: str
    value: str


class QueryWarningProceed(TypedDict):
    """This check does not require confirmation, independent of other SQL controls."""

    action: Literal["proceed"]


class QueryWarningConfirm(TypedDict):
    """An advisory warning or an explanation of an unavailable assessment."""

    action: Literal["confirm"]
    reason: Literal["warning", "unavailable"]
    message: str
    details: NotRequired[list[QueryWarningDetail]]


QueryWarningResult = QueryWarningProceed | QueryWarningConfirm


class QueryWarningCheck(Protocol):
    """The engine-selected check used after SQL Lab prepares the intended query."""

    def validate(self, rule: dict[str, Any]) -> None:
        """Reject invalid settings without turning errors into permission to run."""
        ...

    def is_enabled(self, database: Database) -> bool:
        """Require connection opt-in and the check's prerequisites."""
        ...

    def assess(
        self,
        database: Database,
        catalog: str | None,
        schema: str,
        prepared_sql: str,
        rule: dict[str, Any],
    ) -> QueryWarningResult:
        """Assess prepared SQL and a validated rule without executing the query."""
        ...


class QueryCostWarningMetric(NamedTuple):
    """Native units, explanation and threshold requirements for a cost metric."""

    label: str
    unit: str
    requires_whole_bytes: bool
    explanation: str


QUERY_COST_WARNING_METRICS: dict[str, QueryCostWarningMetric] = {
    "bytes_processed": QueryCostWarningMetric(
        _("Estimated bytes processed"),
        _("bytes"),
        True,
        _("Estimated usage, not a guaranteed bill."),
    ),
    "total_cost": QueryCostWarningMetric(
        _("Estimated planner cost"),
        _("planner cost units"),
        False,
        _("Planner cost is relative, not dollars or memory."),
    ),
}


class QueryCostEstimate(NamedTuple):
    """An unrounded native estimate, its bounds and optional unavailability reason."""

    value: int | float | None = None
    accuracy: str | None = None
    unavailable_reason: str | None = None

    @classmethod
    def from_value(
        cls,
        value: object,
        accuracy: str | None = "PRECISE",
        unavailable_reason: str | None = None,
    ) -> QueryCostEstimate:
        """Preserve usable numeric values without coercion or display rounding."""
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or value < 0
            or (isinstance(value, float) and not math.isfinite(value))
        ):
            value = None
        return cls(value, accuracy, unavailable_reason)


def query_cost_warning_enabled_validator(value: object) -> None:
    """Require explicit boolean opt-in without coercing strings or numbers."""
    if not isinstance(value, bool):
        raise ValidationError(
            [_("The query cost warning enabled setting must be a boolean.")]
        )


def query_cost_warning_threshold_validator(value: object) -> None:
    """Accept positive numeric settings within the browser's safe integer range."""
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or value <= 0
        or (isinstance(value, float) and not math.isfinite(value))
    ):
        raise ValidationError(
            [_("The query cost warning threshold must be a positive finite number.")]
        )
    if value > JS_MAX_INTEGER:
        raise ValidationError(
            [
                _(
                    "The query cost warning threshold must be no greater than "
                    "9007199254740991."
                )
            ]
        )


class QueryWarningRuleSchema(Schema):
    """Validate shared opt-in while preserving fields owned by the engine check."""

    class Meta:
        unknown = INCLUDE

    enabled = fields.Raw(
        required=True,
        validate=query_cost_warning_enabled_validator,
        metadata={"type": "boolean"},
    )


class QueryCostWarningSchema(QueryWarningRuleSchema):
    """Validate numeric settings owned by a query cost threshold check."""

    class Meta:
        unknown = RAISE

    metric = fields.String()
    threshold = fields.Raw(
        validate=query_cost_warning_threshold_validator,
        metadata={
            "type": "number",
            "minimum": 0,
            "exclusiveMinimum": True,
            "maximum": JS_MAX_INTEGER,
        },
    )

    @validates_schema
    def validate_rule(self, data: dict[str, Any], **kwargs: Any) -> None:
        """Require enabled rules to be complete and byte thresholds to be exact."""
        metric_definition = QUERY_COST_WARNING_METRICS.get(data.get("metric", ""))
        if data["enabled"]:
            missing = {
                key: [_("An enabled query cost warning requires this field.")]
                for key in ("metric", "threshold")
                if key not in data
            }
            if missing:
                raise ValidationError(missing)
            if metric_definition is None:
                raise ValidationError(
                    {
                        "metric": [
                            _(
                                "The query cost warning metric is not supported "
                                "by this engine."
                            )
                        ]
                    }
                )
        threshold = data.get("threshold")
        if (
            metric_definition
            and metric_definition.requires_whole_bytes
            and threshold is not None
        ):
            if threshold != int(threshold):
                raise ValidationError(
                    {
                        "threshold": [
                            _(
                                "The query cost warning threshold must be whole bytes "
                                "no greater than 9007199254740991."
                            )
                        ]
                    }
                )


def validate_query_warning_rule(
    rule: object, check: QueryWarningCheck | None
) -> dict[str, Any]:
    """Validate shared settings and delegate check-specific fields to the engine."""
    validated = QueryWarningRuleSchema().load(rule)
    if check is not None:
        check.validate(validated)
    elif validated["enabled"]:
        raise ValidationError(
            {
                "extra": [
                    _("The query cost warning metric is not supported by this engine.")
                ]
            }
        )
    return validated


class QueryCostThresholdCheck:
    """Compare one native numeric threshold using the engine's estimation adapter."""

    def __init__(self, metric: str) -> None:
        """Bind this check to the engine's explicitly supported native metric."""
        self.metric = metric

    def validate(self, rule: dict[str, Any]) -> None:
        """Validate opt-in, numeric thresholds and the selected engine's metric."""
        validated = QueryCostWarningSchema().load(rule)
        if validated["enabled"] and validated["metric"] != self.metric:
            raise ValidationError(
                {
                    "metric": [
                        _(
                            "The query cost warning metric is not supported "
                            "by this engine."
                        )
                    ]
                }
            )

    def is_enabled(self, database: Database) -> bool:
        """Require estimation and an explicit connection warning opt-in."""
        return (
            is_feature_enabled("ESTIMATE_QUERY_COST")
            and database.allows_cost_estimate is True
            and database.get_extra().get("query_cost_warning", {}).get("enabled")
            is True
        )

    def assess(
        self,
        database: Database,
        catalog: str | None,
        schema: str,
        prepared_sql: str,
        rule: dict[str, Any],
    ) -> QueryWarningResult:
        """Compare a validated rule's raw values before formatting their bounds."""
        metric_definition = QUERY_COST_WARNING_METRICS[self.metric]
        details: list[QueryWarningDetail] = [
            {
                "label": __("Warning threshold"),
                "value": f"{rule['threshold']:,} {metric_definition.unit}",
            }
        ]
        estimate = database.db_engine_spec.estimate_query_cost_for_warning(
            database, catalog, schema, prepared_sql
        )
        estimate = QueryCostEstimate.from_value(
            estimate.value, estimate.accuracy, estimate.unavailable_reason
        )
        if (
            estimate.unavailable_reason
            or estimate.value is None
            or estimate.accuracy not in {"PRECISE", "LOWER_BOUND", "UPPER_BOUND"}
        ):
            return {
                "action": "confirm",
                "reason": "unavailable",
                "message": estimate.unavailable_reason
                or __(
                    "The estimate is unavailable or cannot establish whether "
                    "usage is within the warning threshold."
                ),
                "details": details,
            }
        exceeds_threshold = estimate.value > rule["threshold"]
        if not exceeds_threshold and estimate.accuracy != "LOWER_BOUND":
            return {"action": "proceed"}
        formatted_estimate = f"{estimate.value:,} {metric_definition.unit}"
        if estimate.accuracy == "LOWER_BOUND":
            formatted_estimate = __("At least %(value)s", value=formatted_estimate)
        elif estimate.accuracy == "UPPER_BOUND":
            formatted_estimate = __("Up to %(value)s", value=formatted_estimate)
        details.insert(
            0, {"label": str(metric_definition.label), "value": formatted_estimate}
        )
        message = (
            __("The estimate exceeds this connection's warning threshold.")
            if exceeds_threshold
            else __(
                "This lower-bound estimate cannot establish whether usage "
                "is within the warning threshold."
            )
        )
        return {
            "action": "confirm",
            "reason": "warning" if exceeds_threshold else "unavailable",
            "message": f"{message} {metric_definition.explanation}",
            "details": details,
        }
