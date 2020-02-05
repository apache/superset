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
from typing import Callable

import simplejson as json
from flask import g, redirect, request, Response
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from flask_babel import lazy_gettext as _
from flask_sqlalchemy import BaseQuery

from superset import db, get_feature_flags, security_manager
from superset.constants import RouteMethod
from superset.models.sql_lab import Query, SavedQuery, TableSchema, TabState
from superset.utils import core as utils

from .base import (
    BaseFilter,
    BaseSupersetView,
    DeleteMixin,
    json_success,
    SupersetModelView,
)


class QueryFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    def apply(self, query: BaseQuery, value: Callable) -> BaseQuery:
        """
        Filter queries to only those owned by current user. If
        can_access_all_queries permission is set a user can list all queries

        :returns: query
        """
        if not security_manager.can_access_all_queries():
            query = query.filter(Query.user_id == g.user.get_user_id())
        return query


class QueryView(SupersetModelView):
    datamodel = SQLAInterface(Query)
    include_route_methods = {RouteMethod.SHOW, RouteMethod.LIST, RouteMethod.API_READ}

    list_title = _("List Query")
    show_title = _("Show Query")
    add_title = _("Add Query")
    edit_title = _("Edit Query")

    list_columns = ["username", "database_name", "status", "start_time", "end_time"]
    order_columns = ["status", "start_time", "end_time"]
    base_filters = [["id", QueryFilter, lambda: []]]
    label_columns = {
        "user": _("User"),
        "username": _("User"),
        "database_name": _("Database"),
        "status": _("Status"),
        "start_time": _("Start Time"),
        "end_time": _("End Time"),
    }


class SavedQueryView(
    SupersetModelView, DeleteMixin
):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(SavedQuery)
    include_route_methods = RouteMethod.CRUD_SET

    list_title = _("List Saved Query")
    show_title = _("Show Saved Query")
    add_title = _("Add Saved Query")
    edit_title = _("Edit Saved Query")

    list_columns = [
        "label",
        "user",
        "database",
        "schema",
        "description",
        "modified",
        "pop_tab_link",
    ]
    order_columns = ["label", "schema", "description", "modified"]
    show_columns = [
        "id",
        "label",
        "user",
        "database",
        "description",
        "sql",
        "pop_tab_link",
    ]
    search_columns = ("label", "user", "database", "schema", "changed_on")
    add_columns = ["label", "database", "description", "sql"]
    edit_columns = add_columns
    base_order = ("changed_on", "desc")
    label_columns = {
        "label": _("Label"),
        "user": _("User"),
        "database": _("Database"),
        "description": _("Description"),
        "modified": _("Modified"),
        "end_time": _("End Time"),
        "pop_tab_link": _("Pop Tab Link"),
        "changed_on": _("Changed on"),
    }

    show_template = "superset/models/savedquery/show.html"

    def pre_add(self, item):
        item.user = g.user

    def pre_update(self, item):
        self.pre_add(item)

    @has_access
    @expose("show/<pk>")
    def show(self, pk):
        pk = self._deserialize_pk_if_composite(pk)
        widgets = self._show(pk)
        query = self.datamodel.get(pk).to_json()
        query["extra_json"] = json.loads(query["extra_json"])
        payload = {"common": {"feature_flags": get_feature_flags(), "query": query}}

        return self.render_template(
            self.show_template,
            pk=pk,
            title=self.show_title,
            widgets=widgets,
            related_views=self._related_views,
            bootstrap_data=json.dumps(payload, default=utils.json_iso_dttm_ser),
        )


class SavedQueryViewApi(SavedQueryView):  # pylint: disable=too-many-ancestors
    include_route_methods = {
        RouteMethod.API_READ,
        RouteMethod.API_CREATE,
        RouteMethod.API_UPDATE,
        RouteMethod.API_GET,
    }
    list_columns = [
        "id",
        "label",
        "sqlalchemy_uri",
        "user_email",
        "schema",
        "description",
        "sql",
        "extra_json",
    ]
    add_columns = ["label", "db_id", "schema", "description", "sql", "extra_json"]
    edit_columns = add_columns
    show_columns = add_columns + ["id"]

    @has_access_api
    @expose("show/<pk>")
    def show(self, pk):
        return super().show(pk)


def _get_owner_id(tab_state_id):
    return db.session.query(TabState.user_id).filter_by(id=tab_state_id).scalar()


class TabStateView(BaseSupersetView):
    @has_access_api
    @expose("/", methods=["POST"])
    def post(self):  # pylint: disable=no-self-use
        query_editor = json.loads(request.form["queryEditor"])
        tab_state = TabState(
            user_id=g.user.get_id(),
            label=query_editor.get("title", "Untitled Query"),
            active=True,
            database_id=query_editor["dbId"],
            schema=query_editor.get("schema"),
            sql=query_editor.get("sql", "SELECT ..."),
            query_limit=query_editor.get("queryLimit"),
        )
        (
            db.session.query(TabState)
            .filter_by(user_id=g.user.get_id())
            .update({"active": False})
        )
        db.session.add(tab_state)
        db.session.commit()
        return json_success(json.dumps({"id": tab_state.id}))

    @has_access_api
    @expose("/<int:tab_state_id>", methods=["DELETE"])
    def delete(self, tab_state_id):  # pylint: disable=no-self-use
        if _get_owner_id(tab_state_id) != int(g.user.get_id()):
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
    @expose("/<int:tab_state_id>", methods=["GET"])
    def get(self, tab_state_id):  # pylint: disable=no-self-use
        if _get_owner_id(tab_state_id) != int(g.user.get_id()):
            return Response(status=403)

        tab_state = db.session.query(TabState).filter_by(id=tab_state_id).first()
        if tab_state is None:
            return Response(status=404)
        return json_success(
            json.dumps(tab_state.to_dict(), default=utils.json_iso_dttm_ser)
        )

    @has_access_api
    @expose("<int:tab_state_id>/activate", methods=["POST"])
    def activate(self, tab_state_id):  # pylint: disable=no-self-use
        owner_id = _get_owner_id(tab_state_id)
        if owner_id is None:
            return Response(status=404)
        if owner_id != int(g.user.get_id()):
            return Response(status=403)

        (
            db.session.query(TabState)
            .filter_by(user_id=g.user.get_id())
            .update({"active": TabState.id == tab_state_id})
        )
        db.session.commit()
        return json_success(json.dumps(tab_state_id))

    @has_access_api
    @expose("<int:tab_state_id>", methods=["PUT"])
    def put(self, tab_state_id):  # pylint: disable=no-self-use
        if _get_owner_id(tab_state_id) != int(g.user.get_id()):
            return Response(status=403)

        fields = {k: json.loads(v) for k, v in request.form.to_dict().items()}
        db.session.query(TabState).filter_by(id=tab_state_id).update(fields)
        db.session.commit()
        return json_success(json.dumps(tab_state_id))

    @has_access_api
    @expose("<int:tab_state_id>/migrate_query", methods=["POST"])
    def migrate_query(self, tab_state_id):  # pylint: disable=no-self-use
        if _get_owner_id(tab_state_id) != int(g.user.get_id()):
            return Response(status=403)

        client_id = json.loads(request.form["queryId"])
        db.session.query(Query).filter_by(client_id=client_id).update(
            {"sql_editor_id": tab_state_id}
        )
        db.session.commit()
        return json_success(json.dumps(tab_state_id))

    @has_access_api
    @expose("<int:tab_state_id>/query/<client_id>", methods=["DELETE"])
    def delete_query(self, tab_state_id, client_id):  # pylint: disable=no-self-use
        db.session.query(Query).filter_by(
            client_id=client_id, user_id=g.user.get_id(), sql_editor_id=tab_state_id
        ).delete(synchronize_session=False)
        db.session.commit()
        return json_success(json.dumps("OK"))


class TableSchemaView(BaseSupersetView):
    @has_access_api
    @expose("/", methods=["POST"])
    def post(self):  # pylint: disable=no-self-use
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
    @expose("/<int:table_schema_id>", methods=["DELETE"])
    def delete(self, table_schema_id):  # pylint: disable=no-self-use
        db.session.query(TableSchema).filter(TableSchema.id == table_schema_id).delete(
            synchronize_session=False
        )
        db.session.commit()
        return json_success(json.dumps("OK"))

    @has_access_api
    @expose("/<int:table_schema_id>/expanded", methods=["POST"])
    def expanded(self, table_schema_id):  # pylint: disable=no-self-use
        payload = json.loads(request.form["expanded"])
        (
            db.session.query(TableSchema)
            .filter_by(id=table_schema_id)
            .update({"expanded": payload})
        )
        db.session.commit()
        response = json.dumps({"id": table_schema_id, "expanded": payload})
        return json_success(response)


class SqlLab(BaseSupersetView):
    """The base views for Superset!"""

    @expose("/my_queries/")
    @has_access
    def my_queries(self):  # pylint: disable=no-self-use
        """Assigns a list of found users to the given role."""
        return redirect("/savedqueryview/list/?_flt_0_user={}".format(g.user.id))
