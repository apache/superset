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
import simplejson as json
from flask import flash, g, request
from flask_appbuilder.models.filters import BaseFilter
from flask_babel import lazy_gettext as _
from sqlalchemy import or_

from superset import db, security_manager
from superset.models import core as models
from superset.views.base import check_ownership, json_error_response, json_success
from superset.views.core_helpers import is_owner
from superset.views.utils import get_form_data


def save_slice(slc):
    session = db.session()
    msg = _("Chart [{}] has been saved").format(slc.slice_name)
    session.add(slc)
    session.commit()
    flash(msg, "info")


def overwrite_slice(slc):
    session = db.session()
    session.merge(slc)
    session.commit()
    msg = _("Chart [{}] has been overwritten").format(slc.slice_name)
    flash(msg, "info")


def save_or_overwrite_slice(  # pylint: disable=too-many-arguments,too-many-locals
    args,
    slc,
    slice_add_perm,
    slice_overwrite_perm,
    slice_download_perm,
    datasource_id,
    datasource_type,
    datasource_name,
):
    """Save or overwrite a slice"""
    slice_name = args.get("slice_name")
    act = args.get("action")
    form_data = get_form_data()[0]

    if act == "saveas":
        if "slice_id" in form_data:
            form_data.pop("slice_id")  # don't save old slice_id
        slc = models.Slice(owners=[g.user] if g.user else [])

    slc.params = json.dumps(form_data, indent=2, sort_keys=True)
    slc.datasource_name = datasource_name
    slc.viz_type = form_data["viz_type"]
    slc.datasource_type = datasource_type
    slc.datasource_id = datasource_id
    slc.slice_name = slice_name

    if act == "saveas" and slice_add_perm:
        save_slice(slc)
    elif act == "overwrite" and slice_overwrite_perm:
        overwrite_slice(slc)

    # Adding slice to a dashboard if requested
    dash = None
    if request.args.get("add_to_dash") == "existing":
        dash = (
            db.session.query(models.Dashboard)
            .filter_by(id=int(request.args.get("save_to_dashboard_id")))
            .one()
        )

        # check edit dashboard permissions
        dash_overwrite_perm = check_ownership(dash, raise_if_false=False)
        if not dash_overwrite_perm:
            return json_error_response(
                _("You don't have the rights to ") + _("alter this ") + _("dashboard"),
                status=400,
            )

        flash(
            _("Chart [{}] was added to dashboard [{}]").format(
                slc.slice_name, dash.dashboard_title
            ),
            "info",
        )
    elif request.args.get("add_to_dash") == "new":
        # check create dashboard permissions
        dash_add_perm = security_manager.can_access("can_add", "DashboardModelView")
        if not dash_add_perm:
            return json_error_response(
                _("You don't have the rights to ") + _("create a ") + _("dashboard"),
                status=400,
            )

        dash = models.Dashboard(
            dashboard_title=request.args.get("new_dashboard_name"),
            owners=[g.user] if g.user else [],
        )
        flash(
            _(
                "Dashboard [{}] just got created and chart [{}] was added " "to it"
            ).format(dash.dashboard_title, slc.slice_name),
            "info",
        )

    if dash and slc not in dash.slices:
        dash.slices.append(slc)
        db.session.commit()

    response = {
        "can_add": slice_add_perm,
        "can_download": slice_download_perm,
        "can_overwrite": is_owner(slc, g.user),
        "form_data": slc.form_data,
        "slice": slc.data,
        "dashboard_id": dash.id if dash else None,
    }

    if request.args.get("goto_dash") == "true":
        response.update({"dashboard": dash.url})

    return json_success(json.dumps(response))


class SliceFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    def apply(self, query, value):  # pylint: disable=unused-argument
        if security_manager.all_datasource_access():
            return query
        perms = security_manager.user_view_menu_names("datasource_access")
        schema_perms = security_manager.user_view_menu_names("schema_access")
        return query.filter(
            or_(self.model.perm.in_(perms), self.model.schema_perm.in_(schema_perms))
        )
