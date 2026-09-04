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
Unified Contribution Processing System

This module provides a centralized system for processing pending contributions
from decorators across all contribution types (extension APIs, MCP tools, tasks, etc.)
after extension loading when publisher/name context is available.
"""

import logging
from typing import Protocol

from superset_core.extensions.types import Manifest

logger = logging.getLogger(__name__)


class ContributionProcessor(Protocol):
    """Protocol for contribution processor functions."""

    def __call__(self, manifest: Manifest) -> None:
        """Process pending contributions for an extension."""
        ...


class ContributionProcessorRegistry:
    """Registry for contribution processors from different decorator systems."""

    def __init__(self) -> None:
        self._processors: list[ContributionProcessor] = []

    def register_processor(self, processor: ContributionProcessor) -> None:
        """Register a contribution processor function."""
        self._processors.append(processor)
        logger.debug(
            "Registered contribution processor: %s",
            getattr(processor, "__name__", repr(processor)),
        )

    def process_all_contributions(self, manifest: Manifest) -> None:
        """Process all pending contributions for an extension."""
        logger.debug(
            "Processing %d contribution processors for %s",
            len(self._processors),
            manifest.id,
        )

        for processor in self._processors:
            try:
                processor(manifest)
            except Exception as e:
                logger.error(
                    "Failed to process contributions with %s for %s: %s",
                    getattr(processor, "__name__", repr(processor)),
                    manifest.id,
                    e,
                )


# Global registry instance
_contribution_registry = ContributionProcessorRegistry()


def register_contribution_processor(processor: ContributionProcessor) -> None:
    """Register a contribution processor function."""
    _contribution_registry.register_processor(processor)


def process_extension_contributions(manifest: Manifest) -> None:
    """Process all pending contributions for an extension."""
    _contribution_registry.process_all_contributions(manifest)


__all__ = [
    "ContributionProcessor",
    "register_contribution_processor",
    "process_extension_contributions",
]
