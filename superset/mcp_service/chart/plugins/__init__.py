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

"""
Chart type plugins package.

Importing this module registers all built-in chart type plugins in the global
registry. This module is imported by app.py at startup.

To add a new chart type:
1. Create ``superset/mcp_service/chart/plugins/{chart_type}.py``
2. Implement a class extending ``BaseChartPlugin``
3. Import and register it here
"""

from superset.mcp_service.chart.plugins.big_number import BigNumberChartPlugin
from superset.mcp_service.chart.plugins.handlebars import HandlebarsChartPlugin
from superset.mcp_service.chart.plugins.mixed_timeseries import (
    MixedTimeseriesChartPlugin,
)
from superset.mcp_service.chart.plugins.pie import PieChartPlugin
from superset.mcp_service.chart.plugins.pivot_table import PivotTableChartPlugin
from superset.mcp_service.chart.plugins.table import TableChartPlugin
from superset.mcp_service.chart.plugins.xy import XYChartPlugin
from superset.mcp_service.chart.registry import register

# Register all built-in chart type plugins
register(XYChartPlugin())
register(TableChartPlugin())
register(PieChartPlugin())
register(PivotTableChartPlugin())
register(MixedTimeseriesChartPlugin())
register(HandlebarsChartPlugin())
register(BigNumberChartPlugin())

__all__ = [
    "BigNumberChartPlugin",
    "HandlebarsChartPlugin",
    "MixedTimeseriesChartPlugin",
    "PieChartPlugin",
    "PivotTableChartPlugin",
    "TableChartPlugin",
    "XYChartPlugin",
]
