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
from concurrent.futures import as_completed, ThreadPoolExecutor
from typing import Any

from flask import current_app, Flask
from sqlalchemy import inspect, MetaData, text

from superset import db
from superset.commands.base import BaseCommand
from superset.commands.database_analyzer.llm_service import LLMService
from superset.models.core import Database
from superset.models.database_analyzer import (
    AnalyzedColumn,
    AnalyzedTable,
    DatabaseSchemaReport,
    InferredJoin,
    TableType,
)
from superset.utils import json

logger = logging.getLogger(__name__)


class AnalyzeDatabaseSchemaCommand(BaseCommand):
    """Command to analyze database schema and generate metadata"""

    def __init__(self, report_id: int):
        self.report_id = report_id
        self.report: DatabaseSchemaReport | None = None
        self.database: Database | None = None
        self.llm_service = LLMService()

    def run(self) -> dict[str, Any]:
        """Execute the analysis"""
        self.validate()

        # After validate(), report and database are guaranteed to be set
        assert self.report is not None
        assert self.database is not None

        # Extract schema information
        tables_data = self._extract_schema_info()

        # Store basic metadata
        self._store_tables_and_columns(tables_data)

        # Augment with AI descriptions (parallel processing)
        self._augment_with_ai_descriptions()

        # Infer joins using AI
        self._infer_joins_with_ai()

        # Validate the analysis confidence
        self._validate_analysis_confidence()

        return {
            "tables_count": len(self.report.tables),
            "joins_count": len(self.report.joins),
            "confidence_score": self.report.confidence_score,
        }

    def validate(self) -> None:
        """Validate the command can be executed"""
        self.report = db.session.query(DatabaseSchemaReport).get(self.report_id)
        if not self.report:
            raise ValueError(f"Report with id {self.report_id} not found")

        self.database = self.report.database
        if not self.database:
            raise ValueError(f"Database with id {self.report.database_id} not found")

    def _extract_schema_info(self) -> list[dict[str, Any]]:
        """Extract schema information from the database"""
        assert self.report is not None
        assert self.database is not None

        logger.info(
            "Extracting schema info for database %s schema %s",
            self.database.id,
            self.report.schema_name,
        )

        tables_data = []

        with self.database.get_sqla_engine() as engine:
            inspector = inspect(engine)
            metadata = MetaData()
            metadata.reflect(engine, schema=self.report.schema_name)

            # Get all tables and views
            table_names = inspector.get_table_names(schema=self.report.schema_name)
            view_names = inspector.get_view_names(schema=self.report.schema_name)

            # Process tables
            for table_name in table_names:
                table_info = self._extract_table_info(
                    inspector, engine, table_name, TableType.TABLE
                )
                tables_data.append(table_info)

            # Process views
            for view_name in view_names:
                view_info = self._extract_table_info(
                    inspector, engine, view_name, TableType.VIEW
                )
                tables_data.append(view_info)

        return tables_data

    def _extract_table_info(
        self,
        inspector: Any,
        engine: Any,
        table_name: str,
        table_type: TableType,
    ) -> dict[str, Any]:
        """Extract information for a single table/view"""
        assert self.report is not None

        logger.debug("Extracting info for %s: %s", table_type.value, table_name)

        # Get columns
        columns = inspector.get_columns(table_name, schema=self.report.schema_name)

        # Get primary keys
        pk_constraint = inspector.get_pk_constraint(
            table_name, schema=self.report.schema_name
        )
        primary_keys = pk_constraint["constrained_columns"] if pk_constraint else []

        # Get foreign keys
        foreign_keys = inspector.get_foreign_keys(
            table_name, schema=self.report.schema_name
        )
        fk_columns = set()
        for fk in foreign_keys:
            fk_columns.update(fk["constrained_columns"])

        # Get table comment
        table_comment = None
        try:
            schema = self.report.schema_name
            comment_sql = (  # noqa: S608
                f"SELECT obj_description('{schema}.{table_name}'::regclass, 'pg_class')"
            )
            result = engine.execute(text(comment_sql))
            row = result.fetchone()
            table_comment = row[0] if row else None
        except Exception:
            logger.debug("Could not fetch table comment for %s", table_name)

        # Get sample data (3 random rows)
        sample_rows = []
        schema = self.report.schema_name
        if table_type == TableType.TABLE:
            try:
                # Use ORDER BY RANDOM() for better sampling on small tables
                sample_sql = (
                    f'SELECT * FROM "{schema}"."{table_name}" '  # noqa: S608
                    f"ORDER BY RANDOM() LIMIT 3"
                )
                result = engine.execute(text(sample_sql))
                for row in result:
                    sample_rows.append(dict(row))
                logger.debug(
                    "Fetched %d sample rows from %s", len(sample_rows), table_name
                )
            except Exception:
                # Fallback to regular LIMIT if RANDOM() not supported
                try:
                    fallback_sql = f'SELECT * FROM "{schema}"."{table_name}" LIMIT 3'  # noqa: S608, E501
                    result = engine.execute(text(fallback_sql))
                    for row in result:
                        sample_rows.append(dict(row))
                    logger.debug(
                        "Fetched %d sample rows from %s (fallback)",
                        len(sample_rows),
                        table_name,
                    )
                except Exception as e2:
                    logger.warning(
                        "Could not fetch sample data for %s: %s", table_name, str(e2)
                    )

        # Get row count (try reltuples first, fallback to actual count)
        row_count = None
        try:
            # Try reltuples first (faster for large tables)
            count_sql = (
                f"SELECT reltuples::BIGINT FROM pg_class "  # noqa: S608
                f"WHERE oid = '{schema}.{table_name}'::regclass"
            )
            result = engine.execute(text(count_sql))
            row = result.fetchone()
            row_count = row[0] if row and row[0] >= 0 else None

            # If reltuples is -1 or None, get actual count for small tables
            if row_count is None or row_count < 0:
                actual_count_sql = f'SELECT COUNT(*) FROM "{schema}"."{table_name}"'  # noqa: S608
                result = engine.execute(text(actual_count_sql))
                row_count = result.fetchone()[0]
                logger.debug("Used actual count for %s: %d", table_name, row_count)
            else:
                logger.debug("Used reltuples for %s: %d", table_name, row_count)
        except Exception as e:
            logger.warning("Could not fetch row count for %s: %s", table_name, str(e))

        # Process column information
        columns_info = []
        for idx, col in enumerate(columns, start=1):
            col_info = {
                "name": col["name"],
                "type": str(col["type"]),
                "position": idx,
                "nullable": col.get("nullable", True),
                "is_primary_key": col["name"] in primary_keys,
                "is_foreign_key": col["name"] in fk_columns,
                "comment": col.get("comment"),
            }
            columns_info.append(col_info)

        return {
            "name": table_name,
            "type": table_type,
            "comment": table_comment,
            "columns": columns_info,
            "sample_rows": sample_rows,
            "row_count": row_count,
            "foreign_keys": foreign_keys,
        }

    def _store_tables_and_columns(self, tables_data: list[dict[str, Any]]) -> None:
        """Store extracted table and column metadata"""
        logger.info("Storing tables and columns metadata")

        for table_data in tables_data:
            # Create table record
            table = AnalyzedTable(
                report_id=self.report_id,
                table_name=table_data["name"],
                table_type=table_data["type"],
                db_comment=table_data["comment"],
                extra_json=json.dumps(
                    {
                        "row_count_estimate": table_data["row_count"],
                        "sample_rows": table_data["sample_rows"],
                        "foreign_keys": table_data["foreign_keys"],
                    }
                ),
            )
            db.session.add(table)
            db.session.flush()  # Get the table ID

            # Create column records
            for col_data in table_data["columns"]:
                column = AnalyzedColumn(
                    table_id=table.id,
                    column_name=col_data["name"],
                    data_type=col_data["type"],
                    ordinal_position=col_data["position"],
                    is_primary_key=col_data["is_primary_key"],
                    is_foreign_key=col_data["is_foreign_key"],
                    db_comment=col_data["comment"],
                    extra_json=json.dumps(
                        {
                            "is_nullable": col_data["nullable"],
                        }
                    ),
                )
                db.session.add(column)

        db.session.commit()  # pylint: disable=consider-using-transaction

    def _augment_with_ai_descriptions(self) -> None:
        """Use LLM to generate AI descriptions for tables and columns"""
        assert self.report is not None

        logger.info("Generating AI descriptions for tables and columns")

        if not self.llm_service.is_available():
            logger.warning("LLM service not available, skipping AI augmentation")
            return

        # Process tables in parallel
        tables = self.report.tables
        if not tables:
            logger.warning("No tables to augment with AI descriptions")
            return

        max_workers = min(10, len(tables))

        # Capture the current Flask app context
        app = current_app._get_current_object()

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_table = {
                executor.submit(self._augment_table_with_ai_context, app, table): table
                for table in tables
            }

            for future in as_completed(future_to_table):
                table = future_to_table[future]
                try:
                    future.result()
                except Exception as e:
                    logger.error(
                        "Failed to generate AI description for table %s: %s",
                        table.table_name,
                        str(e),
                    )

    def _augment_table_with_ai_context(self, app: Flask, table: AnalyzedTable) -> None:
        """Wrapper to provide Flask context to the AI description thread"""
        with app.app_context():
            self._augment_table_with_ai(table)

    def _augment_table_with_ai(self, table: AnalyzedTable) -> None:
        """Generate AI descriptions for a single table and its columns"""
        try:
            # Prepare context for LLM
            extra_json = json.loads(table.extra_json or "{}")
            sample_rows = extra_json.get("sample_rows", [])

            columns_info = []
            for col in table.columns:
                col_extra = json.loads(col.extra_json or "{}")
                columns_info.append(
                    {
                        "name": col.column_name,
                        "type": col.data_type,
                        "nullable": col_extra.get("is_nullable", True),
                        "is_pk": col_extra.get("is_primary_key", False),
                        "is_fk": col_extra.get("is_foreign_key", False),
                        "comment": col.db_comment,
                    }
                )

            # Generate descriptions
            result = self.llm_service.generate_table_descriptions(
                table_name=table.table_name,
                table_comment=table.db_comment,
                columns=columns_info,
                sample_data=sample_rows,
            )

            # Update table description
            table.ai_description = result.get("table_description")

            # Update column descriptions
            col_descriptions = result.get("column_descriptions", {})
            for col in table.columns:
                if col.column_name in col_descriptions:
                    col.ai_description = col_descriptions[col.column_name]

            db.session.commit()  # pylint: disable=consider-using-transaction

        except Exception as e:
            logger.error(
                "Error generating AI descriptions for table %s: %s",
                table.table_name,
                str(e),
            )
            db.session.rollback()  # pylint: disable=consider-using-transaction

    def _infer_joins_with_ai(self) -> None:
        """Use LLM to infer potential joins between tables"""
        assert self.report is not None

        logger.info("Inferring joins between tables using AI")

        if not self.llm_service.is_available():
            logger.warning("LLM service not available, skipping join inference")
            return

        tables = self.report.tables
        if len(tables) < 2:
            logger.info("Not enough tables to infer joins")
            return

        # Prepare schema context
        schema_context = []
        for table in tables:
            table_info = {
                "name": table.table_name,
                "description": table.ai_description or table.db_comment,
                "columns": [],
            }

            for col in table.columns:
                col_extra = json.loads(col.extra_json or "{}")
                table_info["columns"].append(
                    {
                        "name": col.column_name,
                        "type": col.data_type,
                        "description": col.ai_description or col.db_comment,
                        "is_pk": col_extra.get("is_primary_key", False),
                        "is_fk": col_extra.get("is_foreign_key", False),
                    }
                )

            schema_context.append(table_info)

        # Get existing foreign key relationships
        existing_fks = self._get_existing_foreign_keys()

        # Use LLM to infer joins
        try:
            inferred_joins = self.llm_service.infer_joins(
                schema_context=schema_context,
                existing_foreign_keys=existing_fks,
            )

            # Store inferred joins
            self._store_inferred_joins(inferred_joins)

        except Exception as e:
            logger.error("Error inferring joins with AI: %s", str(e))

    def _get_existing_foreign_keys(self) -> list[dict[str, Any]]:
        """Get existing foreign key relationships from extracted metadata"""
        assert self.report is not None

        existing_fks = []

        for table in self.report.tables:
            extra_json = json.loads(table.extra_json or "{}")
            foreign_keys = extra_json.get("foreign_keys", [])

            for fk in foreign_keys:
                existing_fks.append(
                    {
                        "source_table": table.table_name,
                        "source_columns": fk["constrained_columns"],
                        "target_table": fk["referred_table"],
                        "target_columns": fk["referred_columns"],
                    }
                )

        return existing_fks

    def _store_inferred_joins(self, inferred_joins: list[dict[str, Any]]) -> None:
        """Store the inferred joins in the database"""
        assert self.report is not None

        logger.info("Storing %d inferred joins", len(inferred_joins))

        # Create lookup for table IDs
        table_lookup = {table.table_name: table.id for table in self.report.tables}

        # Debug logging to see actual data being stored
        for i, join_data in enumerate(inferred_joins):
            logger.debug(
                "Join %d data: join_type=%s, cardinality=%s",
                i,
                join_data.get("join_type"),
                join_data.get("cardinality"),
            )

        for join_data in inferred_joins:
            source_table_id = table_lookup.get(join_data["source_table"])
            target_table_id = table_lookup.get(join_data["target_table"])

            if not source_table_id or not target_table_id:
                logger.warning(
                    "Skipping join %s -> %s: table not found",
                    join_data.get("source_table"),
                    join_data.get("target_table"),
                )
                continue

            join = InferredJoin(
                report_id=self.report_id,
                source_table_id=source_table_id,
                target_table_id=target_table_id,
                source_columns=json.dumps(join_data["source_columns"]),
                target_columns=json.dumps(join_data["target_columns"]),
                join_type=join_data.get("join_type", "inner"),
                cardinality=join_data.get("cardinality", "N:1"),
                semantic_context=join_data.get("semantic_context"),
                extra_json=json.dumps(
                    {
                        "confidence_score": join_data.get("confidence_score", 0.5),
                        "suggested_by": join_data.get("suggested_by", "ai_inference"),
                    }
                ),
            )
            db.session.add(join)

        db.session.commit()  # pylint: disable=consider-using-transaction

    def _validate_analysis_confidence(self) -> None:
        """Use another LLM to validate the confidence of the analysis"""
        assert self.report is not None

        logger.info("Validating analysis confidence using LLM")

        if not self.llm_service.is_available():
            logger.warning("LLM service not available, skipping confidence validation")
            return

        try:
            # Prepare data for validation
            tables_data = []
            for table in self.report.tables:
                extra_json = json.loads(table.extra_json or "{}")
                tables_data.append(
                    {
                        "name": table.table_name,
                        "type": table.table_type.value if table.table_type else "table",
                        "columns_count": len(table.columns),
                        "row_count": extra_json.get("row_count_estimate"),
                        "ai_description": table.ai_description,
                        "has_description": bool(
                            table.ai_description or table.db_comment
                        ),
                    }
                )

            joins_data = []
            for join in self.report.joins:
                extra_json = json.loads(join.extra_json or "{}")
                joins_data.append(
                    {
                        "source_table": join.source_table.table_name,
                        "source_columns": json.loads(join.source_columns),
                        "target_table": join.target_table.table_name,
                        "target_columns": json.loads(join.target_columns),
                        "join_type": join.join_type.value
                        if join.join_type
                        else "inner",
                        "cardinality": join.cardinality.value
                        if join.cardinality
                        else "N:1",
                        "confidence_score": extra_json.get("confidence_score", 0.5),
                        "semantic_context": join.semantic_context,
                    }
                )

            # Collect all AI descriptions
            ai_descriptions = {
                "tables": {
                    table.table_name: table.ai_description
                    for table in self.report.tables
                    if table.ai_description
                },
                "columns": {},
            }
            for table in self.report.tables:
                for col in table.columns:
                    if col.ai_description:
                        key = f"{table.table_name}.{col.column_name}"
                        ai_descriptions["columns"][key] = col.ai_description

            # Call validation service
            validation_result = self.llm_service.validate_analysis_confidence(
                schema_name=self.report.schema_name,
                tables=tables_data,
                joins=joins_data,
                ai_descriptions=ai_descriptions,
            )

            # Store validation results
            self.report.confidence_score = validation_result.get(
                "overall_confidence", 0.5
            )
            self.report.confidence_breakdown = json.dumps(
                validation_result.get("confidence_breakdown", {})
            )

            # Combine recommendations and potential issues
            all_recommendations = []
            all_recommendations.extend(validation_result.get("recommendations", []))
            all_recommendations.extend(validation_result.get("potential_issues", []))

            self.report.confidence_recommendations = json.dumps(all_recommendations)
            self.report.confidence_validation_notes = validation_result.get(
                "validation_notes", ""
            )

            db.session.commit()  # pylint: disable=consider-using-transaction

            logger.info(
                "Confidence validation complete. Score: %.2f",
                self.report.confidence_score or 0.5,
            )

        except Exception as e:
            logger.error("Error validating analysis confidence: %s", str(e))
            # Set default confidence if validation fails
            self.report.confidence_score = 0.5
            self.report.confidence_validation_notes = f"Validation error: {str(e)}"
            db.session.commit()  # pylint: disable=consider-using-transaction
