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

from flask_appbuilder import expose, has_access
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _

from superset import db
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models.slice import Slice
from superset.utils import core as utils
from superset.views.base import check_ownership, DeleteMixin, SupersetModelView
from superset.views.chart.mixin import SliceMixin


class SliceModelView(
    SliceMixin, SupersetModelView, DeleteMixin
):  # pylint: disable=too-many-ancestors
    route_base = "/chart"
    datamodel = SQLAInterface(Slice)

    def pre_add(self, item):
        utils.validate_json(item.params)

    def pre_update(self, item):
        utils.validate_json(item.params)
        check_ownership(item)

    def pre_delete(self, item):
        check_ownership(item)

    @expose("/add", methods=["GET", "POST"])
    @has_access
    def add(self):
        datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = [
            {"value": str(d.id) + "__" + d.type, "label": repr(d)} for d in datasources
        ]
        return self.render_template(
            "superset/add_slice.html",
            bootstrap_data=json.dumps(
                {"datasources": sorted(datasources, key=lambda d: d["label"])}
            ),
        )


class SliceAsync(SliceModelView):  # pylint: disable=too-many-ancestors
    route_base = "/sliceasync"
    list_columns = [
        "id",
        "slice_link",
        "viz_type",
        "slice_name",
        "creator",
        "modified",
        "icons",
        "changed_on_humanized",
    ]
    label_columns = {"icons": " ", "slice_link": _("Chart")}


class SliceAddView(SliceModelView):  # pylint: disable=too-many-ancestors
    route_base = "/sliceaddview"
    list_columns = [
        "id",
        "slice_name",
        "slice_url",
        "edit_url",
        "viz_type",
        "params",
        "description",
        "description_markeddown",
        "datasource_id",
        "datasource_type",
        "datasource_name_text",
        "datasource_link",
        "owners",
        "modified",
        "changed_on",
        "changed_on_humanized",
    ]
