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
"""A saved widget's data, queried on its own, without a canvas."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from superset.canvas.data import PlacementData, run_binding, RuntimeFilter
from superset.canvas.query_errors import canvas_query_error, CanvasQueryFailedError
from superset.commands.base import BaseCommand
from superset.commands.widget.exceptions import (
    WidgetNotFoundError,
    WidgetUnboundError,
)
from superset.daos.widget import WidgetDAO


class GetWidgetDataCommand(BaseCommand):
    """
    Run a saved widget's query as the caller, as a placement of it would.

    The query comes from the widget's stored ``dataBinding``; the caller only
    adds runtime filters. Reading needs access to the widget, which
    ``WidgetDAO``'s filter checks, and to the binding's dataset, which the
    chart data pipeline does.
    """

    def __init__(self, widget_uuid: UUID, runtime_filters: list[RuntimeFilter]) -> None:
        self._widget_uuid = widget_uuid
        self._runtime_filters = runtime_filters
        self._binding: dict[str, Any] = {}

    def run(self) -> PlacementData:
        self.validate()
        try:
            return run_binding(self._binding, self._runtime_filters)
        except Exception as ex:  # pylint: disable=broad-except
            raise CanvasQueryFailedError(canvas_query_error(ex)) from ex

    def validate(self) -> None:
        widget = WidgetDAO.find_one_or_none(uuid=self._widget_uuid)
        if widget is None:
            raise WidgetNotFoundError(str(self._widget_uuid))
        binding = (widget.props or {}).get("dataBinding")
        if not isinstance(binding, dict) or not isinstance(
            binding.get("datasetId"), int
        ):
            raise WidgetUnboundError()
        self._binding = binding
