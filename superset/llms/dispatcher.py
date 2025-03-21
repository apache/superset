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

def _get_schema_json_from_worker(pk: int) -> Tuple[str, str]:
    # db_task = ContextBuilderTaskDAO.get_latest_task_for_database(pk)
    # context_builder_worker = AsyncResult(db_task.task_id)
    # context_builder_worker = schema_context_workers.get(pk)
    (context_builder_task, context_builder_worker) = _get_last_successful_task_for_database(pk)
    
    if not context_builder_worker:
        logger.error(f"No context builder worker found for database {pk}.")
        return ("NOT_FOUND", None)

    if context_builder_worker.status == 'FAILURE':
        logger.error(f"Context builder worker encountered an error for database {pk}.")
        return ("ERROR", None)

    if context_builder_worker.status == 'PENDING':
        logger.error(f"Context builder worker is still pending for database {pk}.")
        return ("PENDING", None)

    if context_builder_worker.status != 'SUCCESS':
        logger.error(f"Context builder worker is in an unknown state for database {pk}.")
        return ("ERROR", None)

    return ("SUCCESS", context_builder_worker.result["result"])


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
    # Possible states:
    # - Unconfigured; no API key or model has been selected
    # - Invalid API key; The LLM has been configured but it doesn't work
    # - Generating; The context is being generated
    # - Context error; The context could not be generated
    # - Ready; Everything is ready to go
    
    # TODO(AW): Should we test the API key?
    # client = genai.Client(api_key=GEMINI_API_KEY)
    # try:
    #     response = client.models.generate_content(
    #         model=GEMINI_MODEL,
    #         contents="Checking if this API key works",
    #     )
    # except Exception as e:
    #     logger.error(f"Failed to test API key: {str(e)}")
    #     return {
    #         "state": "Invalid API key",
    #         "message": str(e),
    #     }
    (status, result) = _get_schema_json_from_worker(pk)
    if status == 'ERROR' or status == 'NOT_FOUND':
        return {
            "state": "Context error",
        }
    if status == 'PENDING':
        return {
            "state": "Generating",
        }
    return {
        "state": "Ready",
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
    )
    ContextBuilderTaskDAO.create(context_task)
    logger.info(f"Created context task {context_task}")

    return {
        "status": "Started"
    }

def generate_all_db_contexts():
    task = check_for_expired_llm_context.delay()
    logger.info(f"Created context task {task}")
