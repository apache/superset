from __future__ import annotations

import datetime
import json
import logging

from celery.result import AsyncResult
from celery.utils.log import get_task_logger

from superset import db
from superset.daos.context_builder_task import ContextBuilderTaskDAO
from superset.daos.database import DatabaseDAO
from superset.databases.utils import get_database_metadata
from superset.extensions import celery_app, security_manager
from superset.models.core import ContextBuilderTask
from superset.utils.core import override_user
# from superset.llms.dispatcher import generate_context_for_db


logger = get_task_logger(__name__)
logger.setLevel(logging.INFO)


@celery_app.task(name="check_for_expired_llm_context")
def check_for_expired_llm_context():
    # Start by retrieving all databases and filtering out all the ones that do not have llm_enabled == True
    admin_user = security_manager.find_user(username="admin")
    if not admin_user:
        logger.error("Unable to find admin user")
        return

    with override_user(admin_user):
        databases = DatabaseDAO.find_all()
        databases = [database for database in databases if database.llm_enabled]

    # For the list of candidate DBs, we need to determine if we need to generate a context for them.
    # We need to genereate one if any of the following are true:
    # - There is no ContextBuilderTask for the database
    # - The latest ContextBuilderTask for the database is in a failed state
    # - The latest ContextBuilderTask for the database is in a success state, but the context is older than the configured refresh_interval
    # - The latest ContextBuilderTask for the database is in a success state, but the context is empty
    for database in databases:
        latest_task = ContextBuilderTaskDAO.get_latest_task_for_database(database.id)
        if not latest_task:
            logger.info(f"No previous tasks for database {database.id}")
            initiate_context_generation(database.id)
            continue

        task_result = AsyncResult(latest_task.task_id)
        logger.info(f"Task result ({latest_task.task_id}): {task_result.status}")

        if not task_result or task_result.status == "FAILURE":
            logger.info(f"Old context failed - generating for database {database.id}")
            initiate_context_generation(database.id)
        elif task_result.status == "SUCCESS":
            context_settings = json.loads(database.llm_context_options or "{}")
            refresh_interval = int(context_settings.get("refresh_interval", "12")) * 60 * 60
            old_started_time = latest_task.started_time.replace(tzinfo=datetime.timezone.utc)
            if (datetime.datetime.now(datetime.timezone.utc) - old_started_time).total_seconds() > refresh_interval:
                logger.info(f"Old LLM context expired - generating for database {database.id}")
                initiate_context_generation(database.id)
            elif not task_result.result:
                logger.info(f"Old LLM context missing - generating for database {database.id}")
                initiate_context_generation(database.id)
        else:
            logger.info(f"Nothing to be done for database {database.id}")


def reduce_json_token_count(data):
    """
    Reduces the token count of a JSON string.
    """
    data = data.replace(": ", ":").replace(", ", ",")

    return data

def initiate_context_generation(pk: int):
    task = generate_llm_context.delay(pk)

    # Record the task in the database
    context_task = ContextBuilderTask(
        database_id=pk,
        task_id=task.id,
        params=json.dumps({}),
        started_time=datetime.datetime.now(datetime.timezone.utc),
    )
    ContextBuilderTaskDAO.create(context_task)
    db.session.commit()
    logger.info(f"Task {task.id} created for database {pk}")

    return task

@celery_app.task(name="generate_llm_context")
def generate_llm_context(db_id: int):
    logger.info(f"Generating LLM context for database {db_id}")

    admin_user = security_manager.find_user(username="admin")
    if not admin_user:
        return {"status_code": 500, "message": "Unable to find admin user"}

    with override_user(admin_user):
        database = DatabaseDAO.find_by_id(db_id)

        if not database:
            return {"status_code": 404, "message": "Database not found"}

        context_settings = json.loads(database.llm_context_options or "{}")
        selected_schemas = context_settings.get("schemas", None)
        include_indexes = context_settings.get("include_indexes", True)
        top_k = context_settings.get("top_k", 10)
        top_k_limit = context_settings.get("top_k_limit", 10000)

        schemas = get_database_metadata(database, None, include_indexes, selected_schemas, top_k, top_k_limit)
        logger.info(f"Done generating LLM context for database {db_id}")

    schema_json = reduce_json_token_count(
        json.dumps([schema.model_dump() for schema in schemas])
    )

    return {"status_code": 200, "result": schema_json}
