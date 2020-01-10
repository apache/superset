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
import functools
import logging
import traceback
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

import simplejson as json
import yaml
from flask import abort, flash, g, get_flashed_messages, redirect, Response, session
from flask_appbuilder import BaseView, Model, ModelRestApi, ModelView
from flask_appbuilder.actions import action
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.forms import DynamicForm
from flask_appbuilder.models.filters import Filters
from flask_appbuilder.models.sqla.filters import BaseFilter
from flask_appbuilder.widgets import ListWidget
from flask_babel import get_locale, gettext as __, lazy_gettext as _
from flask_wtf.form import FlaskForm
from marshmallow import Schema
from sqlalchemy import or_
from werkzeug.exceptions import HTTPException
from wtforms.fields.core import Field, UnboundField

from superset import appbuilder, conf, db, get_feature_flags, security_manager
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.translations.utils import get_language_pack
from superset.utils import core as utils

FRONTEND_CONF_KEYS = (
    "SUPERSET_WEBSERVER_TIMEOUT",
    "SUPERSET_DASHBOARD_POSITION_DATA_LIMIT",
    "ENABLE_JAVASCRIPT_CONTROLS",
    "DEFAULT_SQLLAB_LIMIT",
    "SQL_MAX_ROW",
    "SUPERSET_WEBSERVER_DOMAINS",
    "SQLLAB_SAVE_WARNING_MESSAGE",
    "DISPLAY_MAX_ROW",
)


def get_error_msg():
    if conf.get("SHOW_STACKTRACE"):
        error_msg = traceback.format_exc()
    else:
        error_msg = "FATAL ERROR \n"
        error_msg += (
            "Stacktrace is hidden. Change the SHOW_STACKTRACE "
            "configuration setting to enable it"
        )
    return error_msg


def json_error_response(msg=None, status=500, stacktrace=None, payload=None, link=None):
    if not payload:
        payload = {"error": "{}".format(msg)}
    if not stacktrace:
        stacktrace = utils.get_stacktrace()
    payload["stacktrace"] = stacktrace
    if link:
        payload["link"] = link

    return Response(
        json.dumps(payload, default=utils.json_iso_dttm_ser, ignore_nan=True),
        status=status,
        mimetype="application/json",
    )


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype="application/json")


def data_payload_response(payload_json, has_error=False):
    status = 400 if has_error else 200
    return json_success(payload_json, status=status)


def generate_download_headers(extension, filename=None):
    filename = filename if filename else datetime.now().strftime("%Y%m%d_%H%M%S")
    content_disp = "attachment; filename={}.{}".format(filename, extension)
    headers = {"Content-Disposition": content_disp}
    return headers


def api(f):
    """
    A decorator to label an endpoint as an API. Catches uncaught exceptions and
    return the response in the JSON format
    """

    def wraps(self, *args, **kwargs):
        try:
            return f(self, *args, **kwargs)
        except Exception as e:  # pylint: disable=broad-except
            logging.exception(e)
            return json_error_response(get_error_msg())

    return functools.update_wrapper(wraps, f)


def handle_api_exception(f):
    """
    A decorator to catch superset exceptions. Use it after the @api decorator above
    so superset exception handler is triggered before the handler for generic
    exceptions.
    """

    def wraps(self, *args, **kwargs):
        try:
            return f(self, *args, **kwargs)
        except SupersetSecurityException as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                status=e.status,
                stacktrace=utils.get_stacktrace(),
                link=e.link,
            )
        except SupersetException as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=utils.get_stacktrace(),
                status=e.status,
            )
        except HTTPException as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc(),
                status=e.code,
            )
        except Exception as e:  # pylint: disable=broad-except
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e), stacktrace=utils.get_stacktrace()
            )

    return functools.update_wrapper(wraps, f)


def check_ownership_and_item_exists(f):
    """
    A Decorator that checks if an object exists and is owned by the current user
    """

    def wraps(self, pk):  # pylint: disable=invalid-name
        item = self.datamodel.get(
            pk, self._base_filters  # pylint: disable=protected-access
        )
        if not item:
            return self.response_404()
        try:
            check_ownership(item)
        except SupersetSecurityException as e:
            return self.response(403, message=str(e))
        return f(self, item)

    return functools.update_wrapper(wraps, f)


def get_datasource_exist_error_msg(full_name):
    return __("Datasource %(name)s already exists", name=full_name)


def get_user_roles():
    if g.user.is_anonymous:
        public_role = conf.get("AUTH_ROLE_PUBLIC")
        return [security_manager.find_role(public_role)] if public_role else []
    return g.user.roles


class BaseSupersetView(BaseView):
    @staticmethod
    def json_response(obj, status=200) -> Response:  # pylint: disable=no-self-use
        return Response(
            json.dumps(obj, default=utils.json_int_dttm_ser, ignore_nan=True),
            status=status,
            mimetype="application/json",
        )


def menu_data():
    menu = appbuilder.menu.get_data()
    root_path = "#"
    logo_target_path = ""
    if not g.user.is_anonymous:
        try:
            logo_target_path = (
                appbuilder.app.config.get("LOGO_TARGET_PATH")
                or f"/profile/{g.user.username}/"
            )
        # when user object has no username
        except NameError as e:
            logging.exception(e)

        if logo_target_path.startswith("/"):
            root_path = f"/superset{logo_target_path}"
        else:
            root_path = logo_target_path

    languages = {}
    for lang in appbuilder.languages:
        languages[lang] = {
            **appbuilder.languages[lang],
            "url": appbuilder.get_url_for_locale(lang),
        }
    return {
        "menu": menu,
        "brand": {
            "path": root_path,
            "icon": appbuilder.app_icon,
            "alt": appbuilder.app_name,
        },
        "navbar_right": {
            "bug_report_url": appbuilder.app.config.get("BUG_REPORT_URL"),
            "documentation_url": appbuilder.app.config.get("DOCUMENTATION_URL"),
            "version_string": appbuilder.app.config.get("VERSION_STRING"),
            "version_sha": appbuilder.app.config.get("VERSION_SHA"),
            "languages": languages,
            "show_language_picker": len(languages.keys()) > 1,
            "user_is_anonymous": g.user.is_anonymous,
            "user_info_url": appbuilder.get_url_for_userinfo,
            "user_logout_url": appbuilder.get_url_for_logout,
            "user_login_url": appbuilder.get_url_for_login,
            "locale": session.get("locale", "en"),
        },
    }


def common_bootstrap_payload():
    """Common data always sent to the client"""
    messages = get_flashed_messages(with_categories=True)
    locale = str(get_locale())

    return {
        "flash_messages": messages,
        "conf": {k: conf.get(k) for k in FRONTEND_CONF_KEYS},
        "locale": locale,
        "language_pack": get_language_pack(locale),
        "feature_flags": get_feature_flags(),
        "menu_data": menu_data(),
    }


class SupersetListWidget(ListWidget):  # pylint: disable=too-few-public-methods
    template = "superset/fab_overrides/list.html"


class SupersetModelView(ModelView):
    page_size = 100
    list_widget = SupersetListWidget


class ListWidgetWithCheckboxes(ListWidget):  # pylint: disable=too-few-public-methods
    """An alternative to list view that renders Boolean fields as checkboxes

    Works in conjunction with the `checkbox` view."""

    template = "superset/fab_overrides/list_with_checkboxes.html"


def validate_json(_form, field):
    try:
        json.loads(field.data)
    except Exception as e:
        logging.exception(e)
        raise Exception(_("json isn't valid"))


class YamlExportMixin:  # pylint: disable=too-few-public-methods
    """
    Override this if you want a dict response instead, with a certain key.
    Used on DatabaseView for cli compatibility
    """

    yaml_dict_key: Optional[str] = None

    @action("yaml_export", __("Export to YAML"), __("Export to YAML?"), "fa-download")
    def yaml_export(self, items):
        if not isinstance(items, list):
            items = [items]

        data = [t.export_to_dict() for t in items]
        if self.yaml_dict_key:
            data = {self.yaml_dict_key: data}
        return Response(
            yaml.safe_dump(data),
            headers=generate_download_headers("yaml"),
            mimetype="application/text",
        )


class DeleteMixin:  # pylint: disable=too-few-public-methods
    def _delete(self, primary_key):
        """
            Delete function logic, override to implement diferent logic
            deletes the record with primary_key = primary_key

            :param primary_key:
                record primary key to delete
        """
        item = self.datamodel.get(primary_key, self._base_filters)
        if not item:
            abort(404)
        try:
            self.pre_delete(item)
        except Exception as e:  # pylint: disable=broad-except
            flash(str(e), "danger")
        else:
            view_menu = security_manager.find_view_menu(item.get_perm())
            pvs = (
                security_manager.get_session.query(
                    security_manager.permissionview_model
                )
                .filter_by(view_menu=view_menu)
                .all()
            )

            if self.datamodel.delete(item):
                self.post_delete(item)

                for pv in pvs:
                    security_manager.get_session.delete(pv)

                if view_menu:
                    security_manager.get_session.delete(view_menu)

                security_manager.get_session.commit()

            flash(*self.datamodel.message)
            self.update_redirect()

    @action(
        "muldelete", __("Delete"), __("Delete all Really?"), "fa-trash", single=False
    )
    def muldelete(self, items):
        if not items:
            abort(404)
        for item in items:
            try:
                self.pre_delete(item)
            except Exception as e:  # pylint: disable=broad-except
                flash(str(e), "danger")
            else:
                self._delete(item.id)
        self.update_redirect()
        return redirect(self.get_redirect())


class DatasourceFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    def apply(self, query, value):
        if security_manager.all_datasource_access():
            return query
        datasource_perms = security_manager.user_view_menu_names("datasource_access")
        schema_perms = security_manager.user_view_menu_names("schema_access")
        return query.filter(
            or_(
                self.model.perm.in_(datasource_perms),
                self.model.schema_perm.in_(schema_perms),
            )
        )


class BaseSupersetSchema(Schema):
    """
    Extends Marshmallow schema so that we can pass a Model to load
    (following marshamallow-sqlalchemy pattern). This is useful
    to perform partial model merges on HTTP PUT
    """

    def __init__(self, **kwargs):
        self.instance = None
        super().__init__(**kwargs)

    def load(
        self, data, many=None, partial=None, instance: Model = None, **kwargs
    ):  # pylint: disable=arguments-differ
        self.instance = instance
        return super().load(data, many=many, partial=partial, **kwargs)


get_related_schema = {
    "type": "object",
    "properties": {
        "page_size": {"type": "integer"},
        "page": {"type": "integer"},
        "filter": {"type": "string"},
    },
}


class BaseSupersetModelRestApi(ModelRestApi):
    """
    Extends FAB's ModelResApi to implement specific superset generic functionality
    """

    order_rel_fields: Dict[str, Tuple[str, str]] = {}
    """
    Impose ordering on related fields query::

        order_rel_fields = {
            "<RELATED_FIELD>": ("<RELATED_FIELD_FIELD>", "<asc|desc>"),
             ...
        }
    """  # pylint: disable=pointless-string-statement
    filter_rel_fields_field: Dict[str, str] = {}
    """
    Declare the related field field for filtering::

        filter_rel_fields_field = {
            "<RELATED_FIELD>": "<RELATED_FIELD_FIELD>", "<asc|desc>")
        }
    """  # pylint: disable=pointless-string-statement

    def _get_related_filter(self, datamodel, column_name: str, value: str) -> Filters:
        filter_field = self.filter_rel_fields_field.get(column_name)
        filters = datamodel.get_filters([filter_field])
        if value:
            filters.rest_add_filters(
                [{"opr": "sw", "col": filter_field, "value": value}]
            )
        return filters

    @expose("/related/<column_name>", methods=["GET"])
    @protect()
    @safe
    @rison(get_related_schema)
    def related(self, column_name: str, **kwargs):
        """Get related fields data
        ---
        get:
          parameters:
          - in: path
            schema:
              type: string
            name: column_name
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    page_size:
                      type: integer
                    page:
                      type: integer
                    filter:
                      type: string
          responses:
            200:
              description: Related column data
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        type: integer
                      result:
                        type: object
                        properties:
                          value:
                            type: integer
                          text:
                            type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        args = kwargs.get("rison", {})
        # handle pagination
        page, page_size = self._handle_page_args(args)
        try:
            datamodel = self.datamodel.get_related_interface(column_name)
        except KeyError:
            return self.response_404()
        page, page_size = self._sanitize_page_args(page, page_size)
        # handle ordering
        order_field = self.order_rel_fields.get(column_name)
        if order_field:
            order_column, order_direction = order_field
        else:
            order_column, order_direction = "", ""
        # handle filters
        filters = self._get_related_filter(datamodel, column_name, args.get("filter"))
        # Make the query
        count, values = datamodel.query(
            filters, order_column, order_direction, page=page, page_size=page_size
        )
        # produce response
        result = [
            {"value": datamodel.get_pk_value(value), "text": str(value)}
            for value in values
        ]
        return self.response(200, count=count, result=result)


class CsvResponse(Response):  # pylint: disable=too-many-ancestors
    """
    Override Response to take into account csv encoding from config.py
    """

    charset = conf["CSV_EXPORT"].get("encoding", "utf-8")


def check_ownership(obj, raise_if_false=True):
    """Meant to be used in `pre_update` hooks on models to enforce ownership

    Admin have all access, and other users need to be referenced on either
    the created_by field that comes with the ``AuditMixin``, or in a field
    named ``owners`` which is expected to be a one-to-many with the User
    model. It is meant to be used in the ModelView's pre_update hook in
    which raising will abort the update.
    """
    if not obj:
        return False

    security_exception = SupersetSecurityException(
        "You don't have the rights to alter [{}]".format(obj)
    )

    if g.user.is_anonymous:
        if raise_if_false:
            raise security_exception
        return False
    roles = [r.name for r in get_user_roles()]
    if "Admin" in roles:
        return True
    scoped_session = db.create_scoped_session()
    orig_obj = scoped_session.query(obj.__class__).filter_by(id=obj.id).first()

    # Making a list of owners that works across ORM models
    owners = []
    if hasattr(orig_obj, "owners"):
        owners += orig_obj.owners
    if hasattr(orig_obj, "owner"):
        owners += [orig_obj.owner]
    if hasattr(orig_obj, "created_by"):
        owners += [orig_obj.created_by]

    owner_names = [o.username for o in owners if o]

    if g.user and hasattr(g.user, "username") and g.user.username in owner_names:
        return True
    if raise_if_false:
        raise security_exception
    else:
        return False


def bind_field(
    _, form: DynamicForm, unbound_field: UnboundField, options: Dict[Any, Any]
) -> Field:
    """
    Customize how fields are bound by stripping all whitespace.

    :param form: The form
    :param unbound_field: The unbound field
    :param options: The field options
    :returns: The bound field
    """

    filters = unbound_field.kwargs.get("filters", [])
    filters.append(lambda x: x.strip() if isinstance(x, str) else x)
    return unbound_field.bind(form=form, filters=filters, **options)


FlaskForm.Meta.bind_field = bind_field
