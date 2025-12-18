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
Agentic Dashboard Generator using LangGraph.

Implements a comprehensive agentic approach with nested iteration loops:

Phase 1: SETUP - Copy template dashboard (no iteration)
Phase 2: REQUIREMENTS - Collect ALL chart/filter requirements upfront (no iteration)
Phase 3: DATASET - Generate and validate SQL with internal retry loop
Phase 4: CHARTS - Per-chart iteration loops with real query execution
Phase 5: FILTERS - Per-filter iteration loops with real validation
Phase 6: QUALITY ASSESSMENT - Calculate scores, decide if escalation needed
Phase 7: HUMAN REVIEW - Batched collection (only if retries exhausted)
Phase 8: APPLY FIXES - Apply all user fixes at once

Key Architecture:
- Each phase iterates internally until resolution OR exhaustion
- No backtracking between phases (dataset frozen after Phase 3)
- Real validation via query execution
- Human review only when truly stuck after max retries
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Literal, TypedDict

from flask import g

from superset.commands.dashboard_generator.llm_service import (
    DashboardGeneratorLLMService,
)
from superset.commands.dashboard_generator.mapping_service import (
    MappingProposal,
    MappingService,
)
from superset.commands.dashboard_generator.template_analyzer import (
    TemplateAnalyzer,
    TemplateRequirements,
)
from superset.commands.dashboard_generator.utils import prepare_database_report_data
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dashboard import DashboardDAO
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.database_analyzer import DatabaseSchemaReport
from superset.models.dashboard_generator import (
    DashboardGeneratorRun,
    GeneratorStatus,
)
from superset.models.slice import Slice
from superset.utils import json

from langgraph.graph import END, START, StateGraph

logger = logging.getLogger(__name__)

# Configuration - Iteration limits per phase
MAX_DATASET_ATTEMPTS = 3  # Iterations for dataset SQL generation
MAX_CHART_ATTEMPTS = 3  # Iterations per individual chart (includes fallback)
MAX_FILTER_ATTEMPTS = 2  # Iterations per individual filter
QUALITY_THRESHOLD = 0.85  # Auto-finalize if ≥85% working


class AgentPhase(str, Enum):
    """Current phase in the agentic loop."""

    INIT = "init"
    COLLECT_REQUIREMENTS = "collect_requirements"
    GENERATE_DATASET = "generate_dataset"
    REFINE_MAPPINGS = "refine_mappings"
    UPDATE_CHARTS = "update_charts"
    UPDATE_FILTERS = "update_filters"
    QUALITY_ASSESSMENT = "quality_assessment"
    HUMAN_REVIEW = "human_review"
    APPLY_FIXES = "apply_fixes"
    FINALIZE = "finalize"


@dataclass
class ChartValidationResult:
    """Result of validating a single chart."""

    chart_id: int
    chart_name: str
    success: bool
    error_message: str | None = None
    attempts: int = 0
    query_executed: bool = False


@dataclass
class FilterValidationResult:
    """Result of validating a single filter."""

    filter_id: str
    filter_name: str
    success: bool
    error_message: str | None = None
    attempts: int = 0
    query_executed: bool = False


@dataclass
class DatasetValidationResult:
    """Result of validating the generated dataset."""

    success: bool
    error_message: str | None = None
    actual_columns: list[str] = field(default_factory=list)
    actual_types: dict[str, str] = field(default_factory=dict)  # column_name -> type
    missing_columns: list[str] = field(default_factory=list)
    attempts: int = 0


@dataclass
class FailedMapping:
    """Represents a failed mapping that needs user intervention."""

    item_type: str  # 'chart', 'filter', 'dataset_column'
    item_id: str
    item_name: str
    error_reason: str
    available_alternatives: list[str] = field(default_factory=list)
    suggested_fix: str | None = None
    is_inapplicable: bool = False  # True if cannot be adapted to new dataset
    inapplicability_reason: str | None = None  # Why it's inapplicable
    can_be_removed: bool = True  # Whether user can choose to remove it


class GeneratorState(TypedDict):
    """
    Complete state for the agentic generator workflow.

    This state flows through all nodes and accumulates results,
    errors, and refinement history.
    """

    # Input references
    run_id: int
    database_report_id: int
    template_dashboard_id: int
    owner_id: int | None  # User who initiated the generation

    # Loaded objects (populated during init)
    template_requirements: TemplateRequirements | None
    database_report_data: dict[str, Any] | None
    mapping_proposal: MappingProposal | None

    # Generated artifacts
    generated_dashboard_id: int | None
    generated_dataset_id: int | None
    dataset_sql: str | None

    # Mappings (from MappingService + LLM refinement)
    column_mappings: dict[str, str]
    metric_mappings: dict[str, str]

    # Dataset validation with actual columns
    dataset_validation: DatasetValidationResult | None
    dataset_actual_columns: list[str]
    dataset_actual_types: dict[str, str]

    # Per-chart and per-filter tracking
    chart_results: dict[int, ChartValidationResult]
    filter_results: dict[str, FilterValidationResult]

    # Counters
    charts_working: int
    charts_failed: int
    filters_working: int
    filters_failed: int

    # Quality metrics
    overall_quality: float

    # Failed mappings for human review (batched)
    failed_mappings: list[FailedMapping]

    # Human review (only if retries exhausted)
    requires_human_review: bool
    review_reasons: list[str]

    # Completion
    current_phase: str
    is_complete: bool
    error: str | None


class AgenticDashboardGenerator:
    """
    Agentic dashboard generator with nested iteration loops.

    Architecture:
    - Phase 1: Copy template dashboard (get chart IDs, positions for free)
    - Phase 2: Collect ALL requirements from charts AND filters upfront
    - Phase 3: Generate dataset with internal retry loop (frozen after success)
    - Phase 4: Per-chart iteration loops with real query execution
    - Phase 5: Per-filter iteration loops with real validation
    - Phase 6: Quality assessment and escalation decision
    - Phase 7-8: Batched human review (only if stuck after retries)
    """

    def __init__(self, use_graph: bool = False) -> None:
        """
        Initialize the agentic generator.

        :param use_graph: If True, use LangGraph state machine. If False, use
                         sequential execution (simpler, easier to debug).
        """
        self.llm_service = DashboardGeneratorLLMService()
        self.mapping_service = MappingService()
        self.template_analyzer = TemplateAnalyzer()
        self.use_graph = use_graph
        # Cache dataset datetime bounds per run to avoid repeated scans
        self.dataset_time_bounds: dict[int, tuple[str | None, str | None]] = {}

        if use_graph:
            self.graph = self._build_graph()
        else:
            self.graph = None

    def generate(self, run_id: int) -> dict[str, Any]:
        """
        Execute agentic dashboard generation.

        :param run_id: DashboardGeneratorRun ID
        :return: Result dictionary with status, IDs, and metrics
        """
        run = db.session.query(DashboardGeneratorRun).get(run_id)
        if not run:
            raise ValueError(f"Run {run_id} not found")

        initial_state = self._create_initial_state(run)

        if self.use_graph and self.graph:
            return self._run_agentic(initial_state, run)
        else:
            return self._run_sequential(initial_state, run)

    def _build_graph(self) -> StateGraph:
        """
        Build the LangGraph workflow with nested iteration loops.

        Graph structure:
        START → init → collect_requirements → generate_dataset_loop
                                                      ↓
                                              update_charts_loop
                                                      ↓
                                              update_filters_loop
                                                      ↓
                                              quality_assessment
                                                      ↓
                                    (≥85%) → finalize → END
                                    (<85%) → human_review → END
        """
        graph = StateGraph(GeneratorState)

        # Add all nodes
        graph.add_node("init", self._node_init)
        graph.add_node("collect_requirements", self._node_collect_requirements)
        graph.add_node("generate_dataset_loop", self._node_generate_dataset_loop)
        graph.add_node("refine_mappings", self._node_refine_mappings)
        graph.add_node("update_charts_loop", self._node_update_charts_loop)
        graph.add_node("update_filters_loop", self._node_update_filters_loop)
        graph.add_node("quality_assessment", self._node_quality_assessment)
        graph.add_node("human_review", self._node_human_review)
        graph.add_node("finalize", self._node_finalize)

        # Linear flow with conditional at quality assessment
        graph.add_edge(START, "init")
        graph.add_edge("init", "collect_requirements")
        graph.add_edge("collect_requirements", "generate_dataset_loop")
        graph.add_edge("generate_dataset_loop", "refine_mappings")
        graph.add_edge("refine_mappings", "update_charts_loop")
        graph.add_edge("update_charts_loop", "update_filters_loop")
        graph.add_edge("update_filters_loop", "quality_assessment")

        # Quality assessment routes to finalize or human_review
        graph.add_conditional_edges(
            "quality_assessment",
            self._route_after_quality_assessment,
            {
                "finalize": "finalize",
                "human_review": "human_review",
            },
        )

        # Terminal nodes
        graph.add_edge("human_review", END)
        graph.add_edge("finalize", END)

        return graph.compile()

    def _create_initial_state(self, run: DashboardGeneratorRun) -> GeneratorState:
        """Create initial state from run record."""
        return GeneratorState(
            run_id=run.id,
            database_report_id=run.database_report_id,
            template_dashboard_id=run.template_dashboard_id,
            owner_id=run.created_by_fk,
            template_requirements=None,
            database_report_data=None,
            mapping_proposal=None,
            generated_dashboard_id=None,
            generated_dataset_id=None,
            dataset_sql=None,
            column_mappings={},
            metric_mappings={},
            dataset_validation=None,
            dataset_actual_columns=[],
            dataset_actual_types={},
            chart_results={},
            filter_results={},
            charts_working=0,
            charts_failed=0,
            filters_working=0,
            filters_failed=0,
            overall_quality=0.0,
            failed_mappings=[],
            requires_human_review=False,
            review_reasons=[],
            current_phase=AgentPhase.INIT.value,
            is_complete=False,
            error=None,
        )

    def _run_agentic(
        self, initial_state: GeneratorState, run: DashboardGeneratorRun
    ) -> dict[str, Any]:
        """Run the LangGraph agentic workflow."""
        logger.info("Starting agentic dashboard generation for run %d", run.id)

        try:
            run.status = GeneratorStatus.RUNNING
            run.start_dttm = datetime.now()
            db.session.commit()

            final_state = self.graph.invoke(initial_state)

            self._update_run_from_state(run, final_state)
            return self._build_result(final_state)

        except Exception as e:
            logger.exception("Agentic generation failed for run %d", run.id)
            run.status = GeneratorStatus.FAILED
            run.error_message = str(e)
            run.end_dttm = datetime.now()
            db.session.commit()
            raise

    def _run_sequential(
        self, initial_state: GeneratorState, run: DashboardGeneratorRun
    ) -> dict[str, Any]:
        """
        Sequential execution when LangGraph is not available.

        Executes phases in order with internal iteration loops.
        """
        logger.info("Running sequential execution for run %d", run.id)

        state = initial_state

        try:
            run.status = GeneratorStatus.RUNNING
            run.start_dttm = datetime.now()
            db.session.commit()

            # Execute phases sequentially, updating run phase as we go
            state = self._node_init(state)
            self._update_run_phase(run, state)
            if state.get("error"):
                raise ValueError(state["error"])

            state = self._node_collect_requirements(state)
            self._update_run_phase(run, state)

            state = self._node_generate_dataset_loop(state)
            self._update_run_phase(run, state)

            # If dataset never validated/created, do not mutate charts/filters.
            dataset_ok = bool(
                state.get("dataset_validation")
                and state["dataset_validation"].success
                and state.get("generated_dataset_id")
            )
            if not dataset_ok:
                review_reasons = ["Dataset generation failed"]
                # Preserve any upstream error message
                if state.get("dataset_validation") and state["dataset_validation"].error_message:
                    review_reasons.append(state["dataset_validation"].error_message)  # type: ignore[arg-type]
                state = {
                    **state,
                    "current_phase": AgentPhase.HUMAN_REVIEW.value,
                    "requires_human_review": True,
                    "review_reasons": review_reasons,
                    "is_complete": True,
                }
                state = self._node_human_review(state)
                self._update_run_from_state(run, state)
                return self._build_result(state)

            state = self._node_refine_mappings(state)
            self._update_run_phase(run, state)

            state = self._node_update_charts_loop(state)
            self._update_run_phase(run, state)

            state = self._node_update_filters_loop(state)
            self._update_run_phase(run, state)

            state = self._node_quality_assessment(state)
            self._update_run_phase(run, state)

            # Route based on quality
            if state["overall_quality"] >= QUALITY_THRESHOLD:
                state = self._node_finalize(state)
            else:
                state = self._node_human_review(state)

            self._update_run_from_state(run, state)
            return self._build_result(state)

        except Exception as e:
            logger.exception("Sequential execution failed for run %d", run.id)
            run.status = GeneratorStatus.FAILED
            run.error_message = str(e)
            run.end_dttm = datetime.now()
            db.session.commit()
            raise

    def _update_run_phase(
        self, run: DashboardGeneratorRun, state: GeneratorState
    ) -> None:
        """Update run's current_phase during execution for progress tracking."""
        from superset.models.dashboard_generator import GeneratorPhase

        current_phase_str = state.get("current_phase")
        if current_phase_str:
            # Map AgentPhase to GeneratorPhase
            phase_mapping = {
                AgentPhase.INIT.value: GeneratorPhase.COPY_DASHBOARD,
                AgentPhase.COLLECT_REQUIREMENTS.value: GeneratorPhase.COPY_DASHBOARD,
                AgentPhase.GENERATE_DATASET.value: GeneratorPhase.BUILD_DATASET_CHARTS,
                AgentPhase.REFINE_MAPPINGS.value: GeneratorPhase.BUILD_DATASET_CHARTS,
                AgentPhase.UPDATE_CHARTS.value: GeneratorPhase.UPDATE_CHARTS,
                AgentPhase.UPDATE_FILTERS.value: GeneratorPhase.UPDATE_FILTERS,
                AgentPhase.QUALITY_ASSESSMENT.value: GeneratorPhase.FINALIZE,
                AgentPhase.HUMAN_REVIEW.value: GeneratorPhase.FINALIZE,
                AgentPhase.APPLY_FIXES.value: GeneratorPhase.FINALIZE,
                AgentPhase.FINALIZE.value: GeneratorPhase.FINALIZE,
            }
            run.current_phase = phase_mapping.get(current_phase_str)

            # Also update progress counts
            run.progress_json = json.dumps({
                "charts_total": state.get("charts_working", 0) + state.get("charts_failed", 0),
                "charts_done": state.get("charts_working", 0),
                "filters_total": state.get("filters_working", 0) + state.get("filters_failed", 0),
                "filters_done": state.get("filters_working", 0),
            })

            db.session.commit()

    # =========================================================================
    # Phase 1: INIT - Copy template dashboard
    # =========================================================================

    def _node_init(self, state: GeneratorState) -> GeneratorState:
        """
        Phase 1: INIT - Copy template dashboard.

        Gets chart IDs, positions, filter configs for free via copy.
        """
        logger.info("Phase 1: INIT - Copying template dashboard")

        template = db.session.query(Dashboard).get(state["template_dashboard_id"])
        if not template:
            return {**state, "error": "Template dashboard not found"}

        report = db.session.query(DatabaseSchemaReport).get(
            state["database_report_id"]
        )
        if not report:
            return {**state, "error": "Database report not found"}

        # Load owner for background task context
        owner = None
        if state.get("owner_id"):
            from superset.daos.user import UserDAO

            try:
                owner = UserDAO.get_by_id(state["owner_id"])
            except Exception:
                logger.warning("Could not load user %s for ownership", state["owner_id"])

        # Copy the dashboard (gives us chart IDs, positions, filter configs)
        dashboard = self._copy_dashboard(template, owner)

        # Prepare report data for LLM
        report_data = prepare_database_report_data(report)

        return {
            **state,
            "current_phase": AgentPhase.COLLECT_REQUIREMENTS.value,
            "database_report_data": report_data,
            "generated_dashboard_id": dashboard.id,
        }

    # =========================================================================
    # Phase 2: COLLECT REQUIREMENTS - Extract ALL requirements upfront
    # =========================================================================

    def _node_collect_requirements(self, state: GeneratorState) -> GeneratorState:
        """
        Phase 2: COLLECT REQUIREMENTS - Extract ALL chart AND filter requirements.

        This ensures the dataset generation has complete knowledge of what's needed.
        """
        logger.info("Phase 2: COLLECT REQUIREMENTS - Extracting all requirements")

        template = db.session.query(Dashboard).get(state["template_dashboard_id"])
        if not template:
            return {**state, "error": "Template dashboard not found"}

        # Analyze template to extract ALL requirements (columns, metrics, filters)
        requirements = self.template_analyzer.analyze(template)

        # Use MappingService for rule-based pre-matching (fast, no LLM)
        report = db.session.query(DatabaseSchemaReport).get(
            state["database_report_id"]
        )
        if not report:
            return {**state, "error": "Database report not found"}

        # Get confidence-scored mapping proposal
        mapping_proposal = self.mapping_service.propose_mappings(requirements, report)

        logger.info(
            "Requirements collected: %d columns, %d metrics, %d filters. "
            "Mapping confidence: %.1f%%",
            len(requirements.columns),
            len(requirements.metrics),
            len(requirements.filters),
            mapping_proposal.overall_confidence * 100,
        )

        return {
            **state,
            "current_phase": AgentPhase.GENERATE_DATASET.value,
            "template_requirements": requirements,
            "mapping_proposal": mapping_proposal,
        }

    # =========================================================================
    # Phase 3: DATASET - Internal iteration loop
    # =========================================================================

    def _node_generate_dataset_loop(self, state: GeneratorState) -> GeneratorState:
        """
        Phase 3: DATASET - Generate and validate with internal retry loop.

        Iterates until valid SQL or max attempts reached.
        Dataset is FROZEN after this phase - no backtracking.
        """
        logger.info("Phase 3: DATASET - Starting dataset generation loop")

        requirements = state["template_requirements"]
        report_data = state["database_report_data"]
        mapping_proposal = state["mapping_proposal"]

        report = db.session.query(DatabaseSchemaReport).get(
            state["database_report_id"]
        )
        if not report:
            return {**state, "error": "Database report not found"}

        attempt = 0
        previous_errors: list[str] = []
        dataset_sql: str | None = None
        column_mappings: dict[str, str] = {}
        metric_mappings: dict[str, str] = {}
        validation_result: DatasetValidationResult | None = None
        actual_columns: list[str] = []
        actual_types: dict[str, str] = {}

        required_columns = set()
        if requirements:
            required_columns.update({c.name for c in requirements.columns})
            for f in requirements.filters:
                if f.target_column:
                    required_columns.add(f.target_column)

        while attempt < MAX_DATASET_ATTEMPTS:
            attempt += 1
            logger.info("Dataset generation attempt %d/%d", attempt, MAX_DATASET_ATTEMPTS)

            try:
                # Generate dataset SQL using LLM with pre-matched candidates
                llm_result = self.llm_service.generate_dataset_sql(
                    database_report=report_data,
                    template_dataset=self._get_template_dataset(requirements),
                    chart_requirements=self._get_chart_requirements(requirements),
                    pre_matched_columns=(
                        self._format_pre_matches(mapping_proposal) if mapping_proposal else None
                    ),
                    previous_errors=previous_errors if previous_errors else None,
                    required_columns=list(required_columns) if required_columns else None,
                    template_context=getattr(requirements, "template_context", None),
                )

                dataset_sql = llm_result.get("sql")
                column_mappings = llm_result.get("column_mappings", {})
                metric_mappings = llm_result.get("metric_mappings", {})

                if not dataset_sql:
                    previous_errors.append("No SQL generated")
                    continue

                # Validate by executing SQL
                validation_result = self._validate_dataset_execution(
                    dataset_sql, report, requirements
                )
                validation_result.attempts = attempt

                if validation_result.success:
                    actual_columns = validation_result.actual_columns
                    actual_types = validation_result.actual_types
                    logger.info(
                        "Dataset validated successfully with %d columns",
                        len(actual_columns),
                    )

                    # If required columns are still missing, attempt an additive refinement
                    if validation_result.missing_columns:
                        logger.info(
                            "Attempting dataset refinement to add missing columns: %s",
                            ", ".join(validation_result.missing_columns),
                        )
                        try:
                            refine_result = self.llm_service.refine_dataset_for_filters(
                                current_dataset_sql=dataset_sql,
                                column_mappings=column_mappings,
                                native_filters=[],
                                database_report=report_data,
                                required_columns=validation_result.missing_columns,
                            )
                            if refine_result.get("needs_revision") and refine_result.get("revised_sql"):
                                dataset_sql = refine_result["revised_sql"]
                                validation_result = self._validate_dataset_execution(
                                    dataset_sql, report, requirements
                                )
                                if validation_result.success:
                                    actual_columns = validation_result.actual_columns
                                    actual_types = validation_result.actual_types
                                    logger.info(
                                        "Dataset refined successfully; columns now %d",
                                        len(actual_columns),
                                    )
                                    break
                        except Exception as refine_exc:  # pragma: no cover
                            logger.warning(
                                "Dataset refinement failed: %s", str(refine_exc)
                            )
                    else:
                        break
                else:
                    error_msg = validation_result.error_message or "Validation failed"
                    previous_errors.append(error_msg)
                    logger.warning(
                        "Dataset validation failed (attempt %d): %s",
                        attempt,
                        error_msg,
                    )

            except Exception as e:
                error_msg = f"Generation error: {str(e)}"
                previous_errors.append(error_msg)
                logger.error("Dataset generation failed (attempt %d): %s", attempt, str(e))

        # Build intermediate state with types for fallback datetime detection
        intermediate_state = {
            **state,
            "dataset_actual_columns": actual_columns,
            "dataset_actual_types": actual_types,
        }

        # Create or update the dataset if we have valid SQL
        dataset_id = state["generated_dataset_id"]
        if dataset_sql and validation_result and validation_result.success:
            dataset = self._create_or_update_dataset(
                intermediate_state, dataset_sql, report
            )
            dataset_id = dataset.id if dataset else None

        # Track failed dataset generation for potential human review
        failed_mappings = list(state.get("failed_mappings", []))
        if validation_result and validation_result.missing_columns:
            for missing_col in validation_result.missing_columns:
                failed_mappings.append(
                    FailedMapping(
                        item_type="dataset_column",
                        item_id=missing_col,
                        item_name=missing_col,
                        error_reason=f"Column '{missing_col}' not found in generated SQL",
                        available_alternatives=actual_columns[:10],
                    )
                )

        return {
            **state,
            "current_phase": AgentPhase.UPDATE_CHARTS.value,
            "dataset_sql": dataset_sql,
            "column_mappings": column_mappings,
            "metric_mappings": metric_mappings,
            "generated_dataset_id": dataset_id,
            "dataset_validation": validation_result,
            "dataset_actual_columns": actual_columns,
            "dataset_actual_types": actual_types,
            "failed_mappings": failed_mappings,
        }

    # =========================================================================
    # Phase 3.5: REFINE MAPPINGS - tighten mappings using actual columns
    # =========================================================================

    def _node_refine_mappings(self, state: GeneratorState) -> GeneratorState:
        """
        Attempt to improve column/metric mappings based on actual dataset columns.

        Tries deterministic matching first, then LLM suggestions if available.
        """
        logger.info("Phase 3.5: REFINE MAPPINGS - tightening mappings against actual columns")

        actual_columns = state.get("dataset_actual_columns", [])
        column_mappings = dict(state.get("column_mappings", {}))
        metric_mappings = dict(state.get("metric_mappings", {}))

        # Determine missing template columns from template requirements
        requirements = state.get("template_requirements")
        missing_template_columns = []
        if requirements:
            for col in requirements.columns:
                mapped = column_mappings.get(col.name)
                if not mapped or mapped.lower() not in {c.lower() for c in actual_columns}:
                    missing_template_columns.append(col.name)

        # Prefer LLM-driven fixes; static heuristics are too weak for semantic gaps
        unresolved = missing_template_columns
        if unresolved and self.llm_service.is_available():
            try:
                llm_result = self.llm_service.suggest_column_fallbacks(
                    missing_columns=unresolved,
                    available_columns=actual_columns,
                )
                for template_col, suggested in llm_result.items():
                    if suggested:
                        column_mappings[template_col] = suggested
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("LLM refinement for mappings failed: %s", exc)

        return {
            **state,
            "current_phase": AgentPhase.REFINE_MAPPINGS.value,
            "column_mappings": column_mappings,
            "metric_mappings": metric_mappings,
        }

    def _validate_dataset_execution(
        self,
        sql: str,
        report: DatabaseSchemaReport,
        requirements: TemplateRequirements,
    ) -> DatasetValidationResult:
        """
        Validate dataset SQL by actually executing it.

        Returns actual columns, types, and checks against requirements.
        """
        try:
            from superset.connectors.sqla.utils import get_columns_description
            from superset.sql.parse import SQLStatement

            # Syntax check
            try:
                stmt = SQLStatement(sql, engine=report.database.db_engine_spec.engine)
                if stmt.is_mutating():
                    return DatasetValidationResult(
                        success=False,
                        error_message="SQL contains mutating operations",
                    )
            except Exception as e:
                return DatasetValidationResult(
                    success=False,
                    error_message=f"SQL syntax error: {str(e)}",
                )

            # Execute with LIMIT 0 to get columns
            limited_sql = f"SELECT * FROM ({sql}) _validation_subquery LIMIT 0"
            columns = get_columns_description(
                database=report.database,
                catalog=None,
                schema=report.schema_name,
                query=limited_sql,
            )

            actual_columns = [col["column_name"] for col in columns]
            actual_types = {
                col["column_name"]: col.get("type", "UNKNOWN") for col in columns
            }
            actual_set = {c.lower() for c in actual_columns}

            # Check required columns from template
            required_columns = {c.name.lower() for c in requirements.columns}
            # Also include filter columns
            for f in requirements.filters:
                if f.target_column:
                    required_columns.add(f.target_column.lower())

            missing = required_columns - actual_set

            # Allow partial success: keep track of missing columns but do not fail outright
            if missing:
                logger.warning("Dataset validation missing columns: %s", ", ".join(missing))
                return DatasetValidationResult(
                    success=True,
                    actual_columns=actual_columns,
                    actual_types=actual_types,
                    missing_columns=list(missing),
                    error_message=f"Missing columns: {', '.join(missing)}",
                )

            return DatasetValidationResult(
                success=True,
                actual_columns=actual_columns,
                actual_types=actual_types,
            )

        except Exception as e:
            return DatasetValidationResult(
                success=False,
                error_message=f"Execution failed: {str(e)}",
            )

    # =========================================================================
    # Phase 4: CHARTS - Per-chart iteration loops
    # =========================================================================

    def _node_update_charts_loop(self, state: GeneratorState) -> GeneratorState:
        """
        Phase 4: CHARTS - Update each chart with internal retry loop.

        For each chart:
        1. Map chart params to dataset columns
        2. Update chart config
        3. Execute chart query (REAL TEST)
        4. If fails, retry with LLM fix suggestion
        5. After max attempts, mark as FAILED and continue
        """
        logger.info("Phase 4: CHARTS - Starting per-chart update loops")

        dashboard = db.session.query(Dashboard).get(state["generated_dashboard_id"])
        if not dashboard:
            return {**state, "error": "Generated dashboard not found"}

        dataset_id = state["generated_dataset_id"]
        if not dataset_id:
            logger.warning("Dataset not available; skipping chart updates and deferring to human review")
            return {
                **state,
                "current_phase": AgentPhase.HUMAN_REVIEW.value,
                "requires_human_review": True,
                "review_reasons": ["Dataset not available for chart updates"],
                "is_complete": True,
            }

        column_mappings = state["column_mappings"]
        metric_mappings = state["metric_mappings"]
        actual_columns = state["dataset_actual_columns"]

        # Get the dataset's datetime column for time-series charts
        datetime_column: str | None = None
        if dataset_id:
            dataset = db.session.query(SqlaTable).get(dataset_id)
            if dataset:
                datetime_column = dataset.main_dttm_col
                if datetime_column:
                    logger.info("Using datetime column: %s", datetime_column)

        chart_results: dict[int, ChartValidationResult] = {}
        charts_working = 0
        charts_failed = 0
        failed_mappings = list(state.get("failed_mappings", []))
        total_charts = len(dashboard.slices)

        for chart in dashboard.slices:
            result = self._update_chart_with_retry(
                chart=chart,
                dataset_id=dataset_id,
                column_mappings=column_mappings,
                metric_mappings=metric_mappings,
                actual_columns=actual_columns,
                actual_types=state.get("dataset_actual_types"),
                datetime_column=datetime_column,
            )

            chart_results[chart.id] = result

            if result.success:
                charts_working += 1
            else:
                charts_failed += 1
                # Check for inapplicability info (stored as custom attrs)
                is_inapplicable = getattr(result, "is_inapplicable", False)
                inapplicability_reason = getattr(result, "inapplicability_reason", None)

                # Add to failed mappings for potential human review
                failed_mappings.append(
                    FailedMapping(
                        item_type="chart",
                        item_id=str(chart.id),
                        item_name=chart.slice_name or f"Chart {chart.id}",
                        error_reason=result.error_message or "Unknown error",
                        available_alternatives=actual_columns[:10],
                        is_inapplicable=is_inapplicable,
                        inapplicability_reason=inapplicability_reason,
                        can_be_removed=True,  # User can choose to remove
                    )
                )

            # Persist progress incrementally so polling reflects progress
            self._persist_progress(
                run_id=state["run_id"],
                charts_total=total_charts,
                charts_done=charts_working,
                filters_total=state.get("filters_working", 0) + state.get("filters_failed", 0),
                filters_done=state.get("filters_working", 0),
            )

        db.session.commit()

        logger.info(
            "Charts updated: %d working, %d failed",
            charts_working,
            charts_failed,
        )

        return {
            **state,
            "current_phase": AgentPhase.UPDATE_FILTERS.value,
            "chart_results": chart_results,
            "charts_working": charts_working,
            "charts_failed": charts_failed,
            "failed_mappings": failed_mappings,
        }

    def _update_chart_with_retry(
        self,
        chart: Slice,
        dataset_id: int | None,
        column_mappings: dict[str, str],
        metric_mappings: dict[str, str],
        actual_columns: list[str],
        actual_types: dict[str, str] | None = None,
        datetime_column: str | None = None,
    ) -> ChartValidationResult:
        """
        Update a single chart with retry loop.

        Iterates until chart query executes successfully or max attempts reached.
        """
        chart_name = chart.slice_name or f"Chart {chart.id}"
        attempt = 0
        previous_errors: list[str] = []

        while attempt < MAX_CHART_ATTEMPTS:
            attempt += 1
            logger.debug(
                "Chart %s update attempt %d/%d",
                chart_name,
                attempt,
                MAX_CHART_ATTEMPTS,
            )

            try:
                # Update datasource reference
                chart.datasource_id = dataset_id
                chart.datasource_type = "table"

                # Map parameters using LLM
                params = json.loads(chart.params or "{}")
                mapped_params = self.llm_service.map_chart_params(
                    chart_params=params,
                    column_mappings=column_mappings,
                    metric_mappings=metric_mappings,
                    viz_type=chart.viz_type,
                    available_columns=actual_columns,
                    previous_errors=previous_errors if previous_errors else None,
                    datetime_column=datetime_column,
                )

                # Ensure datasource param points to generated dataset (form_data safety)
                if dataset_id:
                    mapped_params["datasource"] = f"{dataset_id}__table"

                # On final attempt, apply simplified fallback to increase success odds
                if attempt == MAX_CHART_ATTEMPTS:
                    mapped_params = self._apply_chart_fallback(
                        mapped_params, actual_columns
                    )

                mapped_params = self._normalize_metrics(
                    mapped_params, actual_columns
                )
                mapped_params = self._ensure_numeric_metric(
                    mapped_params, actual_types or {}, actual_columns
                )

                # Apply title suggestion if provided by LLM when rescoping
                title_suggestion = mapped_params.pop("title_suggestion", None)
                if title_suggestion and title_suggestion != chart.slice_name:
                    chart.slice_name = title_suggestion

                chart.params = json.dumps(mapped_params)

                # Validate by executing the chart query
                validation_result = self._validate_chart_execution(chart)

                if validation_result.success:
                    return ChartValidationResult(
                        chart_id=chart.id,
                        chart_name=chart_name,
                        success=True,
                        attempts=attempt,
                        query_executed=True,
                    )
                else:
                    error_msg = validation_result.error_message or "Query failed"
                    previous_errors.append(error_msg)
                    logger.warning(
                        "Chart %s validation failed (attempt %d): %s",
                        chart_name,
                        attempt,
                        error_msg,
                    )

                # Final fallback: rescope chart to a simple table if still failing
                if attempt == MAX_CHART_ATTEMPTS:
                    fallback_params = self._build_reduced_scope_chart_params(
                        actual_columns, actual_types or {}, datetime_column
                    )
                    if fallback_params:
                        chart.viz_type = "table"
                        chart.params = json.dumps(fallback_params)
                        validation_result = self._validate_chart_execution(chart)
                        if validation_result.success:
                            return ChartValidationResult(
                                chart_id=chart.id,
                                chart_name=chart_name,
                                success=True,
                                attempts=attempt,
                                query_executed=validation_result.query_executed,
                            )

            except Exception as e:
                error_msg = f"Mapping error: {str(e)}"
                previous_errors.append(error_msg)
                logger.warning(
                    "Chart %s mapping failed (attempt %d): %s",
                    chart_name,
                    attempt,
                    str(e),
                )

        # Max attempts reached - check if chart is inapplicable
        is_inapplicable, inapplicability_reason = self._check_chart_inapplicability(
            chart, previous_errors, actual_columns, column_mappings
        )

        # Return result with inapplicability info
        result = ChartValidationResult(
            chart_id=chart.id,
            chart_name=chart_name,
            success=False,
            error_message="; ".join(previous_errors[-2:]) if previous_errors else "Max attempts reached",
            attempts=attempt,
            query_executed=False,
        )

        # Store inapplicability info in a custom attribute for later use
        setattr(result, "is_inapplicable", is_inapplicable)
        setattr(result, "inapplicability_reason", inapplicability_reason)

        return result

    def _check_chart_inapplicability(
        self,
        chart: Slice,
        errors: list[str],
        actual_columns: list[str],
        column_mappings: dict[str, str],
    ) -> tuple[bool, str | None]:
        """
        Analyze if a chart is fundamentally inapplicable to the new dataset.

        Returns (is_inapplicable, reason) tuple.

        A chart is inapplicable when:
        1. It requires specific data types that don't exist in the dataset
        2. It requires columns that have no semantic equivalent
        3. The chart type fundamentally requires data structure the dataset lacks
        """
        error_text = " ".join(errors).lower()
        params = json.loads(chart.params or "{}")

        # Check for fundamental type mismatches
        if "empty query" in error_text:
            # Check if the chart has no applicable metrics/columns
            metrics = params.get("metrics", [])
            groupby = params.get("groupby", [])

            if not metrics and not groupby:
                return True, "Chart requires metrics or groupby columns that could not be mapped"

        # Check if required columns don't exist and have no alternatives
        if "does not exist" in error_text:
            # Parse which column is missing
            missing_cols = []
            for error in errors:
                if "does not exist" in error.lower():
                    # Try to extract column name from error
                    import re

                    match = re.search(r'column ["\']?(\w+)["\']?', error.lower())
                    if match:
                        missing_cols.append(match.group(1))

            # Check if missing columns have no alternatives
            actual_cols_lower = {c.lower() for c in actual_columns}
            has_alternatives = False
            for missing in missing_cols:
                # Check if any column is similar
                for actual in actual_cols_lower:
                    if missing in actual or actual in missing:
                        has_alternatives = True
                        break

            if not has_alternatives and missing_cols:
                return True, f"Required columns {missing_cols} have no equivalents in the dataset"

        # Check for chart type specific requirements
        viz_type = chart.viz_type.lower() if chart.viz_type else ""

        # Geographic charts need geographic data
        if any(geo in viz_type for geo in ["map", "country", "world", "choropleth"]):
            geo_cols = [c for c in actual_columns if any(
                geo in c.lower() for geo in ["country", "state", "city", "lat", "lon", "geo", "region"]
            )]
            if not geo_cols:
                return True, "Geographic chart requires location data not available in dataset"

        return False, None

    def _validate_chart_execution(self, chart: Slice) -> ChartValidationResult:
        """
        Actually execute the chart query to validate it works.

        Uses the chart's datasource to generate and execute the query.
        """
        chart_name = chart.slice_name or f"Chart {chart.id}"

        try:
            datasource = chart.datasource
            if not datasource:
                return ChartValidationResult(
                    chart_id=chart.id,
                    chart_name=chart_name,
                    success=False,
                    error_message="No datasource assigned",
                )

            form_data = json.loads(chart.params or "{}")
            # Ensure minimal metric presence when form_data indicates metrics are expected
            form_data = self._ensure_metrics_present(form_data)
            # Align time range to dataset bounds when absent or empty
            form_data = self._ensure_time_range(form_data, datasource)

            # Translate form_data params to query params
            # granularity_sqla -> granularity (required by get_sqla_query)
            query_params = self._translate_form_data_to_query_params(
                form_data, datasource
            )

            # Use Superset's query generation to get SQL
            # This validates that the chart config is valid for the datasource
            query_obj = datasource.get_query_str_extended(query_params)

            if hasattr(query_obj, "sql") and query_obj.sql:
                # Execute with LIMIT to test
                test_sql = f"SELECT * FROM ({query_obj.sql}) _chart_test LIMIT 1"

                with datasource.database.get_raw_connection(
                    schema=datasource.schema
                ) as conn:
                    cursor = conn.cursor()
                    cursor.execute(test_sql)
                    rows = cursor.fetchall()

                if not rows:
                    # Treat empty data as failure requiring refinement
                    return ChartValidationResult(
                        chart_id=chart.id,
                        chart_name=chart_name,
                        success=False,
                        error_message="Query returned no rows",
                        query_executed=True,
                    )

                return ChartValidationResult(
                    chart_id=chart.id,
                    chart_name=chart_name,
                    success=True,
                    query_executed=True,
                )

            # If no SQL but no error, consider it valid (some chart types don't need SQL)
            return ChartValidationResult(
                chart_id=chart.id,
                chart_name=chart_name,
                success=True,
                query_executed=False,
            )

        except Exception as e:
            return ChartValidationResult(
                chart_id=chart.id,
                chart_name=chart_name,
                success=False,
                error_message=f"Query execution failed: {str(e)}",
                query_executed=False,
            )

    def _apply_chart_fallback(
        self,
        params: dict[str, Any],
        actual_columns: list[str],
    ) -> dict[str, Any]:
        """
        Simplify chart params to increase chances of a successful query.

        - Remove groupby/columns not present
        - Ensure at least one metric (COUNT(*) as last resort)
        - Trim orderings referencing missing fields
        """
        lowered = {c.lower() for c in actual_columns}
        simplified = dict(params)

        def _filter_list(values: list[Any]) -> list[Any]:
            filtered: list[Any] = []
            for v in values:
                if isinstance(v, str):
                    if v.lower() in lowered:
                        filtered.append(v)
                elif isinstance(v, dict):
                    col_name = (
                        v.get("column_name")
                        or v.get("label")
                        or v.get("sqlExpression")
                    )
                    if col_name and col_name.lower() in lowered:
                        filtered.append(v)
            return filtered

        for key in ["groupby", "columns", "orderby"]:
            if key in simplified and isinstance(simplified[key], list):
                simplified[key] = _filter_list(simplified[key])

        metrics = simplified.get("metrics") or []
        if not metrics:
            simplified["metrics"] = [self._adhoc_sql_metric("COUNT(*)")]

        return simplified

    def _normalize_metrics(
        self, params: dict[str, Any], actual_columns: list[str]
    ) -> dict[str, Any]:
        """
        Ensure metrics are adhoc when no saved metric exists.
        """
        normalized = dict(params)

        def to_adhoc(metric: str) -> dict[str, Any]:
            return {
                "expressionType": "SQL",
                "label": metric,
                "sqlExpression": metric,
            }

        def normalize_metric_list(values: list[Any]) -> list[Any]:
            result: list[Any] = []
            for v in values:
                if isinstance(v, str):
                    result.append(to_adhoc(v))
                else:
                    result.append(v)
            return result

        for key in ["metric", "metrics", "percent_metrics", "percentMetrics"]:
            if key in normalized:
                if isinstance(normalized[key], list):
                    normalized[key] = normalize_metric_list(normalized[key])
                elif isinstance(normalized[key], str):
                    normalized[key] = normalize_metric_list([normalized[key]])

        if normalized.get("secondary_metric") and isinstance(
            normalized["secondary_metric"], str
        ):
            normalized["secondary_metric"] = to_adhoc(
                normalized["secondary_metric"]
            )

        return normalized

    def _ensure_numeric_metric(
        self,
        params: dict[str, Any],
        actual_types: dict[str, str],
        actual_columns: list[str],
    ) -> dict[str, Any]:
        """
        Inject a numeric metric when metric keys exist but resolved metrics are empty.
        Uses the first numeric column if available, otherwise COUNT(*).
        """
        updated = dict(params)

        def has_metric_value() -> bool:
            for key in ["metrics", "metric", "percent_metrics", "percentMetrics"]:
                val = updated.get(key)
                if isinstance(val, list) and len(val) > 0:
                    return True
                if isinstance(val, dict) and val:
                    return True
                if isinstance(val, str) and val.strip():
                    return True
            return False

        if has_metric_value():
            return updated

        # Pick best numeric column
        numeric_candidates = [
            col for col, col_type in actual_types.items()
            if self._is_numeric_type(col_type)
        ] or [col for col in actual_columns if self._is_numeric_type(col)]

        metric_expr = (
            f"SUM({numeric_candidates[0]})" if numeric_candidates else "COUNT(*)"
        )
        updated["metrics"] = [self._adhoc_sql_metric(metric_expr)]
        return updated

    def _build_reduced_scope_chart_params(
        self,
        actual_columns: list[str],
        actual_types: dict[str, str],
        datetime_column: str | None,
    ) -> dict[str, Any] | None:
        """
        Build a minimal table chart config using available columns.

        This is a last-resort fallback to keep the dashboard functional.
        """
        if not actual_columns:
            return None

        numeric_candidates = [
            col for col, col_type in actual_types.items()
            if self._is_numeric_type(col_type)
        ] or [col for col in actual_columns if self._is_numeric_type(col)]
        metric_col = numeric_candidates[0] if numeric_candidates else None

        groupby_candidates = [col for col in actual_columns if col != metric_col]
        groupby_col = groupby_candidates[0] if groupby_candidates else None

        metrics: list[Any] = []
        if metric_col:
            metrics.append(self._adhoc_sql_metric(f"SUM({metric_col})"))
        else:
            metrics.append(self._adhoc_sql_metric("COUNT(*)"))

        params: dict[str, Any] = {
            "viz_type": "table",
            "metrics": metrics,
            "row_limit": 500,
        }

        if groupby_col:
            params["all_columns"] = [groupby_col]

        if datetime_column:
            params["granularity_sqla"] = datetime_column

        return params

    @staticmethod
    def _is_numeric_type(type_str: str | None) -> bool:
        if not type_str:
            return False
        lowered = type_str.lower()
        return any(
            keyword in lowered
            for keyword in ["int", "decimal", "numeric", "float", "double", "real"]
        )

    @staticmethod
    def _adhoc_sql_metric(expression: str) -> dict[str, Any]:
        return {
            "expressionType": "SQL",
            "sqlExpression": expression,
            "label": expression,
        }

    def _ensure_time_range(
        self, form_data: dict[str, Any], datasource: SqlaTable
    ) -> dict[str, Any]:
        """
        If no time_range is provided, align it to dataset bounds using min/max of the datetime column.

        This avoids inheriting template time ranges that may not match the target dataset.
        """
        updated = dict(form_data)
        if updated.get("time_range"):
            return updated

        dttm_col = datasource.main_dttm_col
        if not dttm_col:
            return updated

        bounds = self._get_dataset_time_bounds(datasource)
        if not bounds:
            return updated

        start, end = bounds
        if start or end:
            start_str = start or ""
            end_str = end or ""
            updated["time_range"] = f"{start_str} : {end_str}"
        return updated

    def _get_dataset_time_bounds(
        self, datasource: SqlaTable
    ) -> tuple[str | None, str | None] | None:
        """
        Compute (min, max) for the dataset's datetime column. Cached per dataset.
        """
        try:
            if datasource.id in self.dataset_time_bounds:
                return self.dataset_time_bounds[datasource.id]

            dttm_col = datasource.main_dttm_col
            if not dttm_col:
                return None

            sql = datasource.sql
            if sql:
                bounds_sql = (
                    f'SELECT MIN("{dttm_col}") AS min_dttm, MAX("{dttm_col}") AS max_dttm '
                    f'FROM ({sql}) __bounds'
                )
            else:
                table_ref = (
                    f'"{datasource.schema}"."{datasource.table_name}"'
                    if datasource.schema
                    else f'"{datasource.table_name}"'
                )
                bounds_sql = (
                    f'SELECT MIN("{dttm_col}") AS min_dttm, MAX("{dttm_col}") AS max_dttm '
                    f"FROM {table_ref}"
                )

            with datasource.database.get_raw_connection(
                schema=datasource.schema
            ) as conn:
                cursor = conn.cursor()
                cursor.execute(bounds_sql)
                row = cursor.fetchone()

            if not row:
                return None

            start, end = row[0], row[1]
            # Convert to ISO strings if possible
            start_str = start.isoformat() if start else None
            end_str = end.isoformat() if end else None

            self.dataset_time_bounds[datasource.id] = (start_str, end_str)
            return self.dataset_time_bounds[datasource.id]
        except Exception:
            return None

    def _translate_form_data_to_query_params(
        self, form_data: dict[str, Any], datasource: SqlaTable
    ) -> dict[str, Any]:
        """
        Translate chart form_data params to query params format.

        This handles the translation of deprecated/aliased params:
        - granularity_sqla -> granularity
        - time_grain_sqla -> extras.time_grain_sqla
        - adhoc_filters -> filter (with proper structure)

        The granularity param is critical for time-series charts.
        """
        query_params = dict(form_data)

        # Normalize adhoc_filters into core filter clauses so time ranges and other
        # filters are honored during validation queries.
        adhoc_filters = query_params.pop("adhoc_filters", []) or []
        filter_clauses = query_params.get("filter") or []
        for adhoc in adhoc_filters:
            expr_type = adhoc.get("expressionType")
            op = adhoc.get("operator")
            comparator = adhoc.get("comparator")

            if expr_type == "SIMPLE":
                col = adhoc.get("subject") or adhoc.get("column")
                if col and op:
                    filter_clauses.append({"col": col, "op": op, "val": comparator})
            elif expr_type == "SQL":
                sql_expression = adhoc.get("sqlExpression")
                if sql_expression and op:
                    filter_clauses.append(
                        {
                            "col": {
                                "sqlExpression": sql_expression,
                                "label": sql_expression,
                                "expressionType": "SQL",
                            },
                            "op": op,
                            "val": comparator,
                        }
                    )
        query_params["filter"] = filter_clauses

        # Apply time_range to a temporal filter so the generated SQL reflects it
        time_range = query_params.get("time_range")
        if time_range and time_range != "No filter":
            temporal_col = datasource.main_dttm_col or query_params.get("granularity")
            if temporal_col:
                query_params["filter"].append(
                    {"col": temporal_col, "op": "TEMPORAL_RANGE", "val": time_range}
                )

        # Translate granularity_sqla to granularity
        # This is required by get_sqla_query for time-series charts
        if "granularity_sqla" in query_params and "granularity" not in query_params:
            query_params["granularity"] = query_params["granularity_sqla"]

        # Use the datasource's main_dttm_col if no granularity is specified
        if not query_params.get("granularity") and datasource.main_dttm_col:
            query_params["granularity"] = datasource.main_dttm_col

        # Ensure extras dict exists for time_grain
        if "extras" not in query_params:
            query_params["extras"] = {}

        if "time_grain_sqla" in query_params:
            query_params["extras"]["time_grain_sqla"] = query_params["time_grain_sqla"]

        # Ensure filter is always a list (never None)
        # get_sqla_query iterates over filter and will fail if it's None
        if query_params.get("filter") is None:
            query_params["filter"] = []

        # Ensure other iterable params are lists not None
        for key in ["metrics", "columns", "groupby", "orderby"]:
            if query_params.get(key) is None:
                query_params[key] = []

        return query_params

    def _ensure_metrics_present(self, form_data: dict[str, Any]) -> dict[str, Any]:
        """
        Ensure form_data has a metric when metric-like keys are present but empty.

        This is dynamic: only inject when the form_data already expects metrics
        (i.e., keys exist but values are empty).
        """
        updated = dict(form_data)

        def inject_metric(key: str) -> None:
            updated[key] = [self._adhoc_sql_metric("COUNT(*)")]

        metric_keys = ["metrics", "metric", "percent_metrics", "percentMetrics"]
        has_metric_key = any(key in updated for key in metric_keys)

        if has_metric_key:
            metrics = updated.get("metrics") or []
            metric = updated.get("metric")
            percent_metrics = updated.get("percent_metrics") or []
            percentMetrics = updated.get("percentMetrics") or []

            if (
                (isinstance(metrics, list) and len(metrics) == 0)
                and not metric
                and isinstance(percent_metrics, list)
                and len(percent_metrics) == 0
                and isinstance(percentMetrics, list)
                and len(percentMetrics) == 0
            ):
                inject_metric("metrics")

            # Normalize single metric string
            if isinstance(metric, str):
                updated["metric"] = self._adhoc_sql_metric(metric)
            if isinstance(metrics, str):
                updated["metrics"] = [self._adhoc_sql_metric(metrics)]

        return updated

    # =========================================================================
    # Phase 5: FILTERS - Per-filter iteration loops
    # =========================================================================

    def _node_update_filters_loop(self, state: GeneratorState) -> GeneratorState:
        """
        Phase 5: FILTERS - Update each filter with internal retry loop.

        For each filter:
        1. Map filter column to dataset column
        2. Update filter config
        3. Test filter (query distinct values)
        4. If fails, retry with LLM fix suggestion
        5. After max attempts, mark as FAILED and continue
        """
        logger.info("Phase 5: FILTERS - Starting per-filter update loops")

        dashboard = db.session.query(Dashboard).get(state["generated_dashboard_id"])
        if not dashboard:
            return {**state, "error": "Generated dashboard not found"}

        dataset_id = state["generated_dataset_id"]
        if not dataset_id:
            logger.warning("Dataset not available; skipping filter updates and deferring to human review")
            return {
                **state,
                "current_phase": AgentPhase.HUMAN_REVIEW.value,
                "requires_human_review": True,
                "review_reasons": ["Dataset not available for filter updates"],
                "is_complete": True,
            }

        column_mappings = state["column_mappings"]
        actual_columns = state["dataset_actual_columns"]
        actual_types = state.get("dataset_actual_types", {})

        metadata = json.loads(dashboard.json_metadata or "{}")
        native_filters = metadata.get("native_filter_configuration", [])

        filter_results: dict[str, FilterValidationResult] = {}
        filters_working = 0
        filters_failed = 0
        failed_mappings = list(state.get("failed_mappings", []))
        total_filters = len(native_filters)

        # Get dataset for validation
        dataset = (
            db.session.query(SqlaTable).get(dataset_id)
            if dataset_id
            else None
        )

        for filter_config in native_filters:
            result = self._update_filter_with_retry(
                filter_config=filter_config,
                dataset=dataset,
                dataset_id=dataset_id,
                column_mappings=column_mappings,
                actual_columns=actual_columns,
                actual_types=actual_types,
            )

            filter_results[result.filter_id] = result

            if result.success:
                filters_working += 1
            else:
                filters_failed += 1
                # Detect filter inapplicability
                is_inapplicable, inapplicability_reason = self._check_filter_inapplicability(
                    filter_config, result.error_message or "", actual_columns
                )

                failed_mappings.append(
                    FailedMapping(
                        item_type="filter",
                        item_id=result.filter_id,
                        item_name=result.filter_name,
                        error_reason=result.error_message or "Unknown error",
                        available_alternatives=actual_columns[:10],
                        is_inapplicable=is_inapplicable,
                        inapplicability_reason=inapplicability_reason,
                        can_be_removed=True,  # User can choose to remove
                    )
                )

            # Persist progress incrementally
            self._persist_progress(
                run_id=state["run_id"],
                charts_total=state.get("charts_working", 0) + state.get("charts_failed", 0),
                charts_done=state.get("charts_working", 0),
                filters_total=total_filters,
                filters_done=filters_working,
            )

        # Save updated filters
        metadata["native_filter_configuration"] = native_filters
        dashboard.json_metadata = json.dumps(metadata)
        db.session.commit()

        logger.info(
            "Filters updated: %d working, %d failed",
            filters_working,
            filters_failed,
        )

        return {
            **state,
            "current_phase": AgentPhase.QUALITY_ASSESSMENT.value,
            "filter_results": filter_results,
            "filters_working": filters_working,
            "filters_failed": filters_failed,
            "failed_mappings": failed_mappings,
        }

    def _update_filter_with_retry(
        self,
        filter_config: dict[str, Any],
        dataset: SqlaTable | None,
        dataset_id: int | None,
        column_mappings: dict[str, str],
        actual_columns: list[str],
        actual_types: dict[str, str] | None = None,
    ) -> FilterValidationResult:
        """
        Update a single filter with retry loop.

        Iterates until filter validation passes or max attempts reached.
        """
        filter_id = filter_config.get("id", "unknown")
        filter_name = filter_config.get("name", f"Filter {filter_id}")
        attempt = 0
        previous_errors: list[str] = []

        while attempt < MAX_FILTER_ATTEMPTS:
            attempt += 1
            logger.debug(
                "Filter %s update attempt %d/%d",
                filter_name,
                attempt,
                MAX_FILTER_ATTEMPTS,
            )

            try:
                # Update dataset reference in targets
                for target in filter_config.get("targets", []):
                    target["datasetId"] = dataset_id

                    # Map column name
                    col_info = target.get("column", {})
                    if col_info:
                        old_name = col_info.get("name", "")
                        # Try direct mapping first
                        if old_name in column_mappings:
                            col_info["name"] = column_mappings[old_name]
                        # If not in mappings but in actual columns, keep it
                        elif old_name.lower() not in {c.lower() for c in actual_columns}:
                            # Need to find a matching column
                            if previous_errors:
                                # Use LLM to suggest alternative
                                suggested = self.llm_service.suggest_filter_column(
                                    filter_name=filter_name,
                                    original_column=old_name,
                                    available_columns=actual_columns,
                                    previous_errors=previous_errors,
                                )
                                if suggested:
                                    col_info["name"] = suggested
                                    # Adjust filter display name to reflect rescope
                                    filter_config["name"] = f"{filter_name} ({suggested})"
                            # Last resort: pick a fallback column to keep filter working
                            if not col_info.get("name") and actual_columns:
                                fallback_col = self._pick_fallback_filter_column(
                                    actual_columns, actual_types or {}
                                )
                                if fallback_col:
                                    col_info["name"] = fallback_col
                                    filter_config["name"] = f"{filter_name} ({fallback_col})"
                        elif not col_info.get("name") and actual_columns:
                            fallback_col = self._pick_fallback_filter_column(
                                actual_columns, actual_types or {}
                            )
                            if fallback_col:
                                col_info["name"] = fallback_col
                                filter_config["name"] = f"{filter_name} ({fallback_col})"

                # Validate the filter
                validation_result = self._validate_filter_execution(
                    filter_config, dataset
                )

                if validation_result.success:
                    return FilterValidationResult(
                        filter_id=filter_id,
                        filter_name=filter_name,
                        success=True,
                        attempts=attempt,
                        query_executed=True,
                    )
                else:
                    error_msg = validation_result.error_message or "Validation failed"
                    previous_errors.append(error_msg)
                    logger.warning(
                        "Filter %s validation failed (attempt %d): %s",
                        filter_name,
                        attempt,
                        error_msg,
                    )

            except Exception as e:
                error_msg = f"Update error: {str(e)}"
                previous_errors.append(error_msg)
                logger.warning(
                    "Filter %s update failed (attempt %d): %s",
                    filter_name,
                    attempt,
                    str(e),
                )

        # Max attempts reached
        return FilterValidationResult(
            filter_id=filter_id,
            filter_name=filter_name,
            success=False,
            error_message="; ".join(previous_errors[-2:]) if previous_errors else "Max attempts reached",
            attempts=attempt,
            query_executed=False,
        )

    def _validate_filter_execution(
        self,
        filter_config: dict[str, Any],
        dataset: SqlaTable | None,
    ) -> FilterValidationResult:
        """
        Validate filter by querying distinct values.

        This tests that the filter column exists and is queryable.
        """
        filter_id = filter_config.get("id", "unknown")
        filter_name = filter_config.get("name", f"Filter {filter_id}")

        try:
            targets = filter_config.get("targets", [])
            if not targets:
                return FilterValidationResult(
                    filter_id=filter_id,
                    filter_name=filter_name,
                    success=False,
                    error_message="No targets configured",
                )

            if not dataset:
                return FilterValidationResult(
                    filter_id=filter_id,
                    filter_name=filter_name,
                    success=False,
                    error_message="No dataset available",
                )

            column_name = targets[0].get("column", {}).get("name")
            if not column_name:
                return FilterValidationResult(
                    filter_id=filter_id,
                    filter_name=filter_name,
                    success=False,
                    error_message="No column specified",
                )

            # Check column exists in dataset
            dataset_columns = {c.column_name.lower() for c in dataset.columns}
            if column_name.lower() not in dataset_columns:
                # Also check the SQL directly if it's a virtual dataset
                if dataset.sql:
                    # Try to query it anyway
                    pass
                else:
                    return FilterValidationResult(
                        filter_id=filter_id,
                        filter_name=filter_name,
                        success=False,
                        error_message=f"Column '{column_name}' not in dataset",
                    )

            # Test query distinct values (what filter dropdown would show)
            if dataset.sql:
                test_sql = f'SELECT DISTINCT "{column_name}" FROM ({dataset.sql}) _filter_test LIMIT 100'
            else:
                table_ref = f'"{dataset.schema}"."{dataset.table_name}"' if dataset.schema else f'"{dataset.table_name}"'
                test_sql = f'SELECT DISTINCT "{column_name}" FROM {table_ref} LIMIT 100'

            with dataset.database.get_raw_connection(schema=dataset.schema) as conn:
                cursor = conn.cursor()
                cursor.execute(test_sql)
                rows = cursor.fetchall()

            return FilterValidationResult(
                filter_id=filter_id,
                filter_name=filter_name,
                success=True,
                query_executed=True,
            )

        except Exception as e:
            return FilterValidationResult(
                filter_id=filter_id,
                filter_name=filter_name,
                success=False,
                error_message=f"Query failed: {str(e)}",
                query_executed=False,
            )

    def _check_filter_inapplicability(
        self,
        filter_config: dict[str, Any],
        error_message: str,
        actual_columns: list[str],
    ) -> tuple[bool, str | None]:
        """
        Analyze if a filter is fundamentally inapplicable to the new dataset.

        Returns (is_inapplicable, reason) tuple.

        A filter is inapplicable when:
        1. It's a time-based filter but there's no datetime column
        2. It requires a specific column type that doesn't exist
        3. The filter concept doesn't apply to this dataset
        """
        filter_type = filter_config.get("filterType", "")
        targets = filter_config.get("targets", [])

        # Time filters without datetime columns are inapplicable
        if filter_type in ["filter_time", "filter_timecolumn", "filter_timegrain"]:
            # Check if we have any datetime columns
            datetime_keywords = ["date", "time", "dt", "created", "updated", "timestamp"]
            has_datetime = any(
                any(kw in col.lower() for kw in datetime_keywords)
                for col in actual_columns
            )
            if not has_datetime:
                return True, "Time-based filter requires a datetime column not available in dataset"

        # Check if the filter's target column has any semantic equivalent
        if "no column specified" in error_message.lower():
            if targets:
                target = targets[0]
                original_col = target.get("column", {}).get("name", "")
                if original_col:
                    # Check if any column is similar
                    has_similar = any(
                        original_col.lower() in col.lower() or col.lower() in original_col.lower()
                        for col in actual_columns
                    )
                    if not has_similar:
                        return True, f"Filter column '{original_col}' has no equivalent in dataset"

        return False, None

    # =========================================================================
    # Phase 6: QUALITY ASSESSMENT
    # =========================================================================

    def _node_quality_assessment(self, state: GeneratorState) -> GeneratorState:
        """
        Phase 6: QUALITY ASSESSMENT - Calculate scores and decide escalation.

        Quality = (working charts + working filters) / (total charts + total filters)
        If quality >= 85%, auto-finalize. Otherwise, escalate to human review.
        """
        logger.info("Phase 6: QUALITY ASSESSMENT")

        total_charts = state["charts_working"] + state["charts_failed"]
        total_filters = state["filters_working"] + state["filters_failed"]
        total_items = total_charts + total_filters

        if total_items == 0:
            overall_quality = 1.0  # No charts/filters = 100% quality
        else:
            working_items = state["charts_working"] + state["filters_working"]
            overall_quality = working_items / total_items

        # Check dataset status
        dataset_ok = (
            state["dataset_validation"] is not None
            and state["dataset_validation"].success
        )

        # If dataset failed, quality is 0
        if not dataset_ok:
            overall_quality = 0.0

        logger.info(
            "Quality assessment: dataset=%s, charts=%d/%d, filters=%d/%d, overall=%.1f%%",
            "OK" if dataset_ok else "FAILED",
            state["charts_working"],
            total_charts,
            state["filters_working"],
            total_filters,
            overall_quality * 100,
        )

        # Determine if human review is needed
        requires_review = overall_quality < QUALITY_THRESHOLD
        review_reasons = []

        if requires_review:
            if not dataset_ok:
                review_reasons.append("Dataset generation failed")
            if state["charts_failed"] > 0:
                review_reasons.append(f"{state['charts_failed']} charts failed")
            if state["filters_failed"] > 0:
                review_reasons.append(f"{state['filters_failed']} filters failed")

        return {
            **state,
            "current_phase": AgentPhase.QUALITY_ASSESSMENT.value,
            "overall_quality": overall_quality,
            "requires_human_review": requires_review,
            "review_reasons": review_reasons,
        }

    # =========================================================================
    # Phase 7: HUMAN REVIEW (Batched)
    # =========================================================================

    def _node_human_review(self, state: GeneratorState) -> GeneratorState:
        """
        Phase 7: HUMAN REVIEW - Prepare batched review request.

        Collects ALL failures and presents them for user to fix.
        This is only called if quality < 85% after all retries exhausted.
        """
        logger.info("Phase 7: HUMAN REVIEW - Preparing batched review request")

        failed_mappings = state.get("failed_mappings", [])

        logger.info(
            "Human review required: %d failed mappings to fix",
            len(failed_mappings),
        )

        return {
            **state,
            "current_phase": AgentPhase.HUMAN_REVIEW.value,
            "requires_human_review": True,
            "is_complete": True,
        }

    # =========================================================================
    # Phase 8: FINALIZE
    # =========================================================================

    def _node_finalize(self, state: GeneratorState) -> GeneratorState:
        """
        Phase 8: FINALIZE - Mark generation as complete.

        Called when quality >= 85% and no human review needed.
        """
        logger.info("Phase 8: FINALIZE - Generation complete")

        return {
            **state,
            "current_phase": AgentPhase.FINALIZE.value,
            "is_complete": True,
            "requires_human_review": False,
        }

    # =========================================================================
    # Routing Functions
    # =========================================================================

    def _route_after_quality_assessment(
        self, state: GeneratorState
    ) -> Literal["finalize", "human_review"]:
        """Route based on quality score."""
        if state["overall_quality"] >= QUALITY_THRESHOLD:
            return "finalize"
        return "human_review"

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _copy_dashboard(self, template: Dashboard, owner: Any | None = None) -> Dashboard:
        """Copy template dashboard with all charts and filters."""
        original_metadata = json.loads(template.json_metadata or "{}")

        # Template-related metadata keys to exclude from generated dashboards
        # These identify the dashboard as a template and should not be carried over
        # Note: template_info is the new nested structure containing all template metadata
        template_metadata_keys = {"template_info"}
        template_metadata_prefixes = (
            "is_template",  # is_template (legacy)
            "is_featured",  # is_featured_template (legacy)
            "template_",  # template_category, etc. (legacy)
        )

        copy_metadata = {
            k: v
            for k, v in original_metadata.items()
            if k not in template_metadata_keys
            and not k.startswith(template_metadata_prefixes)
        }

        if template.position_json:
            copy_metadata["positions"] = json.loads(template.position_json)

        copy_data = {
            "dashboard_title": f"{template.dashboard_title} (Generated)",
            "json_metadata": json.dumps(copy_metadata),
            "duplicate_slices": True,
        }

        new_dashboard = DashboardDAO.copy_dashboard(template, copy_data, owner=owner)
        db.session.flush()

        # IMPORTANT: DashboardDAO.copy_dashboard copies original_dash.params which includes
        # template fields. The set_dash_metadata call only updates specific fields, leaving
        # template fields intact. We must explicitly clean them after the copy.
        current_metadata = json.loads(new_dashboard.json_metadata or "{}")
        cleaned_metadata = {
            k: v
            for k, v in current_metadata.items()
            if k not in template_metadata_keys
            and not k.startswith(template_metadata_prefixes)
        }
        new_dashboard.json_metadata = json.dumps(cleaned_metadata)

        # Ensure all cloned charts are not marked as template charts
        # Also clean any template-related fields from chart params
        for chart in new_dashboard.slices:
            # Clear the model flag
            if chart.is_template_chart:
                chart.is_template_chart = False

            # Clean template-related fields from chart params if present
            if chart.params:
                try:
                    chart_params = json.loads(chart.params)
                    cleaned_params = {
                        k: v
                        for k, v in chart_params.items()
                        if not k.startswith(template_metadata_prefixes)
                    }
                    chart.params = json.dumps(cleaned_params)
                except (json.JSONDecodeError, TypeError):
                    pass  # Skip if params can't be parsed

        db.session.flush()

        return new_dashboard

    def _create_or_update_dataset(
        self,
        state: GeneratorState,
        sql: str,
        report: DatabaseSchemaReport,
    ) -> SqlaTable | None:
        """
        Create or update the virtual dataset.

        After creation, fetches metadata to:
        1. Detect and create column objects
        2. Identify temporal columns for time-series charts
        3. Set main_dttm_col automatically if a datetime column is found
        """
        if state["generated_dataset_id"]:
            dataset = db.session.query(SqlaTable).get(state["generated_dataset_id"])
            if dataset:
                dataset.sql = sql
                # Re-fetch metadata to sync columns after SQL change
                try:
                    dataset.fetch_metadata()
                except Exception as e:
                    logger.warning(
                        "Failed to fetch metadata for existing dataset: %s", str(e)
                    )
                db.session.commit()
                return dataset

        dataset = SqlaTable(
            table_name=f"generated_dataset_{state['run_id']}",
            database_id=report.database_id,
            schema=report.schema_name,
            sql=sql,
            is_sqllab_view=True,
            is_template_dataset=False,  # Explicitly not a template dataset
        )

        if hasattr(g, "user") and g.user:
            dataset.owners = [g.user]

        db.session.add(dataset)
        db.session.flush()

        # Fetch metadata to populate columns and set main_dttm_col
        # This is critical for time-series charts that require a datetime column
        try:
            # Avoid SA warnings about collection mutation during flush
            with db.session.no_autoflush:
                dataset.fetch_metadata()
            logger.info(
                "Dataset metadata fetched: %d columns, main_dttm_col=%s",
                len(dataset.columns),
                dataset.main_dttm_col,
            )
        except Exception as e:
            logger.warning("Failed to fetch metadata for new dataset: %s", str(e))
            # Fallback: try to detect datetime columns from column info
            self._try_set_datetime_column(dataset, state)

        db.session.commit()
        return dataset

    def _try_set_datetime_column(
        self, dataset: SqlaTable, state: GeneratorState
    ) -> None:
        """
        Fallback method to set main_dttm_col if fetch_metadata fails.

        Looks at the dataset_actual_columns and types from validation to
        find a suitable datetime column.
        """
        actual_types = state.get("dataset_actual_types", {})
        temporal_types = {"date", "datetime", "timestamp", "time"}

        for col_name, col_type in actual_types.items():
            type_lower = col_type.lower() if col_type else ""
            if any(t in type_lower for t in temporal_types):
                dataset.main_dttm_col = col_name
                logger.info(
                    "Set main_dttm_col to '%s' from actual types", col_name
                )
                return

        # Also check template requirements for temporal columns
        requirements = state.get("template_requirements")
        if requirements:
            for col in requirements.columns:
                if col.role == "temporal":
                    # Find matching column in actual columns
                    col_mappings = state.get("column_mappings", {})
                    mapped_name = col_mappings.get(col.name, col.name)
                    if mapped_name in state.get("dataset_actual_columns", []):
                        dataset.main_dttm_col = mapped_name
                        logger.info(
                            "Set main_dttm_col to '%s' from template requirements",
                            mapped_name,
                        )
                        return

    def _get_template_dataset(
        self, requirements: TemplateRequirements
    ) -> dict[str, Any]:
        """Extract template dataset info for LLM."""
        return {
            "columns": [
                {"name": c.name, "type": c.data_type, "role": c.role}
                for c in requirements.columns
            ],
            "metrics": [
                {
                    "name": m.name,
                    "expression": m.expression,
                    "aggregate": m.aggregate,
                }
                for m in requirements.metrics
            ],
            "filters": [
                {"name": f.filter_id, "column": f.target_column}
                for f in requirements.filters
            ],
            "sql": requirements.dataset_sql,
        }

    def _get_chart_requirements(
        self, requirements: TemplateRequirements
    ) -> list[dict[str, Any]]:
        """Extract chart requirements for LLM."""
        return [
            {
                "required_columns": [c.name for c in requirements.columns],
                "required_metrics": [m.name for m in requirements.metrics],
                "filter_columns": [
                    f.target_column for f in requirements.filters if f.target_column
                ],
            }
        ]

    def _format_pre_matches(self, proposal: MappingProposal) -> dict[str, Any]:
        """Format MappingProposal for LLM context."""
        return {
            "column_candidates": [
                {
                    "template": m.template_column,
                    "suggested": m.user_column,
                    "table": m.user_table,
                    "confidence": m.confidence,
                    "reasons": m.match_reasons,
                    "alternatives": m.alternatives,
                }
                for m in proposal.column_mappings
            ],
            "metric_candidates": [
                {
                    "template": m.template_metric,
                    "suggested": m.user_expression,
                    "confidence": m.confidence,
                    "reasons": m.match_reasons,
                }
                for m in proposal.metric_mappings
            ],
            "overall_confidence": proposal.overall_confidence,
        }

    def _update_run_from_state(
        self, run: DashboardGeneratorRun, state: GeneratorState
    ) -> None:
        """Update run record from final state."""
        from superset.models.dashboard_generator import GeneratorPhase

        run.generated_dashboard_id = state["generated_dashboard_id"]
        run.generated_dataset_id = state["generated_dataset_id"]
        run.column_mappings_json = json.dumps(state["column_mappings"])
        run.metric_mappings_json = json.dumps(state["metric_mappings"])

        # Update current_phase from state
        current_phase_str = state.get("current_phase")
        if current_phase_str:
            try:
                run.current_phase = GeneratorPhase(current_phase_str)
            except ValueError:
                # If AgentPhase doesn't map to GeneratorPhase, try mapping
                phase_mapping = {
                    AgentPhase.INIT.value: GeneratorPhase.COPY_DASHBOARD,
                    AgentPhase.COLLECT_REQUIREMENTS.value: GeneratorPhase.COPY_DASHBOARD,
                    AgentPhase.GENERATE_DATASET.value: GeneratorPhase.BUILD_DATASET_CHARTS,
                    AgentPhase.REFINE_MAPPINGS.value: GeneratorPhase.BUILD_DATASET_CHARTS,
                    AgentPhase.UPDATE_CHARTS.value: GeneratorPhase.UPDATE_CHARTS,
                    AgentPhase.UPDATE_FILTERS.value: GeneratorPhase.UPDATE_FILTERS,
                    AgentPhase.QUALITY_ASSESSMENT.value: GeneratorPhase.FINALIZE,
                    AgentPhase.HUMAN_REVIEW.value: GeneratorPhase.FINALIZE,
                    AgentPhase.APPLY_FIXES.value: GeneratorPhase.FINALIZE,
                    AgentPhase.FINALIZE.value: GeneratorPhase.FINALIZE,
                }
                run.current_phase = phase_mapping.get(current_phase_str)

        if state["is_complete"]:
            if state["requires_human_review"]:
                run.status = GeneratorStatus.PENDING_REVIEW
                run.error_message = "; ".join(state["review_reasons"])
            else:
                run.status = GeneratorStatus.COMPLETED

        if state.get("error"):
            run.status = GeneratorStatus.FAILED
            run.error_message = state["error"]

        run.end_dttm = datetime.now()
        run.progress_json = json.dumps(
            {
                "charts_total": state["charts_working"] + state["charts_failed"],
                "charts_done": state["charts_working"],
                "filters_total": state["filters_working"] + state["filters_failed"],
                "filters_done": state["filters_working"],
                "quality": state["overall_quality"],
                "failed_mappings": [
                    {
                        "type": f.item_type,
                        "id": f.item_id,
                        "name": f.item_name,
                        "error": f.error_reason,
                        "alternatives": f.available_alternatives,
                    }
                    for f in state.get("failed_mappings", [])
                ],
            }
        )
        db.session.commit()

    def _build_result(self, state: GeneratorState) -> dict[str, Any]:
        """Build result dictionary from state."""
        return {
            "status": (
                "completed"
                if not state["requires_human_review"]
                else "pending_review"
            ),
            "dashboard_id": state["generated_dashboard_id"],
            "dataset_id": state["generated_dataset_id"],
            "charts_total": state["charts_working"] + state["charts_failed"],
            "charts_working": state["charts_working"],
            "charts_failed": state["charts_failed"],
            "filters_total": state["filters_working"] + state["filters_failed"],
            "filters_working": state["filters_working"],
            "filters_failed": state["filters_failed"],
            "overall_quality": state["overall_quality"],
            "requires_human_review": state["requires_human_review"],
            "review_reasons": state["review_reasons"],
            "failed_mappings": [
                {
                    "type": f.item_type,
                    "id": f.item_id,
                    "name": f.item_name,
                    "error": f.error_reason,
                    "alternatives": f.available_alternatives,
                }
                for f in state.get("failed_mappings", [])
            ],
        }

    def _persist_progress(
        self,
        run_id: int,
        charts_total: int,
        charts_done: int,
        filters_total: int,
        filters_done: int,
    ) -> None:
        """
        Update run.progress_json incrementally so polling reflects in-progress counts.
        """
        try:
            run = db.session.query(DashboardGeneratorRun).get(run_id)
            if not run:
                return

            run.progress_json = json.dumps(
                {
                    "charts_total": charts_total,
                    "charts_done": charts_done,
                    "filters_total": filters_total,
                    "filters_done": filters_done,
                }
            )
            db.session.commit()
        except Exception:
            logger.debug("Could not persist progress update for run %s", run_id)
