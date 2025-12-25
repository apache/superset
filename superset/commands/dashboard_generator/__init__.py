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
Dashboard Generator Commands.

This package provides AI-powered dashboard generation from templates.

Main components:
- DashboardGeneratorCommand: Main entry point for generation
- AgenticDashboardGenerator: LangGraph-based iterative generator
- TemplateAnalyzer: Extracts requirements from template dashboards
- MappingService: Rule-based column/metric mapping with confidence scoring
- DashboardGeneratorLLMService: LLM service for AI-powered tasks
"""
from superset.commands.dashboard_generator.agentic_generator import (
    AgentPhase,
    AgenticDashboardGenerator,
    ChartValidationResult,
    DatasetValidationResult,
    FailedMapping,
    FilterValidationResult,
)
from superset.commands.dashboard_generator.generate import DashboardGeneratorCommand
from superset.commands.dashboard_generator.llm_service import (
    DashboardGeneratorLLMService,
)
from superset.commands.dashboard_generator.mapping_service import (
    ColumnMapping,
    ConfidenceLevel,
    MappingProposal,
    MappingService,
    MetricMapping,
)
from superset.commands.dashboard_generator.template_analyzer import (
    TemplateAnalyzer,
    TemplateColumn,
    TemplateMetric,
    TemplateRequirements,
)
from superset.commands.dashboard_generator.utils import (
    COLUMN_PARAMS,
    METRIC_PARAMS,
    prepare_database_report_data,
)

__all__ = [
    # Main command
    "DashboardGeneratorCommand",
    # Agentic generator
    "AgenticDashboardGenerator",
    "AgentPhase",
    "ChartValidationResult",
    "FilterValidationResult",
    "DatasetValidationResult",
    "FailedMapping",
    # Template analysis
    "TemplateAnalyzer",
    "TemplateRequirements",
    "TemplateColumn",
    "TemplateMetric",
    # Mapping service
    "MappingService",
    "MappingProposal",
    "ColumnMapping",
    "MetricMapping",
    "ConfidenceLevel",
    # LLM service
    "DashboardGeneratorLLMService",
    # Utilities
    "prepare_database_report_data",
    "COLUMN_PARAMS",
    "METRIC_PARAMS",
]
