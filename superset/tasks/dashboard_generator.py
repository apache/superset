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
from superset.models.dashboard_generator import (
    DashboardGeneratorRun,
    GeneratorStatus,
)

logger = logging.getLogger(__name__)


class DashboardGeneratorTask(Task):
    """Base task class for dashboard generator with retry logic"""

    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True
    retry_backoff_max = 60  # Max 60s between retries
    retry_jitter = True


@celery_app.task(
    name="generate_dashboard_from_template",
    base=DashboardGeneratorTask,
    soft_time_limit=300,  # 5 min soft limit
    time_limit=360,  # 6 min hard limit
    bind=True,
)
def generate_dashboard_from_template(self: Task, run_id: int) -> dict[str, Any]:
    """
    Celery task to generate a dashboard from a template.

    :param run_id: ID of the DashboardGeneratorRun to process
    :return: Dict with status and results
    """
    # Import here to avoid circular imports and to get the Flask app
    from superset import create_app
    from superset.commands.dashboard_generator.generate import (
        DashboardGeneratorCommand,
    )

    logger.info("Starting dashboard generation for run_id: %s", run_id)

    # Use Flask app context for database operations
    flask_app = create_app()
    with flask_app.app_context():
        try:
            # Update status to running
            run = db.session.query(DashboardGeneratorRun).get(run_id)
            if not run:
                logger.error("Run with id %s not found", run_id)
                return {"status": "error", "message": f"Run {run_id} not found"}

            run.status = GeneratorStatus.RUNNING
            run.start_dttm = datetime.now()
            db.session.commit()  # pylint: disable=consider-using-transaction

            # Execute the generation command
            command = DashboardGeneratorCommand(run_id)
            result = command.run()

            logger.info(
                "Successfully completed dashboard generation for run_id: %s", run_id
            )
            return {
                "status": "completed",
                "run_id": run_id,
                **result,
            }

        except SoftTimeLimitExceeded:
            logger.error("Task timed out for run_id: %s", run_id)
            _mark_run_failed(run_id, "Task timed out after 5 minutes")
            return {"status": "error", "message": "Task timed out"}

        except Exception as e:
            logger.exception("Error generating dashboard for run_id: %s", run_id)
            _mark_run_failed(run_id, str(e))
            raise


def _mark_run_failed(run_id: int, error_message: str) -> None:
    """Mark a run as failed with error message"""
    from superset import create_app

    try:
        flask_app = create_app()
        with flask_app.app_context():
            run = db.session.query(DashboardGeneratorRun).get(run_id)
            if run:
                run.status = GeneratorStatus.FAILED
                run.end_dttm = datetime.now()
                run.error_message = error_message
                db.session.commit()  # pylint: disable=consider-using-transaction
    except Exception:
        logger.exception("Failed to update run status to failed")


def kickstart_generation(
    database_report_id: int,
    template_dashboard_id: int,
) -> dict[str, Any]:
    """
    Kickstart a new dashboard generation.

    :param database_report_id: ID of the database schema report
    :param template_dashboard_id: ID of the template dashboard
    :return: Dict with run_id
    """
    # Check for existing running generation for same template
    existing = (
        db.session.query(DashboardGeneratorRun)
        .filter_by(
            template_dashboard_id=template_dashboard_id,
            database_report_id=database_report_id,
        )
        .filter(
            DashboardGeneratorRun.status.in_(
                [GeneratorStatus.RESERVED, GeneratorStatus.RUNNING]
            )
        )
        .first()
    )

    if existing:
        logger.info(
            "Generation already in progress for template %s with report %s",
            template_dashboard_id,
            database_report_id,
        )
        return {
            "run_id": existing.celery_task_id,
            "status": existing.status.value,
            "message": "Generation already in progress",
        }

    # Create new run
    task_id = str(uuid.uuid4())
    run = DashboardGeneratorRun(
        database_report_id=database_report_id,
        template_dashboard_id=template_dashboard_id,
        celery_task_id=task_id,
        status=GeneratorStatus.RESERVED,
        reserved_dttm=datetime.now(),
    )
    db.session.add(run)
    db.session.commit()

    # Trigger Celery job
    generate_dashboard_from_template.apply_async(args=[run.id], task_id=task_id)

    logger.info(
        "Started dashboard generation for template %s with run_id %s",
        template_dashboard_id,
        task_id,
    )

    return {
        "run_id": task_id,
        "status": "reserved",
    }


def check_generation_status(run_id: str) -> dict[str, Any]:
    """
    Check the status of a dashboard generation run.

    :param run_id: The Celery task ID (run_id)
    :return: Dict with status and progress
    """
    from superset.utils import json

    run = (
        db.session.query(DashboardGeneratorRun)
        .filter_by(celery_task_id=run_id)
        .first()
    )

    if not run:
        return {
            "status": "not_found",
            "message": f"No generation run found for run_id {run_id}",
        }

    result: dict[str, Any] = {
        "run_id": run_id,
        "status": run.status.value,
        "current_phase": run.current_phase.value if run.current_phase else None,
    }

    # Parse progress
    progress = json.loads(run.progress_json or "{}")
    result["progress"] = {
        "charts_total": progress.get("charts_total", 0),
        "charts_completed": progress.get("charts_done", 0),
        "filters_total": progress.get("filters_total", 0),
        "filters_completed": progress.get("filters_done", 0),
    }

    if run.status == GeneratorStatus.RUNNING:
        result["started_at"] = run.start_dttm.isoformat() if run.start_dttm else None

    elif run.status == GeneratorStatus.COMPLETED:
        result["started_at"] = run.start_dttm.isoformat() if run.start_dttm else None
        result["completed_at"] = run.end_dttm.isoformat() if run.end_dttm else None
        result["dashboard_id"] = run.generated_dashboard_id
        result["dataset_id"] = run.generated_dataset_id

        # Include failed items if any
        if run.failed_items_json:
            result["failed_items"] = json.loads(run.failed_items_json)

    elif run.status == GeneratorStatus.FAILED:
        result["error_message"] = run.error_message
        result["failed_at"] = run.end_dttm.isoformat() if run.end_dttm else None

        if run.failed_items_json:
            result["failed_items"] = json.loads(run.failed_items_json)

    elif run.status == GeneratorStatus.PENDING_REVIEW:
        result["started_at"] = run.start_dttm.isoformat() if run.start_dttm else None
        result["completed_at"] = run.end_dttm.isoformat() if run.end_dttm else None
        result["dashboard_id"] = run.generated_dashboard_id
        result["dataset_id"] = run.generated_dataset_id
        result["requires_human_review"] = True
        result["review_reasons"] = run.error_message.split("; ") if run.error_message else []

        # Include failed mappings for review UI
        progress = json.loads(run.progress_json or "{}")
        result["failed_mappings"] = progress.get("failed_mappings", [])
        result["quality"] = progress.get("quality", 0)

    return result
