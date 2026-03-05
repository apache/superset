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
User-friendly display names for chart viz_type identifiers.

This module re-exports from the authoritative chart type registry
at ``superset.charts.chart_types``.  Kept for backward compatibility
with existing imports.
"""

from superset.charts.chart_types import (
    CHART_TYPE_NAMES as VIZ_TYPE_DISPLAY_NAMES,
    get_chart_type_display_name as get_viz_type_display_name,
)

__all__ = [
    "VIZ_TYPE_DISPLAY_NAMES",
    "get_viz_type_display_name",
]
