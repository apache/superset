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
from flask import Markup
from flask_babel import lazy_gettext as _

from superset.views.chart.filters import SliceFilter
from superset.views.dashboard.filters import DashboardFilter


class SliceMixin:  # pylint: disable=too-few-public-methods

    list_title = _("Charts")
    show_title = _("Show Chart")
    add_title = _("Add Chart")
    edit_title = _("Edit Chart")

    can_add = False
    search_columns = (
        "slice_name",
        "description",
        "viz_type",
        "datasource_name",
        "owners",
    )
    list_columns = ["slice_link", "viz_type", "datasource_link", "creator", "modified"]
    order_columns = ["viz_type", "datasource_link", "modified"]
    edit_columns = [
        "slice_name",
        "description",
        "viz_type",
        "owners",
        "dashboards",
        "params",
        "cache_timeout",
    ]
    base_order = ("changed_on", "desc")
    description_columns = {
        "description": Markup(
            "The content here can be displayed as widget headers in the "
            "dashboard view. Supports "
            '<a href="https://daringfireball.net/projects/markdown/"">'
            "markdown</a>"
        ),
        "params": _(
            "These parameters are generated dynamically when clicking "
            "the save or overwrite button in the explore view. This JSON "
            "object is exposed here for reference and for power users who may "
            "want to alter specific parameters."
        ),
        "cache_timeout": _(
            "Duration (in seconds) of the caching timeout for this chart. "
            "Note this defaults to the datasource/table timeout if undefined."
        ),
    }
    base_filters = [["id", SliceFilter, lambda: []]]
    label_columns = {
        "cache_timeout": _("Cache Timeout"),
        "creator": _("Creator"),
        "dashboards": _("Dashboards"),
        "datasource_link": _("Datasource"),
        "description": _("Description"),
        "modified": _("Last Modified"),
        "owners": _("Owners"),
        "params": _("Parameters"),
        "slice_link": _("Chart"),
        "slice_name": _("Name"),
        "table": _("Table"),
        "viz_type": _("Visualization Type"),
    }

    add_form_query_rel_fields = {"dashboards": [["name", DashboardFilter, None]]}

    edit_form_query_rel_fields = add_form_query_rel_fields
