import logging
import datetime
import json

from typing import List, Tuple

from celery.result import AsyncResult

from superset.daos.context_builder_task import ContextBuilderTaskDAO
from superset.daos.database import DatabaseDAO
from superset.daos.context_builder_task import ContextBuilderTaskDAO
from superset.exceptions import DatabaseNotFoundException
from superset.models.core import ContextBuilderTask
from superset.tasks.llm_context import initiate_context_generation, generate_llm_context
from superset.llms import anthropic, gemini, openai
from superset.llms.base_llm import BaseLlm
from superset.llms.exceptions import NoContextError, NoProviderError

from superset.extensions import security_manager
from superset.utils.core import override_user


logger = logging.getLogger(__name__)

llm_providers = {}
VALIDATION_ATTEMPTS = 3
AVAILABLE_PROVIDERS = [
    cls
    for cls in BaseLlm.__subclasses__()
    if hasattr(cls, "llm_type")
]

def _get_last_successful_task_for_database(pk: int) -> Tuple[ContextBuilderTask, AsyncResult]:
    task = ContextBuilderTaskDAO.get_last_successful_task_for_database(pk)

    if not task:
        raise NoContextError(f"No context builder task found for database {pk}.")

    context_builder_worker = AsyncResult(task.task_id)
    if context_builder_worker.status == 'SUCCESS':
        return task, context_builder_worker

    return task, None


def _get_or_create_llm_provider(pk: int, dialect: str, provider_type: str) -> BaseLlm:
    (context_builder_task, context_builder_worker) = _get_last_successful_task_for_database(pk)

    # At this point we will always have a context_builder_task but may not have a context_builder_worker
    # if the task result has expired from the Celery backend. If we still have an llm_provider we can
    # continue to use the context stored in memory in the provider.

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
        raise NoContextError(f"Failed to parse context JSON for database {pk}.")

    for provider in AVAILABLE_PROVIDERS:
        if provider.llm_type == provider_type:
            llm_provider = provider(pk, dialect, context)
            break
    else:
        raise NoProviderError(f"No LLM provider found for type {provider_type}.")

    llm_providers[pk] = llm_provider
    return llm_provider


def generate_sql(pk: int, prompt: str, context: str, schemas: List[str] | None) -> str:
    admin_user = security_manager.find_user(username="admin")
    if not admin_user:
        return {"status_code": 500, "message": "Unable to find admin user"}
    with override_user(admin_user):
        db = DatabaseDAO.find_by_id(pk)
        if not db:
            raise DatabaseNotFoundException(f"No such database: {pk}")

    provider = _get_or_create_llm_provider(pk, db.backend, db.llm_connection.provider)
    if not provider:
        return None

    prompt_with_errors = prompt

    for _ in range(VALIDATION_ATTEMPTS):
        generated = provider.generate_sql(prompt_with_errors, context, schemas)

        # Prepend 'EXPLAIN' command to the generated SQL to validate it
        validation_sql = f"EXPLAIN {generated}"
        error_text = None

        try:
            with db.get_raw_connection() as conn:
                cursor = conn.cursor()
                mutated_query = db.mutate_sql_based_on_config(validation_sql)
                cursor.execute(mutated_query)
                db.db_engine_spec.execute(cursor, mutated_query, db)
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
    # In total we're interested in knowing three things:
    # - The last successful context build
    # - The last build finished with an error
    # - Whether there is a build in progress right now

    result = {
        "status": "waiting",
    }

    admin_user = security_manager.find_user(username="admin")
    if not admin_user:
        return {"status_code": 500, "message": "Unable to find admin user"}
    with override_user(admin_user):
        db = DatabaseDAO.find_by_id(pk)
        if not db:
            raise DatabaseNotFoundException(f"No such database: {pk}")

    successful_task = ContextBuilderTaskDAO.get_last_successful_task_for_database(pk)
    if successful_task:
        provider = _get_or_create_llm_provider(pk, db.backend, db.llm_connection.provider)
        result["context"] = {
            "build_time": successful_task.started_time,
            "status": successful_task.status,
            "size": provider.get_context_size(),
        }

    last_two_tasks = ContextBuilderTaskDAO.get_last_two_tasks_for_database(pk)
    error_task = next(
        (task for task in last_two_tasks if task.status == "ERROR"), None
    )
    if error_task and len(last_two_tasks) > 0 and last_two_tasks[0].status != "SUCCESS":
        result["error"] = {
            "build_time": error_task.started_time,
        }

    latest_task = last_two_tasks[0] if len(last_two_tasks) > 0 else None
    if latest_task and latest_task.status == "PENDING":
        result["status"] = "building"

    return result

def generate_context_for_db(pk: int):
    """
    Generate the LLM context for a database.
    """
    # Check if we have a task for this already
    task = ContextBuilderTaskDAO.get_latest_task_for_database(pk)
    if task and task.status == 'PENDING':
        return {
            "status": "Pending",
            "task_id": task.task_id,
        }

    task = initiate_context_generation(pk)

    return {
        "status": "Started",
        "task_id": task.task_id,
    }

def get_default_options(pk: int) -> dict:
    """
    Get the default options for the LLM context.
    """
    admin_user = security_manager.find_user(username="admin")
    if not admin_user:
        return {"status_code": 500, "message": "Unable to find admin user"}
    with override_user(admin_user):
        db = DatabaseDAO.find_by_id(pk)
        if not db:
            raise DatabaseNotFoundException(f"No such database: {pk}")

    return {
        provider.llm_type: {
            "models": provider.get_models(),
            "instructions": provider.get_system_instructions(db.backend),
        }
        for provider in AVAILABLE_PROVIDERS
    }
