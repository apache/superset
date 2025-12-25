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
import uuid
from datetime import datetime
from typing import Any

from celery import Task
from celery.exceptions import SoftTimeLimitExceeded

from superset import db
from superset.extensions import celery_app
from superset.models.database_analyzer import (
    AnalysisStatus,
    DatabaseSchemaReport,
)

logger = logging.getLogger(__name__)


class DatabaseAnalyzerTask(Task):
    """Base task class for database analyzer with retry logic"""

    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True


@celery_app.task(
    name="analyze_database_schema",
    base=DatabaseAnalyzerTask,
    soft_time_limit=3600,  # 1 hour soft limit
    time_limit=3900,  # 1 hour 5 min hard limit
    bind=True,
)
def analyze_database_schema(self: Task, report_id: int) -> dict[str, Any]:
    """
    Celery task to analyze database schema and generate metadata.

    :param report_id: ID of the DatabaseSchemaReport to process
    :return: Dict with status and results
    """
    # Import here to avoid circular imports and to get the Flask app
    from superset import create_app
    from superset.commands.database_analyzer.analyze import (
        AnalyzeDatabaseSchemaCommand,
    )

    logger.info("Starting database schema analysis for report_id: %s", report_id)

    # Use Flask app context for database operations
    flask_app = create_app()
    with flask_app.app_context():
        try:
            # Update status to running
            report = db.session.query(DatabaseSchemaReport).get(report_id)
            if not report:
                logger.error("Report with id %s not found", report_id)
                return {"status": "error", "message": f"Report {report_id} not found"}

            report.status = AnalysisStatus.RUNNING
            report.start_dttm = datetime.now()
            db.session.commit()  # pylint: disable=consider-using-transaction

            # Execute the analysis command
            command = AnalyzeDatabaseSchemaCommand(report_id)
            result = command.run()

            # Update status to completed
            report.status = AnalysisStatus.COMPLETED
            report.end_dttm = datetime.now()
            db.session.commit()  # pylint: disable=consider-using-transaction

            logger.info(
                "Successfully completed analysis for report_id: %s", report_id
            )
            return {
                "status": "completed",
                "database_report_id": report_id,
                "tables_analyzed": result.get("tables_count", 0),
                "joins_inferred": result.get("joins_count", 0),
            }

        except SoftTimeLimitExceeded:
            logger.error("Task timed out for report_id: %s", report_id)
            _mark_report_failed(report_id, "Task timed out after 1 hour")
            return {"status": "error", "message": "Task timed out"}

        except Exception as e:
            logger.exception(
                "Error analyzing database schema for report_id: %s", report_id
            )
            _mark_report_failed(report_id, str(e))
            raise


def _mark_report_failed(report_id: int, error_message: str) -> None:
    """Mark a report as failed with error message"""
    from superset import create_app

    try:
        flask_app = create_app()
        with flask_app.app_context():
            report = db.session.query(DatabaseSchemaReport).get(report_id)
            if report:
                report.status = AnalysisStatus.FAILED
                report.end_dttm = datetime.now()
                report.error_message = error_message
                db.session.commit()  # pylint: disable=consider-using-transaction
    except Exception:
        logger.exception("Failed to update report status to failed")


def kickstart_analysis(database_id: int, schema_name: str) -> dict[str, Any]:
    """
    Kickstart a new database schema analysis or return existing run_id.

    :param database_id: ID of the database to analyze
    :param schema_name: Name of the schema to analyze
    :return: Dict with run_id and database_report_id
    """
    # Check for existing report
    existing = (
        db.session.query(DatabaseSchemaReport)
        .filter_by(database_id=database_id, schema_name=schema_name)
        .first()
    )

    if existing and existing.status in (
        AnalysisStatus.RESERVED,
        AnalysisStatus.RUNNING,
    ):
        # Job already in progress - return existing run_id
        logger.info(
            "Analysis already in progress for database %s schema %s",
            database_id,
            schema_name,
        )
        return {
            "run_id": existing.celery_task_id,
            "database_report_id": existing.id,
            "status": existing.status.value,
        }

    if existing and existing.status in (
        AnalysisStatus.COMPLETED,
        AnalysisStatus.FAILED,
    ):
        # Delete old report (cascades to all related data)
        logger.info(
            "Deleting old report for database %s schema %s",
            database_id,
            schema_name,
        )
        db.session.delete(existing)
        db.session.flush()

    # Create new report
    task_id = str(uuid.uuid4())
    report = DatabaseSchemaReport(
        database_id=database_id,
        schema_name=schema_name,
        celery_task_id=task_id,
        status=AnalysisStatus.RESERVED,
        reserved_dttm=datetime.now(),
    )
    db.session.add(report)
    db.session.commit()  # pylint: disable=consider-using-transaction

    # Trigger Celery job
    analyze_database_schema.apply_async(args=[report.id], task_id=task_id)

    logger.info(
        "Started new analysis for database %s schema %s with run_id %s",
        database_id,
        schema_name,
        task_id,
    )

    return {
        "run_id": task_id,
        "database_report_id": report.id,
        "status": "reserved",
    }


def check_analysis_status(run_id: str) -> dict[str, Any]:
    """
    Check the status of a running analysis by run_id.

    :param run_id: The Celery task ID (run_id)
    :return: Dict with status and results
    """
    report = (
        db.session.query(DatabaseSchemaReport).filter_by(celery_task_id=run_id).first()
    )

    if not report:
        return {
            "status": "not_found",
            "message": f"No analysis found for run_id {run_id}",
        }

    result = {
        "run_id": run_id,
        "database_report_id": report.id,
        "status": report.status.value,
        "database_id": report.database_id,
        "schema_name": report.schema_name,
    }

    if report.status == AnalysisStatus.RUNNING:
        result["started_at"] = (
            report.start_dttm.isoformat() if report.start_dttm else None
        )

    elif report.status == AnalysisStatus.COMPLETED:
        result["started_at"] = (
            report.start_dttm.isoformat() if report.start_dttm else None
        )
        result["completed_at"] = (
            report.end_dttm.isoformat() if report.end_dttm else None
        )
        result["tables_count"] = len(report.tables)
        result["joins_count"] = len(report.joins)
        result["confidence_score"] = report.confidence_score
        result["confidence_validation_notes"] = report.confidence_validation_notes

    elif report.status == AnalysisStatus.FAILED:
        result["error_message"] = report.error_message
        result["failed_at"] = report.end_dttm.isoformat() if report.end_dttm else None

    return result
