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
from typing import TYPE_CHECKING

from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from wtforms.fields import StringField
from wtforms.validators import ValidationError

import superset.models.core as models
from superset import app
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.exceptions import CertificateException
from superset.superset_typing import FlaskResponse
from superset.utils import core as utils
from superset.views.base import (
    DeleteMixin,
    DeprecateModelViewMixin,
    SupersetModelView,
    YamlExportMixin,
)

from .mixins import DatabaseMixin
from .validators import sqlalchemy_uri_validator

if TYPE_CHECKING:
    from werkzeug.datastructures import FileStorage

config = app.config
stats_logger = config["STATS_LOGGER"]


def sqlalchemy_uri_form_validator(_: _, field: StringField) -> None:
    """
    Check if user has submitted a valid SQLAlchemy URI
    """

    sqlalchemy_uri_validator(field.data, exception=ValidationError)


def certificate_form_validator(_: _, field: StringField) -> None:
    """
    Check if user has submitted a valid SSL certificate
    """
    if field.data:
        try:
            utils.parse_ssl_cert(field.data)
        except CertificateException as ex:
            raise ValidationError(ex.message) from ex


def upload_stream_write(form_file_field: "FileStorage", path: str) -> None:
    chunk_size = app.config["UPLOAD_CHUNK_SIZE"]
    with open(path, "bw") as file_description:
        while True:
            chunk = form_file_field.stream.read(chunk_size)
            if not chunk:
                break
            file_description.write(chunk)


class DatabaseView(
    DeprecateModelViewMixin,
    DatabaseMixin,
    SupersetModelView,
    DeleteMixin,
    YamlExportMixin,
):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(models.Database)

    class_permission_name = "Database"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    include_route_methods = RouteMethod.CRUD_SET

    add_template = "superset/models/database/add.html"
    edit_template = "superset/models/database/edit.html"
    validators_columns = {
        "sqlalchemy_uri": [sqlalchemy_uri_form_validator],
        "server_cert": [certificate_form_validator],
    }

    yaml_dict_key = "databases"

    @expose("/list/")
    @has_access
    def list(self) -> FlaskResponse:
        return super().render_app_template()
