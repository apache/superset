import logging
import datetime
import json

from typing import List, Tuple

from celery.result import AsyncResult
from pgsanity import pgsanity

from superset.daos.context_builder_task import ContextBuilderTaskDAO
from superset.daos.database import DatabaseDAO
from superset.daos.context_builder_task import ContextBuilderTaskDAO
from superset.models.core import ContextBuilderTask
from superset.tasks.llm_context import check_for_expired_llm_context, generate_llm_context
from superset.llms import gemini
from superset.llms.base_llm import BaseLlm

from superset.extensions import security_manager
from superset.utils.core import override_user


logger = logging.getLogger(__name__)

schema_context_workers = {}
llm_providers = {}
DIALECT = 'postgresql'
VALIDATION_ATTEMPTS = 3


def _get_last_successful_task_for_database(pk: int) -> Tuple[ContextBuilderTask, AsyncResult]:
    tasks = ContextBuilderTaskDAO.get_last_two_tasks_for_database(pk)
    for task in tasks:
        context_builder_worker = AsyncResult(task.task_id)
        if context_builder_worker.status == 'SUCCESS':
            return task, context_builder_worker
    return None, None


def _get_or_create_llm_provider(pk: int, dialect: str, context: str) -> BaseLlm:
    # db_task = ContextBuilderTaskDAO.get_latest_task_for_database(pk)
    # context_builder_worker = AsyncResult(db_task.task_id)
    (context_builder_task, context_builder_worker) = _get_last_successful_task_for_database(pk)

    if not context_builder_worker or not context_builder_task:
        # TODO(AW): Throw here
        logger.error(f"No context builder worker found for database {pk}.")
        return None

    # See if we have a provider already for this database
    llm_provider = llm_providers.get(pk, None)
    if llm_provider:
        started_time_utc = context_builder_task.started_time.replace(tzinfo=datetime.timezone.utc)
        if started_time_utc < llm_provider.created_at:
            return llm_provider

    try:
        context = json.loads(context_builder_worker.result["result"])
    except Exception as e:
        logger.error(f"Failed to parse context JSON: {str(e)}")
        # TODO(AW): Throw here
        return None

    llm_provider = gemini.GeminiLlm(pk, DIALECT, context)
    llm_providers[pk] = llm_provider
    return llm_provider


def generate_sql(pk: int, prompt: str, context: str, schemas: List[str] | None) -> str:
    provider = _get_or_create_llm_provider(pk, DIALECT, context)
    if not provider:
        return None

    prompt_with_errors = prompt

    for _ in range(VALIDATION_ATTEMPTS):
        generated = provider.generate_sql(prompt_with_errors, context, schemas)

        # Prepend 'EXPLAIN' command to the generated SQL to validate it
        validation_sql = f"EXPLAIN {generated}"
        error_text = None

        try:
            # Execute the validation SQL against the real database
            admin_user = security_manager.find_user(username="admin")
            if not admin_user:
                return {"status_code": 500, "message": "Unable to find admin user"}

            with override_user(admin_user):
                db = DatabaseDAO.find_by_id(pk)
                if not db:
                    logger.error(f"Database {pk} not found.")
                    return None
            
            with db.get_raw_connection() as conn:
                cursor = conn.cursor()
                mutated_query = db.mutate_sql_based_on_config(validation_sql)
                cursor.execute(mutated_query)
                db.db_engine_spec.execute(cursor, mutated_query, db)
                result = db.db_engine_spec.fetch_data(cursor)
                logger.info(f"Validation SQL executed successfully: {validation_sql}")
                return generated
        except Exception as error:
            logger.error(f"Validation SQL execution failed: {error}")
            error_text = str(error)

        # Otherwise, we want to append the generated SQL and error message to the prompt and try again
        prompt_with_errors = f"{prompt_with_errors}\n\n{generated}\n\n-- Error: {error_text}\n"
        logger.info(f"Generated SQL is invalid: {error_text}\nRetrying with updated prompt: {prompt_with_errors}")

    logger.error(f"Failed to generate valid SQL after {VALIDATION_ATTEMPTS} attempts.")
    return f"-- Failed to generate valid SQL after {VALIDATION_ATTEMPTS} attempts."


def get_state(pk: int) -> dict:
    """
    Get the state of the LLM context.
    """
    status = 'waiting'
    context = None

    tasks = ContextBuilderTaskDAO.get_last_two_tasks_for_database(pk)
    if not tasks:
        return {
            "status": status,
        }

    provider = _get_or_create_llm_provider(pk, DIALECT, "")
    if not provider:
        return {
            "status": status,
        }

    latest_task = tasks[0]
    context_builder_worker = AsyncResult(latest_task.task_id)

    logger.info(f"Checking task: {latest_task.task_id} - {context_builder_worker.status}")

    if context_builder_worker.status == 'PENDING':
        # PENDING status is the default state for workers that haven't been completed yet, but
        # we've introduced a PUBLISHED status for workers that have at least hit the queue. A
        # PENDING status means that the task probably doesn't exist and might be from an old
        # deployment.
        return {
            "status": status,
        }

    if context_builder_worker.status == 'PUBLISHED':
        status = 'building'
        older_task = tasks[1] if len(tasks) > 1 else None
        if older_task:
            old_context_worker = AsyncResult(older_task.task_id)
            context = {
                "build_time": older_task.started_time,
                "status": old_context_worker.status,
            }
            if old_context_worker.status == 'FAILURE':
                context["message"] = str(old_context_worker.result)
            if old_context_worker.status == 'SUCCESS':
                context["size"] = provider.get_context_size()
    else:
        context = {
            "build_time": latest_task.started_time,
            "status": context_builder_worker.status,
            "size": 0,
        }
        if context_builder_worker.status == 'FAILURE':
            context["message"] = str(context_builder_worker.result)
        if context_builder_worker.status == 'SUCCESS':
            context["size"] = provider.get_context_size()

    return {
        "context": context,
        "status": status,
    }

def generate_context_for_db(pk: int):
    """
    Generate the LLM context for a database.
    """
    # Check if we have a task for this already
    task = schema_context_workers.get(pk, None)
    if task and task.status == 'PENDING':
        return {
            "status": "Pending",
        }
    
    # Otherwise, we can start a new one
    task = generate_llm_context.delay(pk)
    schema_context_workers[pk] = task

    # Record the task in the database
    context_task = ContextBuilderTask(
        database_id=pk,
        task_id=task.id,
        params=json.dumps({}),
        started_time=datetime.datetime.now(datetime.timezone.utc),
        status="PENDING",
    )
    ContextBuilderTaskDAO.create(context_task)
    logger.info(f"Created context task {context_task.task_id}")

    return {
        "status": "Started"
    }
