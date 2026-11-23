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
"""Visualization compatibility policy for semantic-view charts and images."""

from flask_babel import lazy_gettext as _
from flask_babel.speaklater import LazyString

from superset.exceptions import QueryObjectValidationError

UNSUPPORTED_SEMANTIC_CHART_TYPES: dict[str, LazyString] = {
    "histogram_v2": _(
        "Histogram is not yet supported on semantic views. "
        "Use a Bar or Table chart with an explicit count metric."
    ),
    "cal_heatmap": _(
        "Calendar Heatmap is not yet supported on semantic views. "
        "Use a Line or Bar chart."
    ),
    "time_table": _(
        "Time-series Table is not yet supported on semantic views. "
        "Use a Table chart with an explicit time dimension."
    ),
    "time_pivot": _(
        "Time-series Period Pivot is not yet supported on semantic views. "
        "Use a Line or Bar chart."
    ),
    "rose": _(
        "Nightingale Rose is not yet supported on semantic views. "
        "Use a Line or Bar chart."
    ),
    "horizon": _(
        "Horizon is not yet supported on semantic views. Use a Line or Bar chart."
    ),
    "paired_ttest": _(
        "Paired t-test is not yet supported on semantic views. "
        "Use a Table chart to inspect the metric by time."
    ),
}


def validate_semantic_chart_type(datasource_type: str, viz_type: object) -> None:
    """Reject visualizations whose input contract semantic views cannot supply."""
    if datasource_type != "semantic_view" or viz_type is None:
        return
    if not isinstance(viz_type, str):
        raise QueryObjectValidationError(str(_("Chart type must be a string.")))
    message: LazyString | None = UNSUPPORTED_SEMANTIC_CHART_TYPES.get(viz_type)
    if message:
        raise QueryObjectValidationError(str(message))
