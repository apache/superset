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
import re

from flask import g
from flask_babel import lazy_gettext as _

from superset.utils import core as utils

from ..base import check_ownership
from .filters import DashboardFilter


class DashboardMixin:

    list_title = _("Dashboards")
    show_title = _("Show Dashboard")
    add_title = _("Add Dashboard")
    edit_title = _("Edit Dashboard")

    list_columns = ["dashboard_link", "creator", "published", "modified"]
    order_columns = ["modified", "published"]
    edit_columns = [
        "dashboard_title",
        "slug",
        "owners",
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
        "creator": _("Creator"),
        "modified": _("Modified"),
        "position_json": _("Position JSON"),
        "css": _("CSS"),
        "json_metadata": _("JSON Metadata"),
        "table_names": _("Underlying Tables"),
    }

    def pre_add(self, obj):
        obj.slug = obj.slug or None
        if obj.slug:
            obj.slug = obj.slug.strip()
            obj.slug = obj.slug.replace(" ", "-")
            obj.slug = re.sub(r"[^\w\-]+", "", obj.slug)
        if g.user not in obj.owners:
            obj.owners.append(g.user)
        utils.validate_json(obj.json_metadata)
        utils.validate_json(obj.position_json)
        owners = [o for o in obj.owners]
        for slc in obj.slices:
            slc.owners = list(set(owners) | set(slc.owners))

    def pre_update(self, obj):
        check_ownership(obj)
        self.pre_add(obj)

    def pre_delete(self, obj):
        check_ownership(obj)
