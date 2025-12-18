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
Dashboard Generator Command.

This module provides the main entry point for dashboard generation.
It delegates to AgenticDashboardGenerator for the actual implementation.
"""
from __future__ import annotations

import logging
from typing import Any

from superset import db
from superset.commands.base import BaseCommand
from superset.commands.dashboard_generator.agentic_generator import (
    AgenticDashboardGenerator,
)
from superset.models.dashboard import Dashboard
from superset.models.dashboard_generator import DashboardGeneratorRun
from superset.models.database_analyzer import DatabaseSchemaReport

logger = logging.getLogger(__name__)


class DashboardGeneratorCommand(BaseCommand):
    """
    Command to generate a dashboard from a template using AI-powered mapping.

    This command delegates to AgenticDashboardGenerator, which implements
    an iterative, self-correcting approach to dashboard generation using
    LangGraph for orchestration.

    The generation process:
    1. Copies the template dashboard with all charts
    2. Generates a virtual dataset SQL from the user's schema
    3. Maps chart parameters to the new dataset
    4. Configures native filters
    5. Validates and refines iteratively until quality threshold is met

    Usage:
        command = DashboardGeneratorCommand(run_id=123)
        result = command.run()
    """

    def __init__(self, run_id: int):
        """
        Initialize the command.

        :param run_id: The DashboardGeneratorRun ID to execute
        """
        self.run_id = run_id
        self.generator_run: DashboardGeneratorRun | None = None
        self.report: DatabaseSchemaReport | None = None
        self.template_dashboard: Dashboard | None = None

    def run(self) -> dict[str, Any]:
        """
        Execute dashboard generation.

        Validates inputs and delegates to AgenticDashboardGenerator.

        :return: Result dictionary with status, dashboard_id, dataset_id, and metrics
        :raises ValueError: If run, report, or template not found
        """
        self.validate()

        # Delegate to agentic generator
        generator = AgenticDashboardGenerator()
        return generator.generate(self.run_id)

    def validate(self) -> None:
        """
        Validate that all required resources exist.

        :raises ValueError: If run, report, or template not found
        """
        self.generator_run = db.session.query(DashboardGeneratorRun).get(self.run_id)
        if not self.generator_run:
            raise ValueError(f"Run with id {self.run_id} not found")

        self.report = db.session.query(DatabaseSchemaReport).get(
            self.generator_run.database_report_id
        )
        if not self.report:
            raise ValueError(
                f"Database report with id {self.generator_run.database_report_id} not found"
            )

        self.template_dashboard = db.session.query(Dashboard).get(
            self.generator_run.template_dashboard_id
        )
        if not self.template_dashboard:
            raise ValueError(
                f"Template dashboard with id {self.generator_run.template_dashboard_id} not found"
            )
