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
import contextlib
import logging
from collections import defaultdict
from functools import wraps
from typing import Any, Callable, DefaultDict, Optional, Union

import msgpack
import pyarrow as pa
from flask import flash, g, has_request_context, redirect, request
from flask_appbuilder.security.sqla import models as ab_models
from flask_appbuilder.security.sqla.models import User
from flask_babel import _
from sqlalchemy.exc import NoResultFound
from werkzeug.wrappers.response import Response

from superset import app, dataframe, db, result_set, viz
from superset.common.db_query_status import QueryStatus
from superset.daos.datasource import DatasourceDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    CacheLoadError,
    SerializationError,
    SupersetException,
    SupersetSecurityException,
)
from superset.extensions import cache_manager, feature_flag_manager, security_manager
from superset.legacy import update_time_range
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import Query
from superset.superset_typing import FormData
from superset.utils import json
from superset.utils.core import DatasourceType
from superset.utils.decorators import stats_timing
from superset.viz import BaseViz

logger = logging.getLogger(__name__)
stats_logger = app.config["STATS_LOGGER"]

REJECTED_FORM_DATA_KEYS: list[str] = []
if not feature_flag_manager.is_feature_enabled("ENABLE_JAVASCRIPT_CONTROLS"):
    REJECTED_FORM_DATA_KEYS = ["js_tooltip", "js_onclick_href", "js_data_mutator"]


def sanitize_datasource_data(datasource_data: dict[str, Any]) -> dict[str, Any]:
    if datasource_data:
        datasource_database = datasource_data.get("database")
        if datasource_database:
            datasource_database["parameters"] = {}

    return datasource_data


def bootstrap_user_data(user: User, include_perms: bool = False) -> dict[str, Any]:
    if user.is_anonymous:
        payload = {}
        user.roles = (security_manager.find_role("Public"),)
    elif security_manager.is_guest_user(user):
        payload = {
            "username": user.username,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "isActive": user.is_active,
            "isAnonymous": user.is_anonymous,
        }
    else:
        payload = {
            "username": user.username,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "userId": user.id,
            "isActive": user.is_active,
            "isAnonymous": user.is_anonymous,
            "createdOn": user.created_on.isoformat(),
            "email": user.email,
        }

    if include_perms:
        roles, permissions = get_permissions(user)
        payload["roles"] = roles
        payload["permissions"] = permissions

    return payload


def get_permissions(
    user: User,
) -> tuple[dict[str, list[tuple[str]]], DefaultDict[str, list[str]]]:
    if not user.roles and not user.groups:
        raise AttributeError("User object does not have roles or groups")

    data_permissions = defaultdict(set)
    roles_permissions = security_manager.get_user_roles_permissions(user)
    for _, permissions in roles_permissions.items():  # noqa: F402
        for permission in permissions:
            if permission[0] in ("datasource_access", "database_access"):
                data_permissions[permission[0]].add(permission[1])
    transformed_permissions = defaultdict(list)
    for perm in data_permissions:
        transformed_permissions[perm] = list(data_permissions[perm])
    return roles_permissions, transformed_permissions


def get_viz(
    form_data: FormData,
    datasource_type: str,
    datasource_id: int,
    force: bool = False,
    force_cached: bool = False,
) -> BaseViz:
    viz_type = form_data.get("viz_type", "table")
    datasource = DatasourceDAO.get_datasource(
        DatasourceType(datasource_type),
        datasource_id,
    )
    viz_obj = viz.viz_types[viz_type](
        datasource, form_data=form_data, force=force, force_cached=force_cached
    )
    return viz_obj


def loads_request_json(request_json_data: str) -> dict[Any, Any]:
    try:
        return json.loads(request_json_data)
    except (TypeError, json.JSONDecodeError):
        return {}


def get_form_data(
    slice_id: Optional[int] = None,
    use_slice_data: bool = False,
    initial_form_data: Optional[dict[str, Any]] = None,
) -> tuple[dict[str, Any], Optional[Slice]]:
    form_data: dict[str, Any] = initial_form_data or {}

    if has_request_context():
        json_data = request.get_json(cache=True) if request.is_json else {}

        # chart data API requests are JSON
        first_query = (
            json_data["queries"][0]
            if "queries" in json_data and json_data["queries"]
            else None
        )

        add_sqllab_custom_filters(form_data)

        request_form_data = request.form.get("form_data")
        request_args_data = request.args.get("form_data")
        if first_query:
            form_data.update(first_query)
        if request_form_data:
            parsed_form_data = loads_request_json(request_form_data)
            # some chart data api requests are form_data
            queries = parsed_form_data.get("queries")
            if isinstance(queries, list):
                form_data.update(queries[0])
            else:
                form_data.update(parsed_form_data)
        # request params can overwrite the body
        if request_args_data:
            form_data.update(loads_request_json(request_args_data))

    # Fallback to using the Flask globals (used for cache warmup and async queries)
    if not form_data and hasattr(g, "form_data"):
        form_data = g.form_data
        # chart data API requests are JSON
        json_data = form_data["queries"][0] if "queries" in form_data else {}
        form_data.update(json_data)

    form_data = {k: v for k, v in form_data.items() if k not in REJECTED_FORM_DATA_KEYS}

    # When a slice_id is present, load from DB and override
    # the form_data from the DB with the other form_data provided
    slice_id = form_data.get("slice_id") or slice_id
    slc = None

    # Check if form data only contains slice_id, additional filters and viz type
    valid_keys = ["slice_id", "extra_filters", "adhoc_filters", "viz_type"]
    valid_slice_id = all(key in valid_keys for key in form_data)

    # Include the slice_form_data if request from explore or slice calls
    # or if form_data only contains slice_id and additional filters
    if slice_id and (use_slice_data or valid_slice_id):
        slc = db.session.query(Slice).filter_by(id=slice_id).one_or_none()
        if slc:
            slice_form_data = slc.form_data.copy()
            slice_form_data.update(form_data)
            form_data = slice_form_data

    update_time_range(form_data)
    return form_data, slc


def add_sqllab_custom_filters(form_data: dict[Any, Any]) -> Any:
    """
    SQLLab can include a "filters" attribute in the templateParams.
    The filters attribute is a list of filters to include in the
    request. Useful for testing templates in SQLLab.
    """
    try:
        data = json.loads(request.data)
        if isinstance(data, dict):
            params_str = data.get("templateParams")
            if isinstance(params_str, str):
                params = json.loads(params_str)
                if isinstance(params, dict):
                    filters = params.get("_filters")
                    if filters:
                        form_data.update({"filters": filters})
    except (TypeError, json.JSONDecodeError):
        data = {}


def get_datasource_info(
    datasource_id: Optional[int], datasource_type: Optional[str], form_data: FormData
) -> tuple[int, Optional[str]]:
    """
    Compatibility layer for handling of datasource info

    datasource_id & datasource_type used to be passed in the URL
    directory, now they should come as part of the form_data,

    This function allows supporting both without duplicating code

    :param datasource_id: The datasource ID
    :param datasource_type: The datasource type
    :param form_data: The URL form data
    :returns: The datasource ID and type
    :raises SupersetException: If the datasource no longer exists
    """

    if "__" in (datasource := form_data.get("datasource", "")):
        datasource_id, datasource_type = datasource.split("__")
        # The case where the datasource has been deleted
        if datasource_id == "None":
            datasource_id = None

    if not datasource_id:
        raise SupersetException(
            _("The dataset associated with this chart no longer exists")
        )

    datasource_id = int(datasource_id)
    return datasource_id, datasource_type


def apply_display_max_row_limit(
    sql_results: dict[str, Any], rows: Optional[int] = None
) -> dict[str, Any]:
    """
    Given a `sql_results` nested structure, applies a limit to the number of rows

    `sql_results` here is the nested structure coming out of sql_lab.get_sql_results, it
    contains metadata about the query, as well as the data set returned by the query.
    This method limits the number of rows adds a `displayLimitReached: True` flag to the
    metadata.

    :param sql_results: The results of a sql query from sql_lab.get_sql_results
    :param rows: The number of rows to apply a limit to
    :returns: The mutated sql_results structure
    """

    display_limit = rows or app.config["DISPLAY_MAX_ROW"]

    if (
        display_limit
        and sql_results["status"] == QueryStatus.SUCCESS
        and display_limit < sql_results["query"]["rows"]
    ):
        sql_results["data"] = sql_results["data"][:display_limit]
        sql_results["displayLimitReached"] = True
    return sql_results


# see all dashboard components type in
# /superset-frontend/src/dashboard/util/componentTypes.js
CONTAINER_TYPES = ["COLUMN", "GRID", "TABS", "TAB", "ROW"]


def get_dashboard_extra_filters(
    slice_id: int, dashboard_id: int
) -> list[dict[str, Any]]:
    dashboard = db.session.query(Dashboard).filter_by(id=dashboard_id).one_or_none()

    # is chart in this dashboard?
    if (
        dashboard is None
        or not dashboard.json_metadata
        or not dashboard.slices
        or not any(slc for slc in dashboard.slices if slc.id == slice_id)
    ):
        return []

    with contextlib.suppress(json.JSONDecodeError):
        # does this dashboard have default filters?
        json_metadata = json.loads(dashboard.json_metadata)
        default_filters = json.loads(json_metadata.get("default_filters", "null"))
        if not default_filters:
            return []

        # are default filters applicable to the given slice?
        filter_scopes = json_metadata.get("filter_scopes", {})
        layout = json.loads(dashboard.position_json or "{}")

        if (
            isinstance(layout, dict)
            and isinstance(filter_scopes, dict)
            and isinstance(default_filters, dict)
        ):
            return build_extra_filters(layout, filter_scopes, default_filters, slice_id)
    return []


def build_extra_filters(  # pylint: disable=too-many-locals,too-many-nested-blocks  # noqa: C901
    layout: dict[str, dict[str, Any]],
    filter_scopes: dict[str, dict[str, Any]],
    default_filters: dict[str, dict[str, list[Any]]],
    slice_id: int,
) -> list[dict[str, Any]]:
    extra_filters = []

    # do not apply filters if chart is not in filter's scope or chart is immune to the
    # filter.
    for filter_id, columns in default_filters.items():
        filter_slice = db.session.query(Slice).filter_by(id=filter_id).one_or_none()

        filter_configs: list[dict[str, Any]] = []
        if filter_slice:
            filter_configs = (
                json.loads(filter_slice.params or "{}").get("filter_configs") or []
            )

        scopes_by_filter_field = filter_scopes.get(filter_id, {})
        for col, val in columns.items():
            if not val:
                continue

            current_field_scopes = scopes_by_filter_field.get(col, {})
            scoped_container_ids = current_field_scopes.get("scope", ["ROOT_ID"])
            immune_slice_ids = current_field_scopes.get("immune", [])

            for container_id in scoped_container_ids:
                if slice_id not in immune_slice_ids and is_slice_in_container(
                    layout, container_id, slice_id
                ):
                    # Ensure that the filter value encoding adheres to the filter select
                    # type.
                    for filter_config in filter_configs:
                        if filter_config["column"] == col:
                            is_multiple = filter_config["multiple"]

                            if not is_multiple and isinstance(val, list):
                                val = val[0]
                            elif is_multiple and not isinstance(val, list):
                                val = [val]
                            break

                    extra_filters.append(
                        {
                            "col": col,
                            "op": "in" if isinstance(val, list) else "==",
                            "val": val,
                        }
                    )

    return extra_filters


def is_slice_in_container(
    layout: dict[str, dict[str, Any]], container_id: str, slice_id: int
) -> bool:
    if container_id == "ROOT_ID":
        return True

    node = layout[container_id]
    node_type = node.get("type")
    if node_type == "CHART" and node.get("meta", {}).get("chartId") == slice_id:
        return True

    if node_type in CONTAINER_TYPES:
        children = node.get("children", [])
        return any(
            is_slice_in_container(layout, child_id, slice_id) for child_id in children
        )

    return False


def check_resource_permissions(
    check_perms: Callable[..., Any],
) -> Callable[..., Any]:
    """
    A decorator for checking permissions on a request using the passed-in function.
    """

    def decorator(f: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> None:
            # check if the user can access the resource
            check_perms(*args, **kwargs)
            return f(*args, **kwargs)

        return wrapper

    return decorator


def check_explore_cache_perms(_self: Any, cache_key: str) -> None:
    """
    Loads async explore_json request data from cache and performs access check

    :param _self: the Superset view instance
    :param cache_key: the cache key passed into /explore_json/data/
    :raises SupersetSecurityException: If the user cannot access the resource
    """
    cached = cache_manager.cache.get(cache_key)
    if not cached:
        raise CacheLoadError("Cached data not found")

    check_datasource_perms(_self, form_data=cached["form_data"])


def check_datasource_perms(
    _self: Any,
    datasource_type: Optional[str] = None,
    datasource_id: Optional[int] = None,
    **kwargs: Any,
) -> None:
    """
    Check if user can access a cached response from explore_json.

    This function takes `self` since it must have the same signature as the
    the decorated method.

    :param datasource_type: The datasource type
    :param datasource_id: The datasource ID
    :raises SupersetSecurityException: If the user cannot access the resource
    """

    form_data = kwargs["form_data"] if "form_data" in kwargs else get_form_data()[0]

    try:
        datasource_id, datasource_type = get_datasource_info(
            datasource_id, datasource_type, form_data
        )
    except SupersetException as ex:
        raise SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.FAILED_FETCHING_DATASOURCE_INFO_ERROR,
                level=ErrorLevel.ERROR,
                message=str(ex),
            )
        ) from ex

    if datasource_type is None:
        raise SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.UNKNOWN_DATASOURCE_TYPE_ERROR,
                level=ErrorLevel.ERROR,
                message=_("Could not determine datasource type"),
            )
        )

    try:
        viz_obj = get_viz(
            datasource_type=datasource_type,
            datasource_id=datasource_id,
            form_data=form_data,
            force=False,
        )
    except NoResultFound as ex:
        raise SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.UNKNOWN_DATASOURCE_TYPE_ERROR,
                level=ErrorLevel.ERROR,
                message=_("Could not find viz object"),
            )
        ) from ex

    viz_obj.raise_for_access()


def _deserialize_results_payload(
    payload: Union[bytes, str], query: Query, use_msgpack: Optional[bool] = False
) -> dict[str, Any]:
    logger.debug("Deserializing from msgpack: %r", use_msgpack)
    if use_msgpack:
        with stats_timing(
            "sqllab.query.results_backend_msgpack_deserialize", stats_logger
        ):
            ds_payload = msgpack.loads(payload, raw=False)

        with stats_timing("sqllab.query.results_backend_pa_deserialize", stats_logger):
            try:
                reader = pa.BufferReader(ds_payload["data"])
                pa_table = pa.ipc.open_stream(reader).read_all()
            except pa.ArrowSerializationError as ex:
                raise SerializationError("Unable to deserialize table") from ex

        df = result_set.SupersetResultSet.convert_table_to_df(pa_table)
        ds_payload["data"] = dataframe.df_to_records(df) or []

        for column in ds_payload["selected_columns"]:
            if "name" in column:
                column["column_name"] = column.get("name")

        db_engine_spec = query.database.db_engine_spec
        all_columns, data, expanded_columns = db_engine_spec.expand_data(
            ds_payload["selected_columns"], ds_payload["data"]
        )
        ds_payload.update(
            {"data": data, "columns": all_columns, "expanded_columns": expanded_columns}
        )

        return ds_payload

    with stats_timing("sqllab.query.results_backend_json_deserialize", stats_logger):
        return json.loads(payload)


def get_cta_schema_name(
    database: Database, user: ab_models.User, schema: str, sql: str
) -> Optional[str]:
    func: Optional[Callable[[Database, ab_models.User, str, str], str]] = app.config[
        "SQLLAB_CTAS_SCHEMA_NAME_FUNC"
    ]
    if not func:
        return None
    return func(database, user, schema, sql)


def redirect_with_flash(url: str, message: str, category: str) -> Response:
    flash(message=message, category=category)
    return redirect(url)
