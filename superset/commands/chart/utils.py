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
from datetime import datetime
from typing import Any

from flask import g
from marshmallow import ValidationError

from superset.commands.chart.exceptions import (
    ChartQueryContextDatasourceMismatchValidationError,
)
from superset.commands.exceptions import DatasourceTypeInvalidError
from superset.utils import json
from superset.utils.core import DatasourceType


def validate_chart_datasource_type(datasource_type: str) -> None:
    """Accept persistent chart sources with names and type-aware access policies.

    SQL Lab queries are registered datasource types but are not persistent
    chart sources; accepting all DatasourceDAO registrations would include them.
    """
    if datasource_type not in (DatasourceType.TABLE, DatasourceType.SEMANTIC_VIEW):
        raise DatasourceTypeInvalidError()


def validate_query_context_datasource(
    raw_query_context: Any,
    expected_datasource_id: Any,
    expected_datasource_type: Any,
    exceptions: list[ValidationError],
) -> None:
    """
    Ensure a submitted query context targets the expected datasource.

    Shared by the chart create and update commands so both apply the same
    binding. The query context is only checked when it carries a parseable
    ``datasource`` object; a payload that references a different datasource than
    the expected one is rejected. A payload without a datasource falls back to
    the chart's datasource at execution time and needs no check.
    """
    if not raw_query_context:
        return

    try:
        query_context = json.loads(raw_query_context)
    except (TypeError, ValueError):
        # A query context that isn't a parseable JSON string (e.g. an
        # already-parsed dict, or an unparseable string) is left for downstream
        # handling rather than guessed at.
        return

    datasource = (
        query_context.get("datasource") if isinstance(query_context, dict) else None
    )
    if not isinstance(datasource, dict):
        return

    try:
        ids_match = int(datasource["id"]) == int(expected_datasource_id)
    except (KeyError, TypeError, ValueError):
        ids_match = False

    # A datasource object must carry a type that matches the expected one.
    # Treating a missing type as valid would let an id-only payload through,
    # and query-context loading reads datasource["type"] directly, so that
    # payload raises KeyError when the saved context is later replayed.
    types_match = str(datasource.get("type")) == str(expected_datasource_type)

    if not ids_match or not types_match:
        exceptions.append(ChartQueryContextDatasourceMismatchValidationError())


def touch_dashboards(dashboards: list[Any] | None) -> None:
    """
    Touch the audit metadata (changed_on and changed_by) for the given dashboards.

    When charts are linked to dashboards during chart creation or update,
    this ensures the dashboard's last modified timestamp reflects the change
    (issue #44305).

    :param dashboards: list of Dashboard models to touch.
    """
    if not dashboards:
        return
    now = datetime.now()
    user = getattr(g, "user", None)
    for dashboard in dashboards:
        dashboard.changed_on = now
        if user is not None:
            dashboard.changed_by = user
