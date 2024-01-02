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
from collections import Counter
from typing import Any

from flask import redirect, request
from flask_appbuilder import expose, permission_name
from flask_appbuilder.api import rison
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import _
from marshmallow import ValidationError
from sqlalchemy.exc import NoResultFound, NoSuchTableError

from superset import db, event_logger, security_manager
from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetNotFoundError,
)
from superset.commands.utils import populate_owners
from superset.connectors.sqla.models import SqlaTable
from superset.connectors.sqla.utils import get_physical_table_metadata
from superset.daos.datasource import DatasourceDAO
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.models.core import Database
from superset.superset_typing import FlaskResponse
from superset.utils.core import DatasourceType
from superset.views.base import (
    api,
    BaseSupersetView,
    deprecated,
    handle_api_exception,
    json_error_response,
)
from superset.views.datasource.schemas import (
    ExternalMetadataParams,
    ExternalMetadataSchema,
    get_external_metadata_schema,
    SamplesPayloadSchema,
    SamplesRequestSchema,
)
from superset.views.datasource.utils import get_samples
from superset.views.utils import sanitize_datasource_data


class Datasource(BaseSupersetView):
    """Datasource-related views"""

    @expose("/save/", methods=("POST",))
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.save",
        log_to_statsd=False,
    )
    @has_access_api
    @api
    @handle_api_exception
    @deprecated(new_target="/api/v1/dataset/<int:pk>")
    def save(self) -> FlaskResponse:
        data = request.form.get("data")
        if not isinstance(data, str):
            return json_error_response(_("Request missing data field."), status=500)

        datasource_dict = json.loads(data)
        normalize_columns = datasource_dict.get("normalize_columns", False)
        always_filter_main_dttm = datasource_dict.get("always_filter_main_dttm", False)
        datasource_dict["normalize_columns"] = normalize_columns
        datasource_dict["always_filter_main_dttm"] = always_filter_main_dttm
        datasource_id = datasource_dict.get("id")
        datasource_type = datasource_dict.get("type")
        database_id = datasource_dict["database"].get("id")
        orm_datasource = DatasourceDAO.get_datasource(
            db.session, DatasourceType(datasource_type), datasource_id
        )
        orm_datasource.database_id = database_id

        if "owners" in datasource_dict and orm_datasource.owner_class is not None:
            # Check ownership
            try:
                security_manager.raise_for_ownership(orm_datasource)
            except SupersetSecurityException as ex:
                raise DatasetForbiddenError() from ex

        datasource_dict["owners"] = populate_owners(
            datasource_dict["owners"], default_to_user=False
        )

        duplicates = [
            name
            for name, count in Counter(
                [col["column_name"] for col in datasource_dict["columns"]]
            ).items()
            if count > 1
        ]
        if duplicates:
            return json_error_response(
                _(
                    "Duplicate column name(s): %(columns)s",
                    columns=",".join(duplicates),
                ),
                status=409,
            )
        orm_datasource.update_from_object(datasource_dict)
        data = orm_datasource.data
        db.session.commit()

        return self.json_response(sanitize_datasource_data(data))

    @expose("/get/<datasource_type>/<datasource_id>/")
    @has_access_api
    @api
    @handle_api_exception
    @deprecated(new_target="/api/v1/dataset/<int:pk>")
    def get(self, datasource_type: str, datasource_id: int) -> FlaskResponse:
        datasource = DatasourceDAO.get_datasource(
            db.session, DatasourceType(datasource_type), datasource_id
        )
        return self.json_response(sanitize_datasource_data(datasource.data))

    @expose("/external_metadata/<datasource_type>/<datasource_id>/")
    @has_access_api
    @api
    @handle_api_exception
    def external_metadata(
        self, datasource_type: str, datasource_id: int
    ) -> FlaskResponse:
        """Gets column info from the source system"""
        datasource = DatasourceDAO.get_datasource(
            db.session,
            DatasourceType(datasource_type),
            datasource_id,
        )
        try:
            external_metadata = datasource.external_metadata()
        except SupersetException as ex:
            return json_error_response(str(ex), status=400)
        return self.json_response(external_metadata)

    @expose("/external_metadata_by_name/")
    @has_access_api
    @api
    @handle_api_exception
    @rison(get_external_metadata_schema)
    def external_metadata_by_name(self, **kwargs: Any) -> FlaskResponse:
        """Gets table metadata from the source system and SQLAlchemy inspector"""
        try:
            params: ExternalMetadataParams = ExternalMetadataSchema().load(
                kwargs.get("rison")
            )
        except ValidationError as err:
            return json_error_response(str(err), status=400)

        datasource = SqlaTable.get_datasource_by_name(
            session=db.session,
            database_name=params["database_name"],
            schema=params["schema_name"],
            datasource_name=params["table_name"],
        )
        try:
            if datasource is not None:
                # Get columns from Superset metadata
                external_metadata = datasource.external_metadata()
            else:
                # Use the SQLAlchemy inspector to get columns
                database = (
                    db.session.query(Database)
                    .filter_by(database_name=params["database_name"])
                    .one()
                )
                external_metadata = get_physical_table_metadata(
                    database=database,
                    table_name=params["table_name"],
                    schema_name=params["schema_name"],
                    normalize_columns=params.get("normalize_columns") or False,
                )
        except (NoResultFound, NoSuchTableError) as ex:
            raise DatasetNotFoundError() from ex
        return self.json_response(external_metadata)

    @expose("/samples", methods=("POST",))
    @has_access_api
    @api
    @handle_api_exception
    def samples(self) -> FlaskResponse:
        try:
            params = SamplesRequestSchema().load(request.args)
            payload = SamplesPayloadSchema().load(request.json)
        except ValidationError as err:
            return json_error_response(err.messages, status=400)

        rv = get_samples(
            datasource_type=params["datasource_type"],
            datasource_id=params["datasource_id"],
            force=params["force"],
            page=params["page"],
            per_page=params["per_page"],
            payload=payload,
        )
        return self.json_response({"result": rv})


class DatasetEditor(BaseSupersetView):
    route_base = "/dataset"
    class_permission_name = "Dataset"

    @expose("/add/")
    @has_access
    @permission_name("read")
    def root(self) -> FlaskResponse:
        return super().render_app_template()

    @expose("/<pk>", methods=("GET",))
    @has_access
    @permission_name("read")
    # pylint: disable=unused-argument
    def show(self, pk: int) -> FlaskResponse:
        dev = request.args.get("testing")
        if dev is not None:
            return super().render_app_template()
        return redirect("/")
