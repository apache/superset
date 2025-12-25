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
Mapping Service for Dashboard Generation.

Provides confidence-scored column and metric mappings between
template requirements and user database schema.

Key features:
- Structural pre-matching (exact match, normalization, type checking)
- Confidence scoring to identify when review is needed
- LLM handles all semantic matching (synonyms, context, industry terms)
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from superset.commands.dashboard_generator.template_analyzer import (
    TemplateColumn,
    TemplateMetric,
    TemplateRequirements,
)
from superset.models.database_analyzer import (
    AnalyzedColumn,
    AnalyzedTable,
    DatabaseSchemaReport,
)
from superset.utils.core import GenericDataType

logger = logging.getLogger(__name__)


# Confidence thresholds
HIGH_CONFIDENCE_THRESHOLD = 0.85
MEDIUM_CONFIDENCE_THRESHOLD = 0.60


class ConfidenceLevel(str, Enum):
    """Confidence level for mapping quality."""

    HIGH = "high"  # ≥85% - Auto-approve
    MEDIUM = "medium"  # 60-84% - Warn but allow
    LOW = "low"  # <60% - Requires review
    FAILED = "failed"  # No match found


@dataclass
class ColumnMapping:
    """Represents a mapping from template column to user column."""

    template_column: str
    user_column: str | None
    user_table: str | None = None
    confidence: float = 0.0
    confidence_level: ConfidenceLevel = ConfidenceLevel.FAILED
    match_reasons: list[str] = field(default_factory=list)
    alternatives: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class MetricMapping:
    """Represents a mapping for a template metric."""

    template_metric: str
    user_expression: str | None = None
    confidence: float = 0.0
    confidence_level: ConfidenceLevel = ConfidenceLevel.FAILED
    match_reasons: list[str] = field(default_factory=list)
    alternatives: list[str] = field(default_factory=list)


@dataclass
class MappingProposal:
    """Complete mapping proposal with confidence scores."""

    proposal_id: str
    column_mappings: list[ColumnMapping] = field(default_factory=list)
    metric_mappings: list[MetricMapping] = field(default_factory=list)
    unmapped_columns: list[str] = field(default_factory=list)
    unmapped_metrics: list[str] = field(default_factory=list)
    requires_review: bool = False
    review_reasons: list[str] = field(default_factory=list)
    overall_confidence: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "proposal_id": self.proposal_id,
            "column_mappings": [
                {
                    "template_column": m.template_column,
                    "user_column": m.user_column,
                    "user_table": m.user_table,
                    "confidence": m.confidence,
                    "confidence_level": m.confidence_level.value,
                    "match_reasons": m.match_reasons,
                    "alternatives": m.alternatives,
                }
                for m in self.column_mappings
            ],
            "metric_mappings": [
                {
                    "template_metric": m.template_metric,
                    "user_expression": m.user_expression,
                    "confidence": m.confidence,
                    "confidence_level": m.confidence_level.value,
                    "match_reasons": m.match_reasons,
                    "alternatives": m.alternatives,
                }
                for m in self.metric_mappings
            ],
            "unmapped_columns": self.unmapped_columns,
            "unmapped_metrics": self.unmapped_metrics,
            "requires_review": self.requires_review,
            "review_reasons": self.review_reasons,
            "overall_confidence": self.overall_confidence,
        }


class MappingService:
    """
    Service for generating confidence-scored column/metric mappings.

    Uses a hybrid approach:
    1. Structural pre-matching (exact names, type compatibility)
    2. Confidence scoring based on multiple factors
    3. LLM handles semantic matching (synonyms, context-aware reasoning)
    """

    def propose_mappings(
        self,
        template_requirements: TemplateRequirements,
        database_report: DatabaseSchemaReport,
    ) -> MappingProposal:
        """
        Generate mapping proposal with confidence scores.

        :param template_requirements: Extracted template requirements
        :param database_report: Analyzed user database schema
        :return: MappingProposal with confidence-scored mappings
        """
        logger.info("Generating mapping proposal")

        proposal = MappingProposal(proposal_id=str(uuid.uuid4()))

        # Build flat list of all columns from report
        user_columns = self._extract_user_columns(database_report)

        # Match columns
        for template_col in template_requirements.columns:
            mapping = self._match_column(template_col, user_columns)
            proposal.column_mappings.append(mapping)

            if mapping.confidence_level == ConfidenceLevel.FAILED:
                proposal.unmapped_columns.append(template_col.name)

        # Match metrics
        for template_metric in template_requirements.metrics:
            mapping = self._match_metric(template_metric, user_columns)
            proposal.metric_mappings.append(mapping)

            if mapping.confidence_level == ConfidenceLevel.FAILED:
                proposal.unmapped_metrics.append(template_metric.name)

        # Determine if review is needed
        proposal.requires_review = self._check_requires_review(proposal)
        proposal.review_reasons = self._get_review_reasons(proposal)
        proposal.overall_confidence = self._calculate_overall_confidence(proposal)

        logger.info(
            "Mapping proposal generated: %d columns, %d metrics, requires_review=%s",
            len(proposal.column_mappings),
            len(proposal.metric_mappings),
            proposal.requires_review,
        )

        return proposal

    def _extract_user_columns(
        self, report: DatabaseSchemaReport
    ) -> list[tuple[AnalyzedTable, AnalyzedColumn]]:
        """Extract all columns from database report with their tables."""
        columns = []
        for table in report.tables:
            for col in table.columns:
                columns.append((table, col))
        return columns

    def _match_column(
        self,
        template_col: TemplateColumn,
        user_columns: list[tuple[AnalyzedTable, AnalyzedColumn]],
    ) -> ColumnMapping:
        """Match a template column to the best user column."""
        candidates: list[tuple[float, list[str], AnalyzedTable, AnalyzedColumn]] = []

        for table, col in user_columns:
            score, reasons = self._calculate_column_score(template_col, col)
            if score > 0.3:  # Minimum threshold for candidates
                candidates.append((score, reasons, table, col))

        # Sort by score descending
        candidates.sort(key=lambda x: x[0], reverse=True)

        if not candidates:
            return ColumnMapping(
                template_column=template_col.name,
                user_column=None,
                confidence=0.0,
                confidence_level=ConfidenceLevel.FAILED,
                match_reasons=["No matching column found"],
            )

        # Best match
        best_score, best_reasons, best_table, best_col = candidates[0]
        confidence_level = self._score_to_confidence_level(best_score)

        # Build alternatives from remaining candidates
        alternatives = [
            {
                "column": c[3].column_name,
                "table": c[2].table_name,
                "confidence": c[0],
            }
            for c in candidates[1:5]  # Top 4 alternatives
        ]

        return ColumnMapping(
            template_column=template_col.name,
            user_column=best_col.column_name,
            user_table=best_table.table_name,
            confidence=best_score,
            confidence_level=confidence_level,
            match_reasons=best_reasons,
            alternatives=alternatives,
        )

    def _calculate_column_score(
        self,
        template_col: TemplateColumn,
        user_col: AnalyzedColumn,
    ) -> tuple[float, list[str]]:
        """
        Calculate match score for a column pair.

        Scoring factors (weighted):
        - Name similarity (40%): Fuzzy string match
        - Type compatibility (35%): Same GenericDataType
        - Role match (15%): temporal/dimension/measure
        - AI description match (10%): Semantic hints from AI descriptions
        """
        score = 0.0
        reasons: list[str] = []

        # Name similarity (40%)
        name_score = self._calculate_name_similarity(
            template_col.name, user_col.column_name
        )
        score += name_score * 0.40
        if name_score > 0.8:
            reasons.append(f"Strong name match ({name_score:.0%})")
        elif name_score > 0.5:
            reasons.append(f"Partial name match ({name_score:.0%})")

        # Type compatibility (35%)
        type_score = self._calculate_type_compatibility(
            template_col.type_generic, user_col.type_generic
        )
        score += type_score * 0.35
        if type_score == 1.0:
            reasons.append("Type compatible")
        elif type_score > 0:
            reasons.append("Type partially compatible")

        # Role match (15%)
        role_score = self._calculate_role_match(template_col, user_col)
        score += role_score * 0.15
        if role_score == 1.0:
            reasons.append(f"Role matches ({template_col.role})")

        # AI description match (10%)
        semantic_score = self._calculate_semantic_match(
            template_col.name, user_col.ai_description
        )
        score += semantic_score * 0.10
        if semantic_score > 0.5:
            reasons.append("Semantic match in AI description")

        return score, reasons

    def _calculate_name_similarity(self, name1: str, name2: str) -> float:
        """
        Calculate basic name similarity using normalization.

        Only performs simple structural matching:
        - Exact match after normalization
        - Common abbreviation patterns

        Semantic matching (synonyms, fuzzy matching, industry terms) is
        delegated to the LLM reasoning loop which has better cross-industry
        coverage and handles context-aware matching.
        """
        # Normalize: lowercase, replace separators with spaces
        n1 = name1.lower().replace("_", " ").replace("-", " ").strip()
        n2 = name2.lower().replace("_", " ").replace("-", " ").strip()

        # Exact match after normalization
        if n1 == n2:
            return 1.0

        # Also check without spaces (order_id vs orderid)
        n1_compact = n1.replace(" ", "")
        n2_compact = n2.replace(" ", "")
        if n1_compact == n2_compact:
            return 0.95

        # Check if one is contained in the other (customer vs customer_id)
        if n1_compact in n2_compact or n2_compact in n1_compact:
            return 0.7

        # Check prefix match (cust vs customer) - at least 3 chars
        min_prefix = min(len(n1_compact), len(n2_compact), 3)
        if min_prefix >= 3 and n1_compact[:min_prefix] == n2_compact[:min_prefix]:
            return 0.5

        # No structural match - LLM will handle semantic matching
        return 0.0

    def _calculate_type_compatibility(
        self,
        type1: GenericDataType | None,
        type2: GenericDataType | None,
    ) -> float:
        """Check if types are compatible for mapping."""
        if type1 is None or type2 is None:
            return 0.5  # Unknown type - partial match

        if type1 == type2:
            return 1.0

        # Partial compatibility
        compatible_groups = [
            {GenericDataType.NUMERIC},
            {GenericDataType.STRING},
            {GenericDataType.TEMPORAL},
            {GenericDataType.BOOLEAN},
        ]

        for group in compatible_groups:
            if type1 in group and type2 in group:
                return 0.8

        return 0.3  # Different types - low score

    def _calculate_role_match(
        self,
        template_col: TemplateColumn,
        user_col: AnalyzedColumn,
    ) -> float:
        """Calculate role match score."""
        # Infer user column role from type
        user_role = "dimension"
        if user_col.type_generic == GenericDataType.TEMPORAL:
            user_role = "temporal"
        elif user_col.type_generic == GenericDataType.NUMERIC:
            user_role = "measure"

        if template_col.role == user_role:
            return 1.0
        return 0.3

    def _calculate_semantic_match(
        self,
        template_name: str,
        ai_description: str | None,
    ) -> float:
        """Check if template column name appears in AI description."""
        if not ai_description:
            return 0.0

        template_lower = template_name.lower().replace("_", " ")
        desc_lower = ai_description.lower()

        if template_lower in desc_lower:
            return 1.0

        # Check for semantic keywords
        words = template_lower.split()
        matches = sum(1 for w in words if w in desc_lower and len(w) > 2)
        if words:
            return matches / len(words) * 0.8

        return 0.0

    def _match_metric(
        self,
        template_metric: TemplateMetric,
        user_columns: list[tuple[AnalyzedTable, AnalyzedColumn]],
    ) -> MetricMapping:
        """Match a template metric to a user expression."""
        # For simple aggregates, try to find matching column
        if template_metric.aggregate and template_metric.base_column:
            # Look for the base column
            best_match = None
            best_score = 0.0

            for table, col in user_columns:
                score = self._calculate_name_similarity(
                    template_metric.base_column, col.column_name
                )
                # Prefer numeric columns for aggregates
                if col.type_generic == GenericDataType.NUMERIC:
                    score *= 1.2

                if score > best_score:
                    best_score = score
                    best_match = (table, col)

            if best_match and best_score > 0.5:
                table, col = best_match
                expression = f"{template_metric.aggregate}({col.column_name})"
                confidence = min(best_score, 1.0)

                return MetricMapping(
                    template_metric=template_metric.name,
                    user_expression=expression,
                    confidence=confidence,
                    confidence_level=self._score_to_confidence_level(confidence),
                    match_reasons=[
                        f"Aggregate {template_metric.aggregate} on {col.column_name}"
                    ],
                )

        # For COUNT(*), high confidence
        if template_metric.expression and "COUNT(*)" in template_metric.expression.upper():
            return MetricMapping(
                template_metric=template_metric.name,
                user_expression="COUNT(*)",
                confidence=0.95,
                confidence_level=ConfidenceLevel.HIGH,
                match_reasons=["COUNT(*) is universal"],
            )

        # For named metrics, try to match by name
        for table, col in user_columns:
            name_score = self._calculate_name_similarity(
                template_metric.name, col.column_name
            )
            if name_score > 0.7 and col.type_generic == GenericDataType.NUMERIC:
                return MetricMapping(
                    template_metric=template_metric.name,
                    user_expression=f"SUM({col.column_name})",
                    confidence=name_score * 0.8,
                    confidence_level=self._score_to_confidence_level(name_score * 0.8),
                    match_reasons=[f"Name match with numeric column {col.column_name}"],
                    alternatives=[f"AVG({col.column_name})", f"MAX({col.column_name})"],
                )

        # No good match found
        return MetricMapping(
            template_metric=template_metric.name,
            user_expression=None,
            confidence=0.0,
            confidence_level=ConfidenceLevel.FAILED,
            match_reasons=["No matching metric found"],
        )

    def _score_to_confidence_level(self, score: float) -> ConfidenceLevel:
        """Convert numeric score to confidence level."""
        if score >= HIGH_CONFIDENCE_THRESHOLD:
            return ConfidenceLevel.HIGH
        if score >= MEDIUM_CONFIDENCE_THRESHOLD:
            return ConfidenceLevel.MEDIUM
        if score > 0:
            return ConfidenceLevel.LOW
        return ConfidenceLevel.FAILED

    def _check_requires_review(self, proposal: MappingProposal) -> bool:
        """Determine if proposal requires user review."""
        # Review needed if any mapping is low confidence or failed
        for mapping in proposal.column_mappings:
            if mapping.confidence_level in (ConfidenceLevel.LOW, ConfidenceLevel.FAILED):
                return True

        for mapping in proposal.metric_mappings:
            if mapping.confidence_level in (ConfidenceLevel.LOW, ConfidenceLevel.FAILED):
                return True

        # Review needed if there are unmapped items
        if proposal.unmapped_columns or proposal.unmapped_metrics:
            return True

        return False

    def _get_review_reasons(self, proposal: MappingProposal) -> list[str]:
        """Get reasons why review is needed."""
        reasons = []

        low_confidence_cols = [
            m.template_column
            for m in proposal.column_mappings
            if m.confidence_level in (ConfidenceLevel.LOW, ConfidenceLevel.FAILED)
        ]
        if low_confidence_cols:
            reasons.append(
                f"Low confidence column mappings: {', '.join(low_confidence_cols)}"
            )

        low_confidence_metrics = [
            m.template_metric
            for m in proposal.metric_mappings
            if m.confidence_level in (ConfidenceLevel.LOW, ConfidenceLevel.FAILED)
        ]
        if low_confidence_metrics:
            reasons.append(
                f"Low confidence metric mappings: {', '.join(low_confidence_metrics)}"
            )

        if proposal.unmapped_columns:
            reasons.append(
                f"Unmapped columns: {', '.join(proposal.unmapped_columns)}"
            )

        if proposal.unmapped_metrics:
            reasons.append(
                f"Unmapped metrics: {', '.join(proposal.unmapped_metrics)}"
            )

        return reasons

    def _calculate_overall_confidence(self, proposal: MappingProposal) -> float:
        """Calculate overall confidence score for the proposal."""
        all_confidences = []

        for mapping in proposal.column_mappings:
            all_confidences.append(mapping.confidence)

        for mapping in proposal.metric_mappings:
            all_confidences.append(mapping.confidence)

        if not all_confidences:
            return 0.0

        return sum(all_confidences) / len(all_confidences)
