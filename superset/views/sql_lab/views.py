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
# pylint: disable=consider-using-transaction
import logging

from flask import request, Response
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import gettext as __
from sqlalchemy import and_

from superset import db
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.models.sql_lab import Query, SavedQuery, TableSchema, TabState
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.core import get_user_id
from superset.views.base import (
    BaseSupersetView,
    DeleteMixin,
    DeprecateModelViewMixin,
    json_success,
    SupersetModelView,
)

logger = logging.getLogger(__name__)


class SavedQueryView(DeprecateModelViewMixin, BaseSupersetView):
    route_base = "/savedqueryview"
    class_permission_name = "SavedQuery"

    @expose("/list/")
    @has_access
    def list(self) -> FlaskResponse:
        return super().render_app_template()


class SavedQueryViewApi(DeprecateModelViewMixin, SupersetModelView, DeleteMixin):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(SavedQuery)
    include_route_methods = RouteMethod.CRUD_SET
    route_base = "/savedqueryviewapi"
    class_permission_name = "SavedQuery"

    include_route_methods = {
        RouteMethod.API_READ,
        RouteMethod.API_CREATE,
        RouteMethod.API_UPDATE,
        RouteMethod.API_GET,
    }

    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    add_columns = ["label", "db_id", "schema", "description", "sql", "extra_json"]
    edit_columns = add_columns
    show_columns = add_columns + ["id"]

    @has_access_api
    @expose("show/<pk>")
    def show(self, pk: int) -> FlaskResponse:
        return super().show(pk)


def _get_owner_id(tab_state_id: int) -> int:
    return db.session.query(TabState.user_id).filter_by(id=tab_state_id).scalar()


class TabStateView(BaseSupersetView):
    @has_access_api
    @expose("/", methods=("POST",))
    def post(self) -> FlaskResponse:
        query_editor = json.loads(request.form["queryEditor"])
        tab_state = TabState(
            user_id=get_user_id(),
            # This is for backward compatibility
            label=query_editor.get("name")
            or query_editor.get("title", __("Untitled Query")),
            active=True,
            database_id=query_editor["dbId"],
            catalog=query_editor.get("catalog"),
            schema=query_editor.get("schema"),
            sql=query_editor.get("sql", "SELECT ..."),
            query_limit=query_editor.get("queryLimit"),
            hide_left_bar=query_editor.get("hideLeftBar"),
            saved_query_id=query_editor.get("remoteId"),
            template_params=query_editor.get("templateParams"),
        )
        (
            db.session.query(TabState)
            .filter_by(user_id=get_user_id())
            .update({"active": False})
        )
        db.session.add(tab_state)
        db.session.commit()
        return json_success(json.dumps({"id": tab_state.id}))

    @has_access_api
    @expose("/<int:tab_state_id>", methods=("DELETE",))
    def delete(self, tab_state_id: int) -> FlaskResponse:
        owner_id = _get_owner_id(tab_state_id)
        if owner_id is None:
            return Response(status=404)
        if owner_id != get_user_id():
            return Response(status=403)

        db.session.query(TabState).filter(TabState.id == tab_state_id).delete(
            synchronize_session=False
        )
        db.session.query(TableSchema).filter(
            TableSchema.tab_state_id == tab_state_id
        ).delete(synchronize_session=False)
        db.session.commit()
        return json_success(json.dumps("OK"))

    @has_access_api
    @expose("/<int:tab_state_id>", methods=("GET",))
    def get(self, tab_state_id: int) -> FlaskResponse:
        owner_id = _get_owner_id(tab_state_id)
        if owner_id is None:
            return Response(status=404)
        if owner_id != get_user_id():
            return Response(status=403)

        tab_state = db.session.query(TabState).filter_by(id=tab_state_id).first()
        if tab_state is None:
            return Response(status=404)
        return json_success(
            json.dumps(tab_state.to_dict(), default=json.json_iso_dttm_ser)
        )

    @has_access_api
    @expose("<int:tab_state_id>/activate", methods=("POST",))
    def activate(self, tab_state_id: int) -> FlaskResponse:
        owner_id = _get_owner_id(tab_state_id)
        if owner_id is None:
            return Response(status=404)
        if owner_id != get_user_id():
            return Response(status=403)

        (
            db.session.query(TabState)
            .filter_by(user_id=get_user_id())
            .update({"active": TabState.id == tab_state_id})
        )
        db.session.commit()
        return json_success(json.dumps(tab_state_id))

    @has_access_api
    @expose("<int:tab_state_id>", methods=("PUT",))
    def put(self, tab_state_id: int) -> FlaskResponse:
        owner_id = _get_owner_id(tab_state_id)
        if owner_id is None:
            return Response(status=404)
        if owner_id != get_user_id():
            return Response(status=403)

        fields = {k: json.loads(v) for k, v in request.form.to_dict().items()}
        if client_id := fields.get("latest_query_id"):
            query = db.session.query(Query).filter_by(client_id=client_id).one_or_none()
            if not query:
                return self.json_response({"error": "Bad request"}, status=400)
        db.session.query(TabState).filter_by(id=tab_state_id).update(fields)
        db.session.commit()
        return json_success(json.dumps(tab_state_id))

    @has_access_api
    @expose("<int:tab_state_id>/migrate_query", methods=("POST",))
    def migrate_query(self, tab_state_id: int) -> FlaskResponse:
        owner_id = _get_owner_id(tab_state_id)
        if owner_id is None:
            return Response(status=404)
        if owner_id != get_user_id():
            return Response(status=403)

        client_id = json.loads(request.form["queryId"])
        db.session.query(Query).filter_by(client_id=client_id).update(
            {"sql_editor_id": tab_state_id}
        )
        db.session.commit()
        return json_success(json.dumps(tab_state_id))

    @has_access_api
    @expose("<int:tab_state_id>/query/<client_id>", methods=("DELETE",))
    def delete_query(self, tab_state_id: int, client_id: str) -> FlaskResponse:
        # Before deleting the query, ensure it's not tied to any
        # active tab as the last query. If so, replace the query
        # with the latest one created in that tab
        tab_state_query = db.session.query(TabState).filter_by(
            id=tab_state_id, latest_query_id=client_id
        )
        if tab_state_query.count():
            query = (
                db.session.query(Query)
                .filter(
                    and_(
                        Query.client_id != client_id,
                        Query.user_id == get_user_id(),
                        Query.sql_editor_id == str(tab_state_id),
                    ),
                )
                .order_by(Query.id.desc())
                .first()
            )
            tab_state_query.update(
                {"latest_query_id": query.client_id if query else None}
            )

        db.session.query(Query).filter_by(
            client_id=client_id,
            user_id=get_user_id(),
            sql_editor_id=str(tab_state_id),
        ).delete(synchronize_session=False)
        db.session.commit()
        return json_success(json.dumps("OK"))


class TableSchemaView(BaseSupersetView):
    @has_access_api
    @expose("/", methods=("POST",))
    def post(self) -> FlaskResponse:
        table = json.loads(request.form["table"])

        # delete any existing table schema
        db.session.query(TableSchema).filter(
            TableSchema.tab_state_id == table["queryEditorId"],
            TableSchema.database_id == table["dbId"],
            TableSchema.schema == table["schema"],
            TableSchema.table == table["name"],
        ).delete(synchronize_session=False)

        table_schema = TableSchema(
            tab_state_id=table["queryEditorId"],
            database_id=table["dbId"],
            schema=table["schema"],
            table=table["name"],
            description=json.dumps(table),
            expanded=True,
        )
        db.session.add(table_schema)
        db.session.commit()
        return json_success(json.dumps({"id": table_schema.id}))

    @has_access_api
    @expose("/<int:table_schema_id>", methods=("DELETE",))
    def delete(self, table_schema_id: int) -> FlaskResponse:
        db.session.query(TableSchema).filter(TableSchema.id == table_schema_id).delete(
            synchronize_session=False
        )
        db.session.commit()
        return json_success(json.dumps("OK"))

    @has_access_api
    @expose("/<int:table_schema_id>/expanded", methods=("POST",))
    def expanded(self, table_schema_id: int) -> FlaskResponse:
        payload = json.loads(request.form["expanded"])
        (
            db.session.query(TableSchema)
            .filter_by(id=table_schema_id)
            .update({"expanded": payload})
        )
        response = json.dumps({"id": table_schema_id, "expanded": payload})
        return json_success(response)
