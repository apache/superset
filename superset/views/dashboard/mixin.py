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
from flask_babel import lazy_gettext as _

from ...dashboards.filters import DashboardFilter
from ..base import check_ownership


class DashboardMixin:  # pylint: disable=too-few-public-methods

    list_title = _("Dashboards")
    show_title = _("Show Dashboard")
    add_title = _("Add Dashboard")
    edit_title = _("Edit Dashboard")

    list_columns = ["dashboard_link", "creator", "published", "modified"]
    order_columns = ["dashboard_link", "modified", "published"]
    edit_columns = [
        "dashboard_title",
        "slug",
        "owners",
        "roles",
        "position_json",
        "css",
        "json_metadata",
        "published",
    ]
    show_columns = edit_columns + ["table_names", "charts"]
    search_columns = ("dashboard_title", "slug", "owners", "published")
    add_columns = edit_columns
    base_order = ("changed_on", "desc")
    description_columns = {
        "position_json": _(
            "This json object describes the positioning of the widgets in "
            "the dashboard. It is dynamically generated when adjusting "
            "the widgets size and positions by using drag & drop in "
            "the dashboard view"
        ),
        "css": _(
            "The CSS for individual dashboards can be altered here, or "
            "in the dashboard view where changes are immediately "
            "visible"
        ),
        "slug": _("To get a readable URL for your dashboard"),
        "json_metadata": _(
            "This JSON object is generated dynamically when clicking "
            "the save or overwrite button in the dashboard view. It "
            "is exposed here for reference and for power users who may "
            "want to alter specific parameters."
        ),
        "owners": _("Owners is a list of users who can alter the dashboard."),
        "roles": _(
            "Roles is a list which defines access to the dashboard. "
            "These roles are always applied in addition to restrictions on dataset "
            "level access. "
            "If no roles defined then the dashboard is available to all roles."
        ),
        "published": _(
            "Determines whether or not this dashboard is "
            "visible in the list of all dashboards"
        ),
    }
    base_filters = [["slice", DashboardFilter, lambda: []]]
    label_columns = {
        "dashboard_link": _("Dashboard"),
        "dashboard_title": _("Title"),
        "slug": _("Slug"),
        "charts": _("Charts"),
        "owners": _("Owners"),
        "roles": _("Roles"),
        "published": _("Published"),
        "creator": _("Creator"),
        "modified": _("Modified"),
        "position_json": _("Position JSON"),
        "css": _("CSS"),
        "json_metadata": _("JSON Metadata"),
        "table_names": _("Underlying Tables"),
    }

    def pre_delete(self, item: "DashboardMixin") -> None:  # pylint: disable=no-self-use
        check_ownership(item)
