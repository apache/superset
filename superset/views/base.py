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
# pylint: disable=C,R,W
from datetime import datetime
import functools
import logging
import traceback
from typing import Any, Dict

from flask import abort, flash, g, get_flashed_messages, redirect, Response
from flask_appbuilder import BaseView, ModelView
from flask_appbuilder.actions import action
from flask_appbuilder.forms import DynamicForm
from flask_appbuilder.models.sqla.filters import BaseFilter
from flask_appbuilder.widgets import ListWidget
from flask_babel import get_locale
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
from flask_wtf.form import FlaskForm
import simplejson as json
from wtforms.fields.core import Field, UnboundField
import yaml

from superset import conf, db, get_feature_flags, security_manager
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
        if stacktrace and conf.get("SHOW_STACKTRACE"):
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
        except Exception as e:
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
                stacktrace=traceback.format_exc(),
                link=e.link,
            )
        except SupersetException as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc(),
                status=e.status,
            )
        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e), stacktrace=traceback.format_exc()
            )

    return functools.update_wrapper(wraps, f)


def get_datasource_exist_error_msg(full_name):
    return __("Datasource %(name)s already exists", name=full_name)


def get_user_roles():
    if g.user.is_anonymous:
        public_role = conf.get("AUTH_ROLE_PUBLIC")
        return [security_manager.find_role(public_role)] if public_role else []
    return g.user.roles


class BaseSupersetView(BaseView):
    def json_response(self, obj, status=200):
        return Response(
            json.dumps(obj, default=utils.json_int_dttm_ser, ignore_nan=True),
            status=status,
            mimetype="application/json",
        )

    def common_bootstrap_payload(self):
        """Common data always sent to the client"""
        messages = get_flashed_messages(with_categories=True)
        locale = str(get_locale())
        return {
            "flash_messages": messages,
            "conf": {k: conf.get(k) for k in FRONTEND_CONF_KEYS},
            "locale": locale,
            "language_pack": get_language_pack(locale),
            "feature_flags": get_feature_flags(),
        }


class SupersetListWidget(ListWidget):
    template = "superset/fab_overrides/list.html"


class SupersetModelView(ModelView):
    page_size = 100
    list_widget = SupersetListWidget


class ListWidgetWithCheckboxes(ListWidget):
    """An alternative to list view that renders Boolean fields as checkboxes

    Works in conjunction with the `checkbox` view."""

    template = "superset/fab_overrides/list_with_checkboxes.html"


def validate_json(form, field):  # noqa
    try:
        json.loads(field.data)
    except Exception as e:
        logging.exception(e)
        raise Exception(_("json isn't valid"))


class YamlExportMixin(object):
    @action("yaml_export", __("Export to YAML"), __("Export to YAML?"), "fa-download")
    def yaml_export(self, items):
        if not isinstance(items, list):
            items = [items]

        data = [t.export_to_dict() for t in items]
        return Response(
            yaml.safe_dump(data),
            headers=generate_download_headers("yaml"),
            mimetype="application/text",
        )


class DeleteMixin(object):
    def _delete(self, pk):
        """
            Delete function logic, override to implement diferent logic
            deletes the record with primary_key = pk

            :param pk:
                record primary key to delete
        """
        item = self.datamodel.get(pk, self._base_filters)
        if not item:
            abort(404)
        try:
            self.pre_delete(item)
        except Exception as e:
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

            schema_view_menu = None
            if hasattr(item, "schema_perm"):
                schema_view_menu = security_manager.find_view_menu(item.schema_perm)

                pvs.extend(
                    security_manager.get_session.query(
                        security_manager.permissionview_model
                    )
                    .filter_by(view_menu=schema_view_menu)
                    .all()
                )

            if self.datamodel.delete(item):
                self.post_delete(item)

                for pv in pvs:
                    security_manager.get_session.delete(pv)

                if view_menu:
                    security_manager.get_session.delete(view_menu)

                if schema_view_menu:
                    security_manager.get_session.delete(schema_view_menu)

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
            except Exception as e:
                flash(str(e), "danger")
            else:
                self._delete(item.id)
        self.update_redirect()
        return redirect(self.get_redirect())


class SupersetFilter(BaseFilter):

    """Add utility function to make BaseFilter easy and fast

    These utility function exist in the SecurityManager, but would do
    a database round trip at every check. Here we cache the role objects
    to be able to make multiple checks but query the db only once
    """

    def get_user_roles(self):
        return get_user_roles()

    def get_all_permissions(self):
        """Returns a set of tuples with the perm name and view menu name"""
        perms = set()
        for role in self.get_user_roles():
            for perm_view in role.permissions:
                t = (perm_view.permission.name, perm_view.view_menu.name)
                perms.add(t)
        return perms

    def has_role(self, role_name_or_list):
        """Whether the user has this role name"""
        if not isinstance(role_name_or_list, list):
            role_name_or_list = [role_name_or_list]
        return any([r.name in role_name_or_list for r in self.get_user_roles()])

    def has_perm(self, permission_name, view_menu_name):
        """Whether the user has this perm"""
        return (permission_name, view_menu_name) in self.get_all_permissions()

    def get_view_menus(self, permission_name):
        """Returns the details of view_menus for a perm name"""
        vm = set()
        for perm_name, vm_name in self.get_all_permissions():
            if perm_name == permission_name:
                vm.add(vm_name)
        return vm


class DatasourceFilter(SupersetFilter):
    def apply(self, query, func):  # noqa
        if security_manager.all_datasource_access():
            return query
        perms = self.get_view_menus("datasource_access")
        # TODO(bogdan): add `schema_access` support here
        return query.filter(self.model.perm.in_(perms))


class CsvResponse(Response):
    """
    Override Response to take into account csv encoding from config.py
    """

    charset = conf.get("CSV_EXPORT").get("encoding", "utf-8")


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
    session = db.create_scoped_session()
    orig_obj = session.query(obj.__class__).filter_by(id=obj.id).first()

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
    self, form: DynamicForm, unbound_field: UnboundField, options: Dict[Any, Any]
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
