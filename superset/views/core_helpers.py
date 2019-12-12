import logging
from datetime import timedelta
from typing import cast, Optional, Union

import msgpack
import pyarrow as pa
import simplejson as json
from flask import g, request
from flask_babel import gettext as __

from superset import (
    dataframe,
    db,
    results_backend,
    results_backend_use_msgpack,
    security_manager,
)
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.models.sql_lab import Query
from superset.utils import core as utils
from superset.utils.dates import now_as_float
from superset.utils.decorators import stats_timing
from superset.views.base import json_error_response, json_success
from superset.views.core import stats_logger
from superset.views.utils import (
    apply_display_max_row_limit,
    get_datasource_info,
    get_form_data,
    get_viz,
)


def get_database_access_error_msg(database_name):
    return __(
        "This view requires the database %(name)s or "
        "`all_datasource_access` permission",
        name=database_name,
    )


def is_owner(obj, user):
    """ Check if user is owner of the slice """
    return obj and user in obj.owners


def check_datasource_perms(
    self,  # pylint: disable=unused-argument
    datasource_type: str = None,
    datasource_id: int = None,
) -> None:
    """
    Check if user can access a cached response from explore_json.

    This function takes `self` since it must have the same signature as the
    the decorated method.

    :param datasource_type: The datasource type, i.e., 'druid' or 'table'
    :param datasource_id: The datasource ID
    :raises SupersetSecurityException: If the user cannot access the resource
    """

    form_data = get_form_data()[0]

    try:
        datasource_id, datasource_type = get_datasource_info(
            datasource_id, datasource_type, form_data
        )
    except SupersetException as e:
        raise SupersetSecurityException(str(e))

    viz_obj = get_viz(
        datasource_type=datasource_type,
        datasource_id=datasource_id,
        form_data=form_data,
        force=False,
    )

    security_manager.assert_viz_permission(viz_obj)


def check_slice_perms(self, slice_id):  # pylint: disable=unused-argument
    """
    Check if user can access a cached response from slice_json.

    This function takes `self` since it must have the same signature as the
    the decorated method.
    """

    form_data, slc = get_form_data(slice_id, use_slice_data=True)

    viz_obj = get_viz(
        datasource_type=slc.datasource.type,
        datasource_id=slc.datasource.id,
        form_data=form_data,
        force=False,
    )

    security_manager.assert_viz_permission(viz_obj)


def results_exec(key: str):
    """Serves a key off of the results backend

    It is possible to pass the `rows` query argument to limit the number
    of rows returned.
    """
    if not results_backend:
        return json_error_response("Results backend isn't configured")

    read_from_results_backend_start = now_as_float()
    blob = results_backend.get(key)
    stats_logger.timing(
        "sqllab.query.results_backend_read",
        now_as_float() - read_from_results_backend_start,
    )
    if not blob:
        return json_error_response(
            "Data could not be retrieved. " "You may want to re-run the query.",
            status=410,
        )

    query = db.session.query(Query).filter_by(results_key=key).one_or_none()
    if query is None:
        return json_error_response(
            "Data could not be retrieved. You may want to re-run the query.", status=404
        )

    rejected_tables = security_manager.rejected_tables(
        query.sql, query.database, query.schema
    )
    if rejected_tables:
        return json_error_response(
            security_manager.get_table_access_error_msg(rejected_tables), status=403
        )

    payload = utils.zlib_decompress(blob, decode=not results_backend_use_msgpack)
    obj: dict = deserialize_results_payload(
        payload, query, cast(bool, results_backend_use_msgpack)
    )

    if "rows" in request.args:
        try:
            rows = int(request.args["rows"])
        except ValueError:
            return json_error_response("Invalid `rows` argument", status=400)
        obj = apply_display_max_row_limit(obj, rows)

    return json_success(
        json.dumps(obj, default=utils.json_iso_dttm_ser, ignore_nan=True)
    )


def deserialize_results_payload(
    payload: Union[bytes, str], query, use_msgpack: Optional[bool] = False
) -> dict:
    logging.debug(f"Deserializing from msgpack: {use_msgpack}")
    if use_msgpack:
        with stats_timing(
            "sqllab.query.results_backend_msgpack_deserialize", stats_logger
        ):
            ds_payload = msgpack.loads(payload, raw=False)

        with stats_timing("sqllab.query.results_backend_pa_deserialize", stats_logger):
            df = pa.deserialize(ds_payload["data"])

        # TODO: optimize this, perhaps via df.to_dict, then traversing
        ds_payload["data"] = dataframe.SupersetDataFrame.format_data(df) or []

        db_engine_spec = query.database.db_engine_spec
        all_columns, data, expanded_columns = db_engine_spec.expand_data(
            ds_payload["selected_columns"], ds_payload["data"]
        )
        ds_payload.update(
            {"data": data, "columns": all_columns, "expanded_columns": expanded_columns}
        )

        return ds_payload
    else:
        with stats_timing(
            "sqllab.query.results_backend_json_deserialize", stats_logger
        ):
            return json.loads(payload)  # type: ignore


def queries_exec(last_updated_ms_int: int):
    stats_logger.incr("queries")
    if not g.user.get_id():
        return json_error_response("Please login to access the queries.", status=403)

    # UTC date time, same that is stored in the DB.
    last_updated_dt = utils.EPOCH + timedelta(seconds=last_updated_ms_int / 1000)

    sql_queries = (
        db.session.query(Query)
        .filter(Query.user_id == g.user.get_id(), Query.changed_on >= last_updated_dt)
        .all()
    )
    dict_queries = {q.client_id: q.to_dict() for q in sql_queries}
    return json_success(json.dumps(dict_queries, default=utils.json_int_dttm_ser))
