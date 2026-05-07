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
ChartTypePlugin protocol and BaseChartPlugin base class.

Each chart type owns its pre-validation, column extraction, form_data mapping,
and post-map validation in a single plugin class. This eliminates the previous
pattern of 4 separate dispatch points (schema_validator.py, dataset_validator.py,
chart_utils.py, pipeline.py) that had to be updated in sync whenever a new chart
type was added.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from superset.mcp_service.chart.schemas import ColumnRef
from superset.mcp_service.common.error_schemas import ChartGenerationError


@runtime_checkable
class ChartTypePlugin(Protocol):
    """
    Protocol that every chart-type plugin must satisfy.

    Implementing all eight methods in a single class guarantees that adding a
    new chart type requires only one new file — the plugin — rather than edits
    across multiple separate files.
    """

    #: Discriminator value matching ChartConfig's chart_type field.
    chart_type: str

    #: Human-readable name shown to users (e.g. "Line / Bar / Area / Scatter").
    display_name: str

    #: Maps every Superset-internal viz_type this plugin can produce to a
    #: user-facing display name, e.g. {"echarts_timeseries_line": "Line Chart"}.
    #: Used by the registry to resolve display names for existing charts without
    #: needing a separate JSON mapping file.
    native_viz_types: dict[str, str]

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        """
        Early validation of the raw config dict before Pydantic parsing.

        Called by SchemaValidator before attempting to parse the request.
        Should check that required top-level keys are present and well-typed.

        Returns None if valid, ChartGenerationError if invalid.
        """
        ...

    def extract_column_refs(
        self,
        config: Any,
    ) -> list[ColumnRef]:
        """
        Extract all column references from a parsed chart config.

        Called by DatasetValidator to validate that all referenced columns exist
        in the dataset. Must cover every field that holds a column name,
        including filters.

        Returns a list of ColumnRef objects (may be empty).
        """
        ...

    def to_form_data(
        self,
        config: Any,
        dataset_id: int | str | None = None,
    ) -> dict[str, Any]:
        """
        Map a parsed chart config to Superset's internal form_data dict.

        Replaces the if/elif chain in chart_utils.map_config_to_form_data().

        Returns a Superset form_data dict ready for caching and rendering.
        """
        ...

    def post_map_validate(
        self,
        config: Any,
        form_data: dict[str, Any],
        dataset_id: int | str | None = None,
    ) -> ChartGenerationError | None:
        """
        Validate the mapped form_data after to_form_data() runs.

        Use this for cross-field constraints that can only be checked once
        form_data is assembled (e.g. BigNumber trendline requires a temporal
        column whose type must be verified against the dataset).

        Returns None if valid, ChartGenerationError if invalid.
        """
        ...

    def normalize_column_refs(
        self,
        config: Any,
        dataset_context: Any,
    ) -> Any:
        """
        Return a new config with column names normalized to canonical dataset casing.

        Called by DatasetValidator.normalize_column_names(). The default
        implementation (in BaseChartPlugin) returns the config unchanged; plugins
        with column fields override this to fix case sensitivity mismatches.

        Returns a new config object (or the original if no normalization needed).
        """
        ...

    def get_runtime_warnings(
        self,
        config: Any,
        dataset_id: int | str,
    ) -> list[str]:
        """
        Return chart-type-specific runtime warnings (performance, compatibility).

        Called by RuntimeValidator to collect per-type warnings. Warnings are
        informational only — they never block chart generation. The default
        implementation returns an empty list; plugins override this to emit
        chart-type-specific warnings (e.g. XY cardinality checks).

        Returns a list of warning message strings (may be empty).
        """
        ...

    def generate_name(
        self,
        config: Any,
        dataset_name: str | None = None,
    ) -> str:
        """
        Return a descriptive chart name for the given config.

        Called by chart_utils.generate_chart_name(). The name should follow
        the standard format conventions documented in that function. Plugins
        that do not override this return the generic fallback "Chart".
        """
        ...

    def resolve_viz_type(self, config: Any) -> str:
        """
        Return the Superset-internal viz_type string for this config.

        Called by chart_utils._resolve_viz_type(). The returned string must
        match a registered Superset viz plugin (e.g. "echarts_timeseries_line").
        Plugins that do not override this return "unknown".
        """
        ...


class BaseChartPlugin:
    """
    Base class providing sensible defaults for all ChartTypePlugin methods.

    Concrete plugins extend this and override only what they need.
    """

    chart_type: str = ""
    display_name: str = ""
    native_viz_types: dict[str, str] = {}

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        return None

    def extract_column_refs(
        self,
        config: Any,
    ) -> list[ColumnRef]:
        return []

    def to_form_data(
        self,
        config: Any,
        dataset_id: int | str | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError(
            f"{self.__class__.__name__}.to_form_data() is not implemented"
        )

    def post_map_validate(
        self,
        config: Any,
        form_data: dict[str, Any],
        dataset_id: int | str | None = None,
    ) -> ChartGenerationError | None:
        return None

    def normalize_column_refs(
        self,
        config: Any,
        dataset_context: Any,
    ) -> Any:
        return config

    def get_runtime_warnings(
        self,
        config: Any,
        dataset_id: int | str,
    ) -> list[str]:
        return []

    def generate_name(
        self,
        config: Any,
        dataset_name: str | None = None,
    ) -> str:
        return "Chart"

    def resolve_viz_type(self, config: Any) -> str:
        return "unknown"

    @staticmethod
    def _with_context(what: str, context: str | None) -> str:
        """Combine a 'what' label and optional context with an en-dash."""
        return f"{what} – {context}" if context else what
