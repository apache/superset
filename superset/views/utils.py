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
# pylint: disable=C,R,W
from collections import defaultdict
from datetime import date
from typing import Any, Dict, List, Optional, Tuple
from urllib import parse

import simplejson as json
from flask import request

import superset.models.core as models
from superset import app, db, viz
from superset.connectors.connector_registry import ConnectorRegistry
from superset.exceptions import SupersetException
from superset.legacy import update_time_range
from superset.utils.core import QueryStatus, TimeRangeEndpoint

FORM_DATA_KEY_BLACKLIST: List[str] = []
if not app.config["ENABLE_JAVASCRIPT_CONTROLS"]:
    FORM_DATA_KEY_BLACKLIST = ["js_tooltip", "js_onclick_href", "js_data_mutator"]


def bootstrap_user_data(user, include_perms=False):
    payload = {
        "username": user.username,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "userId": user.id,
        "isActive": user.is_active,
        "createdOn": user.created_on.isoformat(),
        "email": user.email,
    }

    if include_perms:
        roles, permissions = get_permissions(user)
        payload["roles"] = roles
        payload["permissions"] = permissions

    return payload


def get_permissions(user):
    if not user.roles:
        raise AttributeError("User object does not have roles")

    roles = {}
    permissions = defaultdict(set)
    for role in user.roles:
        perms = set()
        for perm in role.permissions:
            if perm.permission and perm.view_menu:
                perms.add((perm.permission.name, perm.view_menu.name))
                if perm.permission.name in ("datasource_access", "database_access"):
                    permissions[perm.permission.name].add(perm.view_menu.name)
        roles[role.name] = [
            [perm.permission.name, perm.view_menu.name]
            for perm in role.permissions
            if perm.permission and perm.view_menu
        ]

    return roles, permissions


def get_viz(
    slice_id=None, form_data=None, datasource_type=None, datasource_id=None, force=False
):
    if slice_id:
        slc = db.session.query(models.Slice).filter_by(id=slice_id).one()
        return slc.get_viz()
    else:
        viz_type = form_data.get("viz_type", "table")
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session
        )
        viz_obj = viz.viz_types[viz_type](datasource, form_data=form_data, force=force)
        return viz_obj


def get_form_data(slice_id=None, use_slice_data=False):
    form_data = {}
    post_data = request.form.get("form_data")
    request_args_data = request.args.get("form_data")
    # Supporting POST
    if post_data:
        form_data.update(json.loads(post_data))
    # request params can overwrite post body
    if request_args_data:
        form_data.update(json.loads(request_args_data))

    url_id = request.args.get("r")
    if url_id:
        saved_url = db.session.query(models.Url).filter_by(id=url_id).first()
        if saved_url:
            url_str = parse.unquote_plus(
                saved_url.url.split("?")[1][10:], encoding="utf-8", errors=None
            )
            url_form_data = json.loads(url_str)
            # allow form_date in request override saved url
            url_form_data.update(form_data)
            form_data = url_form_data

    form_data = {k: v for k, v in form_data.items() if k not in FORM_DATA_KEY_BLACKLIST}

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
        slc = db.session.query(models.Slice).filter_by(id=slice_id).one_or_none()
        if slc:
            slice_form_data = slc.form_data.copy()
            slice_form_data.update(form_data)
            form_data = slice_form_data

    update_time_range(form_data)

    if app.config["SIP_15_ENABLED"]:
        form_data["time_range_endpoints"] = get_time_range_endpoints(
            form_data, slc, slice_id
        )

    return form_data, slc


def get_datasource_info(
    datasource_id: Optional[int],
    datasource_type: Optional[str],
    form_data: Dict[str, Any],
) -> Tuple[int, Optional[str]]:
    """
    Compatibility layer for handling of datasource info

    datasource_id & datasource_type used to be passed in the URL
    directory, now they should come as part of the form_data,

    This function allows supporting both without duplicating code

    :param datasource_id: The datasource ID
    :param datasource_type: The datasource type, i.e., 'druid' or 'table'
    :param form_data: The URL form data
    :returns: The datasource ID and type
    :raises SupersetException: If the datasource no longer exists
    """

    datasource = form_data.get("datasource", "")

    if "__" in datasource:
        datasource_id, datasource_type = datasource.split("__")
        # The case where the datasource has been deleted
        if datasource_id == "None":
            datasource_id = None

    if not datasource_id:
        raise SupersetException(
            "The datasource associated with this chart no longer exists"
        )

    datasource_id = int(datasource_id)
    return datasource_id, datasource_type


def apply_display_max_row_limit(
    sql_results: Dict[str, Any], rows: Optional[int] = None
) -> Dict[str, Any]:
    """
    Given a `sql_results` nested structure, applies a limit to the number of rows

    `sql_results` here is the nested structure coming out of sql_lab.get_sql_results, it
    contains metadata about the query, as well as the data set returned by the query.
    This method limits the number of rows adds a `displayLimitReached: True` flag to the
    metadata.

    :param sql_results: The results of a sql query from sql_lab.get_sql_results
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


def get_time_range_endpoints(
    form_data: Dict[str, Any],
    slc: Optional[models.Slice] = None,
    slice_id: Optional[int] = None,
) -> Optional[Tuple[TimeRangeEndpoint, TimeRangeEndpoint]]:
    """
    Get the slice aware time range endpoints from the form-data falling back to the SQL
    database specific definition or default if not defined.

    Note under certain circumstances the slice object may not exist, however the slice
    ID may be defined which serves as a fallback.

    When SIP-15 is enabled all slices and will the [start, end) interval. If the grace
    period is defined and has ended all slices will adhere to the [start, end) interval.

    :param form_data: The form-data
    :param slc: The slice
    :param slice_id: The slice ID
    :returns: The time range endpoints tuple
    """

    if (
        app.config["SIP_15_GRACE_PERIOD_END"]
        and date.today() >= app.config["SIP_15_GRACE_PERIOD_END"]
    ):
        return (TimeRangeEndpoint.INCLUSIVE, TimeRangeEndpoint.EXCLUSIVE)

    endpoints = form_data.get("time_range_endpoints")

    if (slc or slice_id) and not endpoints:
        try:
            _, datasource_type = get_datasource_info(None, None, form_data)
        except SupersetException:
            return None

        if datasource_type == "table":
            if not slc:
                slc = (
                    db.session.query(models.Slice).filter_by(id=slice_id).one_or_none()
                )

            if slc:
                endpoints = slc.datasource.database.get_extra().get(
                    "time_range_endpoints"
                )

            if not endpoints:
                endpoints = app.config["SIP_15_DEFAULT_TIME_RANGE_ENDPOINTS"]

    if endpoints:
        start, end = endpoints
        return (TimeRangeEndpoint(start), TimeRangeEndpoint(end))

    return (TimeRangeEndpoint.INCLUSIVE, TimeRangeEndpoint.EXCLUSIVE)
