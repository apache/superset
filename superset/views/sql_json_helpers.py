import logging
from typing import cast

import simplejson as json
from flask import g
from flask_babel import lazy_gettext as _
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset import app, db, is_feature_enabled, security_manager, sql_lab
from superset.jinja_context import get_template_processor
from superset.models import core as models
from superset.models.sql_lab import Query
from superset.utils import core as utils
from superset.utils.dates import now_as_float
from superset.views.base import json_error_response, json_success
from superset.views.utils import apply_display_max_row_limit, QueryStatus


def _sql_json_async(
    session: Session, rendered_query: str, query: Query, expand_data: bool
) -> str:
    """
        Send SQL JSON query to celery workers

    :param session: SQLAlchemy session object
    :param rendered_query: the rendered query to perform by workers
    :param query: The query (SQLAlchemy) object
    :return: String JSON response
    """
    logging.info(f"Query {query.id}: Running query on a Celery worker")
    # Ignore the celery future object and the request may time out.
    try:
        sql_lab.get_sql_results.delay(
            query.id,
            rendered_query,
            return_results=False,
            store_results=not query.select_as_cta,
            user_name=g.user.username if g.user else None,
            start_time=now_as_float(),
            expand_data=expand_data,
        )
    except Exception as e:  # pylint: disable=broad-except
        logging.exception(f"Query {query.id}: {e}")
        msg = _(
            "Failed to start remote query on a worker. "
            "Tell your administrator to verify the availability of "
            "the message queue."
        )
        query.status = QueryStatus.FAILED
        query.error_message = msg
        session.commit()
        return json_error_response("{}".format(msg))
    resp = json_success(
        json.dumps(
            {"query": query.to_dict()}, default=utils.json_int_dttm_ser, ignore_nan=True
        ),
        status=202,
    )
    session.commit()
    return resp


def _sql_json_sync(rendered_query: str, query: Query, expand_data: bool) -> str:
    """
        Execute SQL query (sql json)

    :param rendered_query: The rendered query (included templates)
    :param query: The query SQL (SQLAlchemy) object
    :return: String JSON response
    """
    try:
        timeout = app.config["SQLLAB_TIMEOUT"]
        timeout_msg = f"The query exceeded the {timeout} seconds timeout."
        store_results = (
            is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE") and not query.select_as_cta
        )
        with utils.timeout(seconds=timeout, error_message=timeout_msg):
            # pylint: disable=no-value-for-parameter
            data = sql_lab.get_sql_results(
                query.id,
                rendered_query,
                return_results=True,
                store_results=store_results,
                user_name=g.user.username if g.user else None,
                expand_data=expand_data,
            )

        payload = json.dumps(
            apply_display_max_row_limit(data),
            default=utils.pessimistic_json_iso_dttm_ser,
            ignore_nan=True,
            encoding=None,
        )
    except Exception as e:  # pylint: disable=broad-except
        logging.exception(f"Query {query.id}: {e}")
        return json_error_response(f"{{e}}")
    if data.get("status") == QueryStatus.FAILED:
        return json_error_response(payload=data)
    return json_success(payload)


def sql_json_exec(
    query_params: dict
):  # pylint: disable=too-many-locals,too-many-statements
    """Runs arbitrary sql and returns data as json"""
    # Collect Values
    database_id: int = cast(int, query_params.get("database_id"))
    schema: str = cast(str, query_params.get("schema"))
    sql: str = cast(str, query_params.get("sql"))
    try:
        template_params: dict = json.loads(query_params.get("templateParams") or "{}")
    except json.JSONDecodeError:
        logging.warning(
            f"Invalid template parameter {query_params.get('templateParams')}"
            " specified. Defaulting to empty dict"
        )
        template_params = {}
    limit: int = query_params.get("queryLimit") or app.config["SQL_MAX_ROW"]
    async_flag: bool = cast(bool, query_params.get("runAsync"))
    if limit < 0:
        logging.warning(f"Invalid limit of {limit} specified. Defaulting to max limit.")
        limit = 0
    select_as_cta: bool = cast(bool, query_params.get("select_as_cta"))
    tmp_table_name: str = cast(str, query_params.get("tmp_table_name"))
    client_id: str = cast(str, query_params.get("client_id") or utils.shortid()[:10])
    sql_editor_id: str = cast(str, query_params.get("sql_editor_id"))
    tab_name: str = cast(str, query_params.get("tab"))
    status: str = QueryStatus.PENDING if async_flag else QueryStatus.RUNNING

    session = db.session()
    mydb = session.query(models.Database).filter_by(id=database_id).one_or_none()
    if not mydb:
        return json_error_response(f"Database with id {database_id} is missing.")

    # Set tmp_table_name for CTA
    if select_as_cta and mydb.force_ctas_schema:
        tmp_table_name = f"{mydb.force_ctas_schema}.{tmp_table_name}"

    # Save current query
    query = Query(
        database_id=database_id,
        sql=sql,
        schema=schema,
        select_as_cta=select_as_cta,
        start_time=now_as_float(),
        tab_name=tab_name,
        status=status,
        sql_editor_id=sql_editor_id,
        tmp_table_name=tmp_table_name,
        user_id=g.user.get_id() if g.user else None,
        client_id=client_id,
    )
    try:
        session.add(query)
        session.flush()
        query_id = query.id
        session.commit()  # shouldn't be necessary
    except SQLAlchemyError as e:
        logging.error(f"Errors saving query details {e}")
        session.rollback()
        raise Exception(_("Query record was not created as expected."))
    if not query_id:
        raise Exception(_("Query record was not created as expected."))

    logging.info(f"Triggering query_id: {query_id}")

    rejected_tables = security_manager.rejected_tables(sql, mydb, schema)
    if rejected_tables:
        query.status = QueryStatus.FAILED
        session.commit()
        return json_error_response(
            security_manager.get_table_access_error_msg(rejected_tables),
            link=security_manager.get_table_access_link(rejected_tables),
            status=403,
        )

    try:
        template_processor = get_template_processor(
            database=query.database, query=query
        )
        rendered_query = template_processor.process_template(
            query.sql, **template_params
        )
    except Exception as e:  # pylint: disable=broad-except
        error_msg = utils.error_msg_from_exception(e)
        return json_error_response(
            f"Query {query_id}: Template rendering failed: {error_msg}"
        )

    # set LIMIT after template processing
    limits = [mydb.db_engine_spec.get_limit_from_sql(rendered_query), limit]
    query.limit = min(lim for lim in limits if lim is not None)

    # Flag for whether or not to expand data
    # (feature that will expand Presto row objects and arrays)
    expand_data: bool = cast(
        bool,
        is_feature_enabled("PRESTO_EXPAND_DATA") and query_params.get("expand_data"),
    )

    # Async request.
    if async_flag:
        return _sql_json_async(session, rendered_query, query, expand_data)
    # Sync request.
    return _sql_json_sync(rendered_query, query, expand_data)
