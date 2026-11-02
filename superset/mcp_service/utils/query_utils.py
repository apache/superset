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

"""Shared name validation for MCP tools.

The name-validator implementation lives in ``superset.common.tabular_query`` so the REST
endpoint and the MCP tools cannot drift apart.
"""

from superset.common.tabular_query import validate_names

__all__: list[str] = ["validate_names", "validate_selection_names"]


def validate_selection_names(
    selected_metrics: list[str],
    selected_dimensions: list[str],
    valid_metrics: set[str],
    valid_dimensions: set[str],
) -> list[str]:
    """Report unknown selected members using the shared validation messages."""
    return validate_names(selected_metrics, valid_metrics, "metric") + validate_names(
        selected_dimensions, valid_dimensions, "dimension"
    )
