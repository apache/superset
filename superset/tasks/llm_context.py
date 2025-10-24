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

import datetime
import json
import logging
import time
from typing import Any

from celery.result import AsyncResult
from celery.signals import after_task_publish
from celery.utils.log import get_task_logger

from superset import db
from superset.daos.context_builder_task import ContextBuilderTaskDAO
from superset.daos.database import DatabaseDAO
from superset.databases.utils import get_database_metadata
from superset.extensions import celery_app, security_manager
from superset.models.core import ContextBuilderTask
from superset.utils.core import override_user

logger = get_task_logger(__name__)
logger.setLevel(logging.INFO)


@after_task_publish.connect
def update_sent_state(sender: str | None = None, headers: dict[str, str] | None = None, **kwargs: Any) -> None:
    task = celery_app.tasks.get(sender)
    backend = task.backend if task else celery_app.backend

    if headers and headers["task"] == "generate_llm_context":
        backend.store_result(headers["id"], None, "PUBLISHED")


@celery_app.task(name="check_for_expired_llm_context")
def check_for_expired_llm_context() -> None:
    admin_user = security_manager.find_user(username="admin")
    if not admin_user:
        logger.error("Unable to find admin user")
        return

    with override_user(admin_user):
        databases = DatabaseDAO.find_all()
        databases = [
            database
            for database in databases
            if database.llm_connection and database.llm_connection.enabled
        ]

    # For the list of candidate DBs, we need to determine if we need to generate a context for them.
    # We need to genereate one if any of the following are true:
    # - There is no ContextBuilderTask for the database
    # - The latest ContextBuilderTask for the database is in a failed state
    # - The latest ContextBuilderTask for the database is in a success state, but the context is older than the configured refresh_interval
    # - The latest ContextBuilderTask for the database is in a success state, but the context is empty
    for database in databases:
        latest_task = ContextBuilderTaskDAO.get_latest_task_for_database(database.id)
        if not latest_task:
            logger.info("No previous tasks for database %s", database.id)
            initiate_context_generation(database.id)
            continue

        task_result = AsyncResult(latest_task.task_id)

        if task_result.status == "PENDING" or task_result.status == "FAILURE":
            logger.info("Old context failed - generating for database %s", database.id)
            initiate_context_generation(database.id)
        elif task_result.status == "SUCCESS":
            refresh_interval = (
                int(database.llm_context_options.refresh_interval or 12) * 60 * 60
            )
            old_started_time = latest_task.started_time.replace(
                tzinfo=datetime.timezone.utc
            )
            if (
                datetime.datetime.now(datetime.timezone.utc) - old_started_time
            ).total_seconds() > refresh_interval:
                logger.info(
                    f"Old LLM context expired - generating for database {database.id}"
                )
                initiate_context_generation(database.id)
            elif not task_result.result:
                logger.info(
                    f"Old LLM context missing - generating for database {database.id}"
                )
                initiate_context_generation(database.id)
        else:
            logger.info("Nothing to be done for database %s", database.id)


def reduce_json_token_count(data: str) -> str:
    """
    Reduces the token count of a JSON string.
    """
    data = data.replace(": ", ":").replace(", ", ",")

    return data


def initiate_context_generation(pk: int) -> Any:
    task = generate_llm_context.delay(pk)

    context_task = ContextBuilderTask(
        database_id=pk,
        task_id=task.id,
        params=json.dumps({}),
        started_time=datetime.datetime.now(datetime.timezone.utc),
        status="PENDING",
    )
    ContextBuilderTaskDAO.create(context_task)
    db.session.commit()
    logger.info("Task %s created for database %s", task.id, pk)

    return task


@celery_app.task(bind=True, name="generate_llm_context")
def generate_llm_context(self: Any, db_id: int) -> dict[str, Any] | None:
    logger.info("Generating LLM context for database %s", db_id)
    start_time = time.perf_counter()
    task_status = "SUCCESS"

    try:
        admin_user = security_manager.find_user(username="admin")
        if not admin_user:
            return {"status_code": 500, "message": "Unable to find admin user"}

        with override_user(admin_user):
            database = DatabaseDAO.find_by_id(db_id)

            if not database:
                return {"status_code": 404, "message": "Database not found"}

            settings = database.llm_context_options
            selected_schemas = (
                json.loads(settings.schemas) if settings.schemas else None
            )
            include_indexes = (
                settings.include_indexes if settings.include_indexes else True
            )
            top_k = settings.top_k if settings.top_k else 10
            top_k_limit = settings.top_k_limit if settings.top_k_limit else 50000

            schemas = get_database_metadata(
                database, None, include_indexes, selected_schemas, top_k, top_k_limit
            )
            logger.info("Done generating LLM context for database %s", db_id)

        schema_json = reduce_json_token_count(
            json.dumps([schema.model_dump() for schema in schemas])
        )
    except Exception:
        task_status = "ERROR"
        raise
    finally:
        db_task = ContextBuilderTaskDAO.find_by_task_id(self.request.id)
        if db_task:
            db_task.ended_time = datetime.datetime.now(datetime.timezone.utc)
            db_task.status = task_status
            end_time = time.perf_counter()
            db_task.duration = int(end_time * 1000 - start_time * 1000)
            db.session.commit()
        else:
            logger.error("Task %s not found in database", self.request.id)

    return {"status_code": 200, "result": schema_json}
