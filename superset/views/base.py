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
from __future__ import annotations

import functools
import logging
import os
import traceback
from datetime import datetime
from typing import Any, Callable

import yaml
from babel import Locale
from flask import (
    abort,
    flash,
    g,
    get_flashed_messages,
    redirect,
    Response,
    session,
)
from flask_appbuilder import BaseView, expose, Model, ModelView
from flask_appbuilder.actions import action
from flask_appbuilder.baseviews import expose_api
from flask_appbuilder.forms import DynamicForm
from flask_appbuilder.models.sqla.filters import BaseFilter
from flask_appbuilder.security.decorators import (
    has_access,
    has_access_api,
    permission_name,
)
from flask_appbuilder.security.sqla.models import User
from flask_appbuilder.widgets import ListWidget
from flask_babel import get_locale, gettext as __
from flask_jwt_extended.exceptions import NoAuthorizationError
from flask_wtf.form import FlaskForm
from sqlalchemy.orm import Query
from wtforms.fields.core import Field, UnboundField

from superset import (
    app as superset_app,
    appbuilder,
    conf,
    db,
    get_feature_flags,
    is_feature_enabled,
    security_manager,
)
from superset.connectors.sqla import models
from superset.db_engine_specs import get_available_engine_specs
from superset.db_engine_specs.gsheets import GSheetsEngineSpec
from superset.extensions import cache_manager
from superset.models.helpers import ImportExportMixin
from superset.reports.models import ReportRecipientType
from superset.superset_typing import FlaskResponse
from superset.translations.utils import get_language_pack
from superset.utils import core as utils, json
from superset.utils.filters import get_dataset_access_filters
from superset.views.error_handling import json_error_response

from .utils import bootstrap_user_data

FRONTEND_CONF_KEYS = (
    "SUPERSET_WEBSERVER_TIMEOUT",
    "SUPERSET_DASHBOARD_POSITION_DATA_LIMIT",
    "SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT",
    "SUPERSET_DASHBOARD_PERIODICAL_REFRESH_WARNING_MESSAGE",
    "ENABLE_JAVASCRIPT_CONTROLS",
    "DEFAULT_SQLLAB_LIMIT",
    "DEFAULT_VIZ_TYPE",
    "SQL_MAX_ROW",
    "SUPERSET_WEBSERVER_DOMAINS",
    "SQLLAB_SAVE_WARNING_MESSAGE",
    "SQLLAB_DEFAULT_DBID",
    "DISPLAY_MAX_ROW",
    "GLOBAL_ASYNC_QUERIES_TRANSPORT",
    "GLOBAL_ASYNC_QUERIES_POLLING_DELAY",
    "SQL_VALIDATORS_BY_ENGINE",
    "SQLALCHEMY_DOCS_URL",
    "SQLALCHEMY_DISPLAY_TEXT",
    "GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL",
    "DASHBOARD_AUTO_REFRESH_MODE",
    "DASHBOARD_AUTO_REFRESH_INTERVALS",
    "DASHBOARD_VIRTUALIZATION",
    "SCHEDULED_QUERIES",
    "EXCEL_EXTENSIONS",
    "CSV_EXTENSIONS",
    "COLUMNAR_EXTENSIONS",
    "ALLOWED_EXTENSIONS",
    "SAMPLES_ROW_LIMIT",
    "DEFAULT_TIME_FILTER",
    "HTML_SANITIZATION",
    "HTML_SANITIZATION_SCHEMA_EXTENSIONS",
    "WELCOME_PAGE_LAST_TAB",
    "VIZ_TYPE_DENYLIST",
    "ALERT_REPORTS_DEFAULT_CRON_VALUE",
    "ALERT_REPORTS_DEFAULT_RETENTION",
    "ALERT_REPORTS_DEFAULT_WORKING_TIMEOUT",
    "NATIVE_FILTER_DEFAULT_ROW_LIMIT",
    "PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET",
    "JWT_ACCESS_CSRF_COOKIE_NAME",
    "SQLLAB_QUERY_RESULT_TIMEOUT",
)

logger = logging.getLogger(__name__)
config = superset_app.config


def get_error_msg() -> str:
    if conf.get("SHOW_STACKTRACE"):
        error_msg = traceback.format_exc()
    else:
        error_msg = "FATAL ERROR \n"
        error_msg += (
            "Stacktrace is hidden. Change the SHOW_STACKTRACE "
            "configuration setting to enable it"
        )
    return error_msg


def json_success(json_msg: str, status: int = 200) -> FlaskResponse:
    return Response(json_msg, status=status, mimetype="application/json")


def data_payload_response(payload_json: str, has_error: bool = False) -> FlaskResponse:
    status = 400 if has_error else 200
    return json_success(payload_json, status=status)


def generate_download_headers(
    extension: str, filename: str | None = None
) -> dict[str, Any]:
    filename = filename if filename else datetime.now().strftime("%Y%m%d_%H%M%S")
    content_disp = f"attachment; filename={filename}.{extension}"
    headers = {"Content-Disposition": content_disp}
    return headers


def deprecated(
    eol_version: str = "5.0.0",
    new_target: str | None = None,
) -> Callable[[Callable[..., FlaskResponse]], Callable[..., FlaskResponse]]:
    """
    A decorator to set an API endpoint from SupersetView has deprecated.
    Issues a log warning
    """

    def _deprecated(f: Callable[..., FlaskResponse]) -> Callable[..., FlaskResponse]:
        def wraps(self: BaseSupersetView, *args: Any, **kwargs: Any) -> FlaskResponse:
            message = (
                "%s.%s "
                "This API endpoint is deprecated and will be removed in version %s"
            )
            logger_args = [
                self.__class__.__name__,
                f.__name__,
                eol_version,
            ]
            if new_target:
                message += " . Use the following API endpoint instead: %s"
                logger_args.append(new_target)
            logger.warning(message, *logger_args)
            return f(self, *args, **kwargs)

        return functools.update_wrapper(wraps, f)

    return _deprecated


def api(f: Callable[..., FlaskResponse]) -> Callable[..., FlaskResponse]:
    """
    A decorator to label an endpoint as an API. Catches uncaught exceptions and
    return the response in the JSON format
    """

    def wraps(self: BaseSupersetView, *args: Any, **kwargs: Any) -> FlaskResponse:
        try:
            return f(self, *args, **kwargs)
        except NoAuthorizationError:
            logger.warning("Api failed- no authorization", exc_info=True)
            return json_error_response(get_error_msg(), status=401)
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception(ex)
            return json_error_response(get_error_msg())

    return functools.update_wrapper(wraps, f)


class BaseSupersetView(BaseView):
    @staticmethod
    def json_response(obj: Any, status: int = 200) -> FlaskResponse:
        return Response(
            json.dumps(obj, default=json.json_int_dttm_ser, ignore_nan=True),
            status=status,
            mimetype="application/json",
        )

    def render_app_template(
        self, extra_bootstrap_data: dict[str, Any] | None = None
    ) -> FlaskResponse:
        payload = {
            "user": bootstrap_user_data(g.user, include_perms=True),
            "common": common_bootstrap_payload(),
            **(extra_bootstrap_data or {}),
        }
        return self.render_template(
            "superset/spa.html",
            entry="spa",
            bootstrap_data=json.dumps(
                payload, default=json.pessimistic_json_iso_dttm_ser
            ),
        )


def get_environment_tag() -> dict[str, Any]:
    # Whether flask is in debug mode (--debug)
    debug = appbuilder.app.config["DEBUG"]

    # Getting the configuration option for ENVIRONMENT_TAG_CONFIG
    env_tag_config = appbuilder.app.config["ENVIRONMENT_TAG_CONFIG"]

    # These are the predefined templates define in the config
    env_tag_templates = env_tag_config.get("values")

    # This is the environment variable name from which to select the template
    # default is SUPERSET_ENV (from FLASK_ENV in previous versions)
    env_envvar = env_tag_config.get("variable")

    # this is the actual name we want to use
    env_name = os.environ.get(env_envvar)

    if not env_name or env_name not in env_tag_templates.keys():
        env_name = "debug" if debug else None

    env_tag = env_tag_templates.get(env_name)
    return env_tag or {}


def menu_data(user: User) -> dict[str, Any]:
    languages = {
        lang: {**appbuilder.languages[lang], "url": appbuilder.get_url_for_locale(lang)}
        for lang in appbuilder.languages
    }

    if callable(brand_text := appbuilder.app.config["LOGO_RIGHT_TEXT"]):
        brand_text = brand_text()

    return {
        "menu": appbuilder.menu.get_data(),
        "brand": {
            "path": appbuilder.app.config["LOGO_TARGET_PATH"] or "/superset/welcome/",
            "icon": appbuilder.app_icon,
            "alt": appbuilder.app_name,
            "tooltip": appbuilder.app.config["LOGO_TOOLTIP"],
            "text": brand_text,
        },
        "environment_tag": get_environment_tag(),
        "navbar_right": {
            # show the watermark if the default app icon has been overridden
            "show_watermark": ("superset-logo-horiz" not in appbuilder.app_icon),
            "bug_report_url": appbuilder.app.config["BUG_REPORT_URL"],
            "bug_report_icon": appbuilder.app.config["BUG_REPORT_ICON"],
            "bug_report_text": appbuilder.app.config["BUG_REPORT_TEXT"],
            "documentation_url": appbuilder.app.config["DOCUMENTATION_URL"],
            "documentation_icon": appbuilder.app.config["DOCUMENTATION_ICON"],
            "documentation_text": appbuilder.app.config["DOCUMENTATION_TEXT"],
            "version_string": appbuilder.app.config["VERSION_STRING"],
            "version_sha": appbuilder.app.config["VERSION_SHA"],
            "build_number": appbuilder.app.config["BUILD_NUMBER"],
            "languages": languages,
            "show_language_picker": len(languages) > 1,
            "user_is_anonymous": user.is_anonymous,
            "user_info_url": (
                None
                if is_feature_enabled("MENU_HIDE_USER_INFO")
                else appbuilder.get_url_for_userinfo
            ),
            "user_logout_url": appbuilder.get_url_for_logout,
            "user_login_url": appbuilder.get_url_for_login,
            "locale": session.get("locale", "en"),
        },
    }


@cache_manager.cache.memoize(timeout=60)
def cached_common_bootstrap_data(  # pylint: disable=unused-argument
    user_id: int | None, locale: Locale | None
) -> dict[str, Any]:
    """Common data always sent to the client

    The function is memoized as the return value only changes when user permissions
    or configuration values change.
    """

    # should not expose API TOKEN to frontend
    frontend_config = {
        k: (list(conf.get(k)) if isinstance(conf.get(k), set) else conf.get(k))
        for k in FRONTEND_CONF_KEYS
    }

    if conf.get("SLACK_API_TOKEN"):
        frontend_config["ALERT_REPORTS_NOTIFICATION_METHODS"] = [
            ReportRecipientType.EMAIL,
            ReportRecipientType.SLACK,
            ReportRecipientType.SLACKV2,
        ]
    else:
        frontend_config["ALERT_REPORTS_NOTIFICATION_METHODS"] = [
            ReportRecipientType.EMAIL,
        ]

    # verify client has google sheets installed
    available_specs = get_available_engine_specs()
    frontend_config["HAS_GSHEETS_INSTALLED"] = bool(available_specs[GSheetsEngineSpec])

    language = locale.language if locale else "en"

    bootstrap_data = {
        "conf": frontend_config,
        "locale": language,
        "language_pack": get_language_pack(language),
        "d3_format": conf.get("D3_FORMAT"),
        "d3_time_format": conf.get("D3_TIME_FORMAT"),
        "currencies": conf.get("CURRENCIES"),
        "feature_flags": get_feature_flags(),
        "extra_sequential_color_schemes": conf["EXTRA_SEQUENTIAL_COLOR_SCHEMES"],
        "extra_categorical_color_schemes": conf["EXTRA_CATEGORICAL_COLOR_SCHEMES"],
        "theme_overrides": conf["THEME_OVERRIDES"],
        "menu_data": menu_data(g.user),
    }
    bootstrap_data.update(conf["COMMON_BOOTSTRAP_OVERRIDES_FUNC"](bootstrap_data))
    return bootstrap_data


def common_bootstrap_payload() -> dict[str, Any]:
    return {
        **cached_common_bootstrap_data(utils.get_user_id(), get_locale()),
        "flash_messages": get_flashed_messages(with_categories=True),
    }


@superset_app.context_processor
def get_common_bootstrap_data() -> dict[str, Any]:
    def serialize_bootstrap_data() -> str:
        return json.dumps(
            {"common": common_bootstrap_payload()},
            default=json.pessimistic_json_iso_dttm_ser,
        )

    return {"bootstrap_data": serialize_bootstrap_data}


class SupersetListWidget(ListWidget):  # pylint: disable=too-few-public-methods
    template = "superset/fab_overrides/list.html"


class DeprecateModelViewMixin:
    @expose("/add", methods=["GET", "POST"])
    @has_access
    @deprecated(eol_version="5.0.0")
    def add(self) -> FlaskResponse:
        return super().add()  # type: ignore

    @expose("/show/<pk>", methods=["GET"])
    @has_access
    @deprecated(eol_version="5.0.0")
    def show(self, pk: int) -> FlaskResponse:
        return super().show(pk)  # type: ignore

    @expose("/edit/<pk>", methods=["GET", "POST"])
    @has_access
    @deprecated(eol_version="5.0.0")
    def edit(self, pk: int) -> FlaskResponse:
        return super().edit(pk)  # type: ignore

    @expose("/delete/<pk>", methods=["GET", "POST"])
    @has_access
    @deprecated(eol_version="5.0.0")
    def delete(self, pk: int) -> FlaskResponse:
        return super().delete(pk)  # type: ignore

    @expose_api(name="read", url="/api/read", methods=["GET"])
    @has_access_api
    @permission_name("list")
    @deprecated(eol_version="5.0.0")
    def api_read(self) -> FlaskResponse:
        return super().api_read()  # type: ignore

    @expose_api(name="get", url="/api/get/<pk>", methods=["GET"])
    @has_access_api
    @permission_name("show")
    def api_get(self, pk: int) -> FlaskResponse:
        return super().api_get(pk)  # type: ignore

    @expose_api(name="create", url="/api/create", methods=["POST"])
    @has_access_api
    @permission_name("add")
    def api_create(self) -> FlaskResponse:
        return super().api_create()  # type: ignore

    @expose_api(name="update", url="/api/update/<pk>", methods=["PUT"])
    @has_access_api
    @permission_name("write")
    @deprecated(eol_version="5.0.0")
    def api_update(self, pk: int) -> FlaskResponse:
        return super().api_update(pk)  # type: ignore

    @expose_api(name="delete", url="/api/delete/<pk>", methods=["DELETE"])
    @has_access_api
    @permission_name("delete")
    @deprecated(eol_version="5.0.0")
    def api_delete(self, pk: int) -> FlaskResponse:
        return super().delete(pk)  # type: ignore


class SupersetModelView(ModelView):
    page_size = 100
    list_widget = SupersetListWidget

    def render_app_template(self) -> FlaskResponse:
        payload = {
            "user": bootstrap_user_data(g.user, include_perms=True),
            "common": common_bootstrap_payload(),
        }
        return self.render_template(
            "superset/spa.html",
            entry="spa",
            bootstrap_data=json.dumps(
                payload, default=json.pessimistic_json_iso_dttm_ser
            ),
        )


class ListWidgetWithCheckboxes(ListWidget):  # pylint: disable=too-few-public-methods
    """An alternative to list view that renders Boolean fields as checkboxes

    Works in conjunction with the `checkbox` view."""

    template = "superset/fab_overrides/list_with_checkboxes.html"


class YamlExportMixin:  # pylint: disable=too-few-public-methods
    """
    Override this if you want a dict response instead, with a certain key.
    Used on DatabaseView for cli compatibility
    """

    yaml_dict_key: str | None = None

    @action("yaml_export", __("Export to YAML"), __("Export to YAML?"), "fa-download")
    def yaml_export(
        self, items: ImportExportMixin | list[ImportExportMixin]
    ) -> FlaskResponse:
        if not isinstance(items, list):
            items = [items]

        data = [t.export_to_dict() for t in items]

        return Response(
            yaml.safe_dump({self.yaml_dict_key: data} if self.yaml_dict_key else data),
            headers=generate_download_headers("yaml"),
            mimetype="application/text",
        )


class DeleteMixin:  # pylint: disable=too-few-public-methods
    def _delete(self: BaseView, primary_key: int) -> None:
        """
        Delete function logic, override to implement different logic
        deletes the record with primary_key = primary_key

        :param primary_key:
            record primary key to delete
        """
        item = self.datamodel.get(primary_key, self._base_filters)
        if not item:
            abort(404)
        try:
            self.pre_delete(item)
        except Exception as ex:  # pylint: disable=broad-except
            flash(str(ex), "danger")
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

                db.session.commit()  # pylint: disable=consider-using-transaction

            flash(*self.datamodel.message)
            self.update_redirect()

    @action(
        "muldelete", __("Delete"), __("Delete all Really?"), "fa-trash", single=False
    )
    def muldelete(self: BaseView, items: list[Model]) -> FlaskResponse:
        if not items:
            abort(404)
        for item in items:
            try:
                self.pre_delete(item)
            except Exception as ex:  # pylint: disable=broad-except
                flash(str(ex), "danger")
            else:
                self._delete(item.id)
        self.update_redirect()
        return redirect(self.get_redirect())


class DatasourceFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.can_access_all_datasources():
            return query
        query = query.join(
            models.Database,
            models.Database.id == self.model.database_id,
        )
        return query.filter(get_dataset_access_filters(self.model))


class CsvResponse(Response):
    """
    Override Response to take into account csv encoding from config.py
    """

    charset = conf["CSV_EXPORT"].get("encoding", "utf-8")
    default_mimetype = "text/csv"


class XlsxResponse(Response):
    """
    Override Response to use xlsx mimetype
    """

    charset = "utf-8"
    default_mimetype = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


def bind_field(
    _: Any, form: DynamicForm, unbound_field: UnboundField, options: dict[Any, Any]
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


@superset_app.after_request
def apply_http_headers(response: Response) -> Response:
    """Applies the configuration's http headers to all responses"""

    # HTTP_HEADERS is deprecated, this provides backwards compatibility
    response.headers.extend(
        {**config["OVERRIDE_HTTP_HEADERS"], **config["HTTP_HEADERS"]}
    )

    for k, v in config["DEFAULT_HTTP_HEADERS"].items():
        if k not in response.headers:
            response.headers[k] = v
    return response
