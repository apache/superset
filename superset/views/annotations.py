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
from typing import Any, Dict

from flask_appbuilder import CompactCRUDMixin
from flask_appbuilder.api import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from wtforms.validators import StopValidation

from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.models.annotations import Annotation, AnnotationLayer
from superset.superset_typing import FlaskResponse
from superset.views.base import SupersetModelView


class StartEndDttmValidator:  # pylint: disable=too-few-public-methods
    """
    Validates dttm fields.
    """

    def __call__(self, form: Dict[str, Any], field: Any) -> None:
        if not form["start_dttm"].data and not form["end_dttm"].data:
            raise StopValidation(_("annotation start time or end time is required."))
        if (
            form["end_dttm"].data
            and form["start_dttm"].data
            and form["end_dttm"].data < form["start_dttm"].data
        ):
            raise StopValidation(
                _("Annotation end time must be no earlier than start time.")
            )


class AnnotationModelView(
    SupersetModelView, CompactCRUDMixin
):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(Annotation)
    include_route_methods = RouteMethod.CRUD_SET | {"annotation"}

    class_permission_name = "Annotation"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    list_title = _("Annotations")
    show_title = _("Show Annotation")
    add_title = _("Add Annotation")
    edit_title = _("Edit Annotation")

    list_columns = ["short_descr", "start_dttm", "end_dttm"]
    edit_columns = [
        "layer",
        "short_descr",
        "long_descr",
        "start_dttm",
        "end_dttm",
        "json_metadata",
    ]

    add_columns = edit_columns

    label_columns = {
        "layer": _("Layer"),
        "short_descr": _("Label"),
        "long_descr": _("Description"),
        "start_dttm": _("Start"),
        "end_dttm": _("End"),
        "json_metadata": _("JSON Metadata"),
    }

    description_columns = {
        "json_metadata": "This JSON represents any additional metadata this \
         annotation needs to add more context."
    }

    validators_columns = {"start_dttm": [StartEndDttmValidator()]}

    def pre_add(self, item: "AnnotationModelView") -> None:
        if not item.start_dttm:
            item.start_dttm = item.end_dttm
        elif not item.end_dttm:
            item.end_dttm = item.start_dttm

    def pre_update(self, item: "AnnotationModelView") -> None:
        self.pre_add(item)

    @expose("/<pk>/annotation/", methods=["GET"])
    @has_access
    def annotation(self, pk: int) -> FlaskResponse:  # pylint: disable=unused-argument
        return super().render_app_template()


class AnnotationLayerModelView(SupersetModelView):
    datamodel = SQLAInterface(AnnotationLayer)
    include_route_methods = RouteMethod.CRUD_SET | {RouteMethod.API_READ}
    related_views = [AnnotationModelView]

    class_permission_name = "Annotation"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    list_title = _("Annotation Layers")
    show_title = _("Show Annotation Layer")
    add_title = _("Add Annotation Layer")
    edit_title = _("Edit Annotation Layer")

    list_columns = ["id", "name", "descr"]
    edit_columns = ["name", "descr"]
    add_columns = edit_columns

    label_columns = {"name": _("Name"), "descr": _("Description")}

    @expose("/list/")
    @has_access
    def list(self) -> FlaskResponse:
        return super().render_app_template()
