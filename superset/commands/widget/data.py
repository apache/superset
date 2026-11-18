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

from functools import partial
from typing import Any
from uuid import UUID

from superset_core.widgets import BindingRequest

from superset.canvas.data import PlacementData, run_binding, RuntimeFilter
from superset.commands.base import BaseCommand
from superset.commands.canvas.placement_data import select_binding
from superset.commands.widget.exceptions import (
    WidgetNotFoundError,
    WidgetUnboundError,
)
from superset.daos.widget import WidgetDAO


class GetWidgetDataCommand(BaseCommand):
    """
    Run a saved widget's query as the caller, as a placement of it would.

    The query comes from the widget's stored props, or from its widget type's
    binding resolver for a named binding; the caller only adds runtime
    filters. Reading needs access to the widget, which ``WidgetDAO``'s filter
    checks, and to the binding's dataset, which the chart data pipeline does.
    """

    def __init__(
        self,
        widget_uuid: UUID,
        runtime_filters: list[RuntimeFilter],
        binding_name: str | None = None,
    ) -> None:
        self._widget_uuid = widget_uuid
        self._runtime_filters = runtime_filters
        self._binding_name = binding_name
        self._binding: dict[str, Any] = {}

    def run(self) -> PlacementData:
        self.validate()
        return run_binding(self._binding, self._runtime_filters)

    def validate(self) -> None:
        widget = WidgetDAO.find_one_or_none(uuid=self._widget_uuid)
        if widget is None:
            raise WidgetNotFoundError(str(self._widget_uuid))
        props = dict(widget.props or {})
        binding = select_binding(
            widget.widget_type,
            props,
            self._binding_name,
            partial(
                BindingRequest, None, None, props, widget_id=str(self._widget_uuid)
            ),
        )
        if binding is None:
            raise WidgetUnboundError()
        self._binding = binding
