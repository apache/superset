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
import json
import re
from typing import Callable, List, Union

from flask import g, redirect, request, Response
from flask_appbuilder import expose
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import gettext as __, lazy_gettext as _
from flask_login import AnonymousUserMixin, login_user

from superset import db, event_logger, is_feature_enabled, security_manager
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.models.dashboard import Dashboard as DashboardModel
from superset.superset_typing import FlaskResponse
from superset.utils import core as utils
from superset.views.base import (
    BaseSupersetView,
    common_bootstrap_payload,
    DeleteMixin,
    generate_download_headers,
    SupersetModelView,
)
from superset.views.dashboard.mixin import DashboardMixin


class DashboardModelView(
    DashboardMixin, SupersetModelView, DeleteMixin
):  # pylint: disable=too-many-ancestors
    route_base = "/dashboard"
    datamodel = SQLAInterface(DashboardModel)
    # TODO disable api_read and api_delete (used by cypress)
    # once we move to ChartRestModelApi
    class_permission_name = "Dashboard"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    include_route_methods = RouteMethod.CRUD_SET | {
        RouteMethod.API_READ,
        RouteMethod.API_DELETE,
        "download_dashboards",
    }

    @has_access
    @expose("/list/")
    def list(self) -> FlaskResponse:
        return super().render_app_template()

    @action("mulexport", __("Export"), __("Export dashboards?"), "fa-database")
    def mulexport(  # pylint: disable=no-self-use
        self, items: Union["DashboardModelView", List["DashboardModelView"]]
    ) -> FlaskResponse:
        if not isinstance(items, list):
            items = [items]
        ids = "".join("&id={}".format(d.id) for d in items)
        return redirect("/dashboard/export_dashboards_form?{}".format(ids[1:]))

    @event_logger.log_this
    @has_access
    @expose("/export_dashboards_form")
    def download_dashboards(self) -> FlaskResponse:
        if request.args.get("action") == "go":
            ids = request.args.getlist("id")
            return Response(
                DashboardModel.export_dashboards(ids),
                headers=generate_download_headers("json"),
                mimetype="application/text",
            )
        return self.render_template(
            "superset/export_dashboards.html", dashboards_url="/dashboard/list"
        )

    def pre_add(self, item: "DashboardModelView") -> None:
        item.slug = item.slug or None
        if item.slug:
            item.slug = item.slug.strip()
            item.slug = item.slug.replace(" ", "-")
            item.slug = re.sub(r"[^\w\-]+", "", item.slug)
        if g.user not in item.owners:
            item.owners.append(g.user)
        utils.validate_json(item.json_metadata)
        utils.validate_json(item.position_json)
        for slc in item.slices:
            slc.owners = list(set(item.owners) | set(slc.owners))

    def pre_update(self, item: "DashboardModelView") -> None:
        security_manager.raise_for_ownership(item)
        self.pre_add(item)


class Dashboard(BaseSupersetView):
    """The base views for Superset!"""

    class_permission_name = "Dashboard"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @has_access
    @expose("/new/")
    def new(self) -> FlaskResponse:  # pylint: disable=no-self-use
        """Creates a new, blank dashboard and redirects to it in edit mode"""
        metadata = {}
        if is_feature_enabled("ENABLE_FILTER_BOX_MIGRATION"):
            metadata = {
                "native_filter_configuration": [],
                "show_native_filters": True,
            }

        new_dashboard = DashboardModel(
            dashboard_title="[ untitled dashboard ]",
            owners=[g.user],
            json_metadata=json.dumps(metadata, sort_keys=True),
        )
        db.session.add(new_dashboard)
        db.session.commit()
        return redirect(f"/superset/dashboard/{new_dashboard.id}/?edit=true")

    @expose("/<dashboard_id_or_slug>/embedded")
    @event_logger.log_this_with_extra_payload
    def embedded(
        self,
        dashboard_id_or_slug: str,
        add_extra_log_payload: Callable[..., None] = lambda **kwargs: None,
    ) -> FlaskResponse:
        """
        Server side rendering for a dashboard
        :param dashboard_id_or_slug: identifier for dashboard. used in the decorators
        :param add_extra_log_payload: added by `log_this_with_manual_updates`, set a
            default value to appease pylint
        """
        if not is_feature_enabled("EMBEDDED_SUPERSET"):
            return Response(status=404)

        # Log in as an anonymous user, just for this view.
        # This view needs to be visible to all users,
        # and building the page fails if g.user and/or ctx.user aren't present.
        login_user(AnonymousUserMixin(), force=True)

        add_extra_log_payload(
            dashboard_id=dashboard_id_or_slug,
            dashboard_version="v2",
        )

        bootstrap_data = {
            "common": common_bootstrap_payload(g.user),
            "embedded": {"dashboard_id": dashboard_id_or_slug},
        }

        return self.render_template(
            "superset/spa.html",
            entry="embedded",
            bootstrap_data=json.dumps(
                bootstrap_data, default=utils.pessimistic_json_iso_dttm_ser
            ),
        )


class DashboardModelViewAsync(DashboardModelView):  # pylint: disable=too-many-ancestors
    route_base = "/dashboardasync"
    class_permission_name = "Dashboard"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    include_route_methods = {RouteMethod.API_READ}

    list_columns = [
        "id",
        "dashboard_link",
        "creator",
        "modified",
        "dashboard_title",
        "changed_on",
        "url",
        "changed_by_name",
    ]
    label_columns = {
        "dashboard_link": _("Dashboard"),
        "dashboard_title": _("Title"),
        "creator": _("Creator"),
        "modified": _("Modified"),
    }
