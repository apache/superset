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

import logging
from typing import Any, TypedDict

from superset import app
from superset.commands.base import BaseCommand
from superset.commands.sql_lab.estimate import QueryEstimationCommand, EstimateQueryCostType

config = app.config
logger = logging.getLogger(__name__)


class CostThresholdResult(TypedDict):
    exceeds_threshold: bool
    estimated_cost: list[dict[str, Any]]
    threshold_info: dict[str, Any]
    formatted_warning: str | None


class QueryCostThresholdCheckCommand(BaseCommand):
    """
    Command to check if a query's estimated cost exceeds configured thresholds.
    """

    _estimation_command: QueryEstimationCommand

    def __init__(self, estimation_params: EstimateQueryCostType) -> None:
        self._estimation_command = QueryEstimationCommand(estimation_params)

    def validate(self) -> None:
        # Use the estimation command's validation
        self._estimation_command.validate()

    def run(self) -> CostThresholdResult:
        """
        Check if query cost exceeds thresholds.

        Returns a result indicating whether the query exceeds cost thresholds
        and provides information for user warnings.
        """
        self.validate()

        # Check if cost checking is enabled
        if not config.get("SQLLAB_QUERY_COST_CHECKING_ENABLED", False):
            return self._create_empty_result()

        estimated_cost = self._get_estimated_cost()
        if not estimated_cost:
            return self._create_empty_result()

        thresholds = self._get_engine_thresholds()
        if not thresholds:
            return CostThresholdResult(
                exceeds_threshold=False,
                estimated_cost=estimated_cost,
                threshold_info={},
                formatted_warning=None,
            )

        return self._check_thresholds(estimated_cost, thresholds)

    def _create_empty_result(self) -> CostThresholdResult:
        """Create an empty result when cost checking is disabled or fails."""
        return CostThresholdResult(
            exceeds_threshold=False,
            estimated_cost=[],
            threshold_info={},
            formatted_warning=None,
        )

    def _get_estimated_cost(self) -> list[dict[str, Any]] | None:
        """Get cost estimation, returning None if it fails."""
        try:
            return self._estimation_command.run()
        except Exception as ex:
            logger.warning("Cost estimation failed: %s", str(ex))
            return None

    def _get_engine_thresholds(self) -> dict[str, Any]:
        """Get thresholds for the current database engine."""
        database = self._estimation_command._database
        engine_name = database.db_engine_spec.engine_name
        if engine_name is None:
            return {}
        
        engine_name = engine_name.lower()
        return config.get("SQLLAB_QUERY_COST_THRESHOLDS", {}).get(engine_name, {})

    def _check_thresholds(
        self, estimated_cost: list[dict[str, Any]], thresholds: dict[str, Any]
    ) -> CostThresholdResult:
        """Check if estimated cost exceeds configured thresholds."""
        exceeds_threshold = False
        warning_messages = []
        threshold_info = {}

        for cost_item in estimated_cost:
            if self._check_bytes_threshold(cost_item, thresholds, threshold_info, warning_messages):
                exceeds_threshold = True
            if self._check_cost_threshold(cost_item, thresholds, threshold_info, warning_messages):
                exceeds_threshold = True

        formatted_warning = None
        if warning_messages:
            formatted_warning = (
                " ".join(warning_messages) + " Are you sure you want to continue?"
            )

        return CostThresholdResult(
            exceeds_threshold=exceeds_threshold,
            estimated_cost=estimated_cost,
            threshold_info=threshold_info,
            formatted_warning=formatted_warning,
        )

    def _check_bytes_threshold(
        self, 
        cost_item: dict[str, Any], 
        thresholds: dict[str, Any], 
        threshold_info: dict[str, Any], 
        warning_messages: list[str]
    ) -> bool:
        """Check bytes scanned threshold. Returns True if threshold exceeded."""
        if "bytes_scanned" not in thresholds or "Bytes Scanned" not in cost_item:
            return False
            
        try:
            bytes_scanned = self._parse_bytes_from_cost_item(cost_item["Bytes Scanned"])
            threshold_bytes = thresholds["bytes_scanned"]
            threshold_info["bytes_threshold"] = threshold_bytes
            threshold_info["estimated_bytes"] = bytes_scanned

            if bytes_scanned > threshold_bytes:
                warning_messages.append(
                    f"This query will scan approximately {self._format_bytes(bytes_scanned)} "
                    f"of data, which exceeds the threshold of {self._format_bytes(threshold_bytes)}."
                )
                return True
        except (ValueError, KeyError) as ex:
            logger.warning("Failed to parse bytes from cost estimation: %s", str(ex))
        
        return False

    def _check_cost_threshold(
        self, 
        cost_item: dict[str, Any], 
        thresholds: dict[str, Any], 
        threshold_info: dict[str, Any], 
        warning_messages: list[str]
    ) -> bool:
        """Check cost threshold. Returns True if threshold exceeded."""
        if "cost_threshold" not in thresholds or "Cost" not in cost_item:
            return False
            
        try:
            cost_value = float(cost_item["Cost"])
            threshold_cost = thresholds["cost_threshold"]
            threshold_info["cost_threshold"] = threshold_cost
            threshold_info["estimated_cost"] = cost_value

            if cost_value > threshold_cost:
                warning_messages.append(
                    f"This query has an estimated cost of {cost_value}, "
                    f"which exceeds the threshold of {threshold_cost}."
                )
                return True
        except (ValueError, KeyError) as ex:
            logger.warning("Failed to parse cost from cost estimation: %s", str(ex))
        
        return False

    def _parse_bytes_from_cost_item(self, bytes_str: str) -> int:
        """Parse bytes from formatted string like '5.2 GB' or '1024 MB'."""
        if not isinstance(bytes_str, str):
            return int(bytes_str)

        # Remove commas and split
        parts = bytes_str.replace(",", "").strip().split()
        if len(parts) != 2:
            raise ValueError(f"Cannot parse bytes from: {bytes_str}")

        value_str, unit = parts
        value = float(value_str)
        unit = unit.upper()

        multipliers = {
            "B": 1,
            "KB": 1024,
            "MB": 1024**2,
            "GB": 1024**3,
            "TB": 1024**4,
            "PB": 1024**5,
        }

        if unit not in multipliers:
            raise ValueError(f"Unknown unit: {unit}")

        return int(value * multipliers[unit])

    def _format_bytes(self, bytes_count: int) -> str:
        """Format bytes into human-readable string."""
        if bytes_count < 1024:
            return f"{bytes_count} B"
        elif bytes_count < 1024**2:
            return f"{bytes_count / 1024:.1f} KB"
        elif bytes_count < 1024**3:
            return f"{bytes_count / (1024**2):.1f} MB"
        elif bytes_count < 1024**4:
            return f"{bytes_count / (1024**3):.1f} GB"
        elif bytes_count < 1024**5:
            return f"{bytes_count / (1024**4):.1f} TB"
        else:
            return f"{bytes_count / (1024**5):.1f} PB"
