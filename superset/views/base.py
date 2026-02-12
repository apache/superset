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

import copy
import functools
import logging
import os
import traceback
from datetime import datetime
from typing import Any, Callable, cast

from flask import (
    abort,
    current_app as app,
    g,
    redirect,
    Response,
    session,
    url_for,
)
from flask_appbuilder import BaseView, Model, ModelView
from flask_appbuilder.actions import action
from flask_appbuilder.const import AUTH_OAUTH
from flask_appbuilder.forms import DynamicForm
from flask_appbuilder.models.sqla.filters import BaseFilter
from flask_appbuilder.security.sqla.models import User
from babel.core import Locale
from flask_babel import get_locale, gettext as __
from flask_jwt_extended.exceptions import NoAuthorizationError
from flask_wtf.form import FlaskForm
from sqlalchemy.orm import Query
from wtforms.fields.core import Field, UnboundField

from superset import (
    appbuilder,
    db,
    get_feature_flags,
    is_feature_enabled,
    security_manager,
)
from superset.connectors.sqla import models
from superset.daos.theme import ThemeDAO
from superset.db_engine_specs import get_available_engine_specs
from superset.db_engine_specs.gsheets import GSheetsEngineSpec
from superset.extensions import cache_manager
from superset.models.core import Theme as ThemeModel
from superset.reports.models import ReportRecipientType
from superset.superset_typing import FlaskResponse
from superset.themes.types import Theme, ThemeMode
from superset.themes.utils import (
    is_valid_theme,
)
from superset.utils import core as utils, json
from superset.utils.filters import get_dataset_access_filters
from superset.utils.version import get_version_metadata
from superset.views.error_handling import json_error_response

from .utils import bootstrap_user_data, get_config_value

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
    "DASHBOARD_VIRTUALIZATION_DEFER_DATA",
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
    "SUPERSET_CLIENT_RETRY_ATTEMPTS",
    "SUPERSET_CLIENT_RETRY_DELAY",
    "SUPERSET_CLIENT_RETRY_BACKOFF_MULTIPLIER",
    "SUPERSET_CLIENT_RETRY_MAX_DELAY",
    "SUPERSET_CLIENT_RETRY_JITTER_MAX",
    "SUPERSET_CLIENT_RETRY_STATUS_CODES",
    "PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET",
    "JWT_ACCESS_CSRF_COOKIE_NAME",
    "SQLLAB_QUERY_RESULT_TIMEOUT",
    "SYNC_DB_PERMISSIONS_IN_ASYNC_MODE",
    "TABLE_VIZ_MAX_ROW_SERVER",
    "MAPBOX_API_KEY",
    "CSV_STREAMING_ROW_THRESHOLD",
)

logger = logging.getLogger(__name__)


def get_error_msg() -> str:
    if app.config.get("SHOW_STACKTRACE"):
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
        self,
        extra_bootstrap_data: dict[str, Any] | None = None,
        entry: str | None = "spa",
        **template_kwargs: Any,
    ) -> FlaskResponse:
        """
        Render spa.html template with standardized context including spinner logic.

        This centralizes all spa.html rendering to ensure consistent spinner behavior
        and reduce code duplication across view methods.

        Args:
            extra_bootstrap_data: Additional data for frontend bootstrap payload
            entry: Entry point name (spa, explore, embedded)
            **template_kwargs: Additional template variables

        Returns:
            Flask response from render_template
        """
        context = get_spa_template_context(
            entry, extra_bootstrap_data, **template_kwargs
        )
        return self.render_template("superset/spa.html", **context)


def get_environment_tag() -> dict[str, Any]:
    # Whether flask is in debug mode (--debug)
    debug = app.config["DEBUG"]

    # Getting the configuration option for ENVIRONMENT_TAG_CONFIG
    env_tag_config = app.config["ENVIRONMENT_TAG_CONFIG"]

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

    if callable(brand_text := app.config["LOGO_RIGHT_TEXT"]):
        brand_text = brand_text()

    # Get centralized version metadata
    version_metadata = get_version_metadata()

    return {
        "menu": appbuilder.menu.get_data(),
        "brand": {
            "path": app.config["LOGO_TARGET_PATH"] or url_for("Superset.welcome"),
            "icon": appbuilder.app_icon,
            "alt": appbuilder.app_name,
            "tooltip": app.config["LOGO_TOOLTIP"],
            "text": brand_text,
        },
        "environment_tag": get_environment_tag(),
        "navbar_right": {
            # show the watermark if the default app icon has been overridden
            "show_watermark": ("superset-logo-horiz" not in appbuilder.app_icon),
            "bug_report_url": app.config["BUG_REPORT_URL"],
            "bug_report_icon": app.config["BUG_REPORT_ICON"],
            "bug_report_text": app.config["BUG_REPORT_TEXT"],
            "documentation_url": app.config["DOCUMENTATION_URL"],
            "documentation_icon": app.config["DOCUMENTATION_ICON"],
            "documentation_text": app.config["DOCUMENTATION_TEXT"],
            "version_string": version_metadata.get("version_string"),
            "version_sha": version_metadata.get("version_sha"),
            "build_number": version_metadata.get("build_number"),
            "languages": languages,
            "show_language_picker": len(languages) > 1,
            "user_is_anonymous": user.is_anonymous,
            "user_info_url": (
                None if is_feature_enabled("MENU_HIDE_USER_INFO") else "/user_info/"
            ),
            "user_logout_url": appbuilder.get_url_for_logout,
            "user_login_url": appbuilder.get_url_for_login,
            "locale": session.get("locale", "en"),
        },
    }


def _merge_theme_dicts(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    """
    Recursively merge overlay theme dict into base theme dict.
    Arrays and non-dict values are replaced, not merged.
    """
    result = base.copy()
    for key, value in overlay.items():
        if isinstance(result.get(key), dict) and isinstance(value, dict):
            result[key] = _merge_theme_dicts(result[key], value)
        else:
            result[key] = value
    return result


def _load_theme_from_model(
    theme_model: ThemeModel | None,
    fallback_theme: Theme | None,
    theme_type: ThemeMode,
) -> Theme | None:
    """Load and parse theme from database model, merging with config theme as base."""
    if theme_model:
        try:
            db_theme = json.loads(theme_model.json_data)
            if fallback_theme:
                merged = _merge_theme_dicts(dict(fallback_theme), db_theme)
                return cast(Theme, merged)
            return db_theme
        except json.JSONDecodeError:
            logger.error(
                "Invalid JSON in system %s theme %s", theme_type.value, theme_model.id
            )
            return fallback_theme
    return fallback_theme


def _process_theme(theme: Theme | None, theme_type: ThemeMode) -> Theme:
    """Process and validate a theme, returning an empty dict if invalid."""
    if theme is None or theme == {}:
        # When config theme is None or empty, don't provide a custom theme
        # The frontend will use base theme only
        return {}
    elif not is_valid_theme(cast(dict[str, Any], theme)):
        logger.warning(
            "Invalid %s theme configuration: %s, clearing it",
            theme_type.value,
            theme,
        )
        return {}
    return theme or {}


def get_theme_bootstrap_data() -> dict[str, Any]:
    """
    Returns the theme data to be sent to the client.
    """
    # Check if UI theme administration is enabled
    enable_ui_admin = app.config.get("ENABLE_UI_THEME_ADMINISTRATION", False)

    # Get config themes to use as fallback
    config_theme_default = get_config_value("THEME_DEFAULT")
    config_theme_dark = get_config_value("THEME_DARK")

    if enable_ui_admin:
        # Try to load themes from database
        default_theme_model = ThemeDAO.find_system_default()
        dark_theme_model = ThemeDAO.find_system_dark()

        # Parse theme JSON from database models
        default_theme = _load_theme_from_model(
            default_theme_model, config_theme_default, ThemeMode.DEFAULT
        )
        dark_theme = _load_theme_from_model(
            dark_theme_model, config_theme_dark, ThemeMode.DARK
        )
    else:
        # UI theme administration disabled - use config-based themes
        default_theme = config_theme_default
        dark_theme = config_theme_dark

    # Process and validate themes
    default_theme = _process_theme(default_theme, ThemeMode.DEFAULT)
    dark_theme = _process_theme(dark_theme, ThemeMode.DARK)

    return {
        "theme": {
            "default": default_theme,
            "dark": dark_theme,
            "enableUiThemeAdministration": enable_ui_admin,
        }
    }


def get_default_spinner_svg() -> str | None:
    """
    Load and cache the default spinner SVG content from frontend assets.

    Returns:
        str | None: SVG content as string, or None if file not found
    """
    try:
        # Path to frontend source SVG file (used by both frontend and backend)
        svg_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "superset-frontend",
            "packages",
            "superset-ui-core",
            "src",
            "components",
            "assets",
            "images",
            "loading.svg",
        )

        with open(svg_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except (FileNotFoundError, OSError, UnicodeDecodeError) as e:
        logger.warning("Could not load default spinner SVG: %s", e)
        return None


@cache_manager.cache.memoize(timeout=60)
def cached_common_bootstrap_data(  # pylint: disable=unused-argument
    user_id: int | None, locale: str | None
) -> dict[str, Any]:
    """Common data always sent to the client

    The function is memoized as the return value only changes when user permissions
    or configuration values change.
    """

    # should not expose API TOKEN to frontend
    frontend_config = {
        k: (
            list(app.config.get(k))
            if isinstance(app.config.get(k), set)
            else app.config.get(k)
        )
        for k in FRONTEND_CONF_KEYS
    }

    if app.config.get("SLACK_API_TOKEN"):
        frontend_config["ALERT_REPORTS_NOTIFICATION_METHODS"] = [
            ReportRecipientType.EMAIL,
            ReportRecipientType.SLACK,
            ReportRecipientType.SLACKV2,
            ReportRecipientType.WEBHOOK,
        ]
    else:
        frontend_config["ALERT_REPORTS_NOTIFICATION_METHODS"] = [
            ReportRecipientType.EMAIL,
            ReportRecipientType.WEBHOOK,
        ]

    # verify client has google sheets installed
    available_specs = get_available_engine_specs()
    frontend_config["HAS_GSHEETS_INSTALLED"] = (
        GSheetsEngineSpec in available_specs
        and bool(available_specs[GSheetsEngineSpec])
    )

    if isinstance(locale, Locale):
        language = locale.language
    elif isinstance(locale, str):
        language = locale.split("_")[0]
    else:
        language = app.config.get("BABEL_DEFAULT_LOCALE", "en")
    auth_type = app.config["AUTH_TYPE"]
    auth_user_registration = app.config["AUTH_USER_REGISTRATION"]
    frontend_config["AUTH_USER_REGISTRATION"] = auth_user_registration
    should_show_recaptcha = auth_user_registration and (auth_type != AUTH_OAUTH)

    if auth_user_registration:
        frontend_config["AUTH_USER_REGISTRATION_ROLE"] = app.config[
            "AUTH_USER_REGISTRATION_ROLE"
        ]
    if should_show_recaptcha:
        frontend_config["RECAPTCHA_PUBLIC_KEY"] = app.config["RECAPTCHA_PUBLIC_KEY"]

    frontend_config["AUTH_TYPE"] = auth_type
    if auth_type == AUTH_OAUTH:
        oauth_providers = []
        for provider in appbuilder.sm.oauth_providers:
            oauth_providers.append(
                {
                    "name": provider["name"],
                    "icon": provider["icon"],
                }
            )
        frontend_config["AUTH_PROVIDERS"] = oauth_providers

    bootstrap_data = {
        "application_root": app.config["APPLICATION_ROOT"],
        "static_assets_prefix": app.config["STATIC_ASSETS_PREFIX"],
        "conf": frontend_config,
        "locale": language,
        "d3_format": app.config.get("D3_FORMAT"),
        "d3_time_format": app.config.get("D3_TIME_FORMAT"),
        "currencies": app.config.get("CURRENCIES"),
        "deckgl_tiles": app.config.get("DECKGL_BASE_MAP"),
        "feature_flags": get_feature_flags(),
        "extra_sequential_color_schemes": app.config["EXTRA_SEQUENTIAL_COLOR_SCHEMES"],
        "extra_categorical_color_schemes": app.config[
            "EXTRA_CATEGORICAL_COLOR_SCHEMES"
        ],
        "menu_data": menu_data(g.user),
        "pdf_compression_level": app.config["PDF_COMPRESSION_LEVEL"],
    }

    bootstrap_data.update(app.config["COMMON_BOOTSTRAP_OVERRIDES_FUNC"](bootstrap_data))
    bootstrap_data.update(get_theme_bootstrap_data())

    return bootstrap_data


def common_bootstrap_payload() -> dict[str, Any]:
    locale = get_locale()
    # Convert locale to string for proper cache key hashing
    locale_str = str(locale) if locale else None
    return cached_common_bootstrap_data(utils.get_user_id(), locale_str)


def get_spa_payload(extra_data: dict[str, Any] | None = None) -> dict[str, Any]:
    """Generate standardized payload for spa.html template rendering.

    Centralizes the common payload structure used across all spa.html renders.

    Args:
        extra_data: Additional data to include in payload

    Returns:
        dict[str, Any]: Complete payload for spa.html template
    """
    payload = {
        "user": bootstrap_user_data(g.user, include_perms=True),
        "common": common_bootstrap_payload(),
        **(extra_data or {}),
    }
    return payload


def get_spa_template_context(
    entry: str | None = "spa",
    extra_bootstrap_data: dict[str, Any] | None = None,
    **template_kwargs: Any,
) -> dict[str, Any]:
    """Generate standardized template context for spa.html rendering.

    Centralizes spa.html template context to eliminate duplication while
    preserving Flask-AppBuilder context requirements.

    Args:
        entry: Entry point name (spa, explore, embedded)
        extra_bootstrap_data: Additional data for frontend bootstrap payload
        **template_kwargs: Additional template variables

    Returns:
        dict[str, Any]: Template context for spa.html
    """
    payload = get_spa_payload(extra_bootstrap_data)

    # Deep copy theme data to avoid mutating cached bootstrap payload
    theme_data = copy.deepcopy(payload.get("common", {}).get("theme", {}))
    default_theme = theme_data.get("default", {})
    dark_theme = theme_data.get("dark", {})

    # Apply brandAppName fallback to both default and dark themes
    # Priority: theme brandAppName > APP_NAME config > "Superset" default
    app_name_from_config = app.config.get("APP_NAME", "Superset")
    for theme_config in [default_theme, dark_theme]:
        if not theme_config:
            continue
        # Get or create token dict
        if "token" not in theme_config:
            theme_config["token"] = {}
        theme_tokens = theme_config["token"]

        if (
            not theme_tokens.get("brandAppName")
            or theme_tokens.get("brandAppName") == "Superset"
        ):
            # If brandAppName not set or is default, check if APP_NAME customized
            if app_name_from_config != "Superset":
                # User has customized APP_NAME, use it as brandAppName
                theme_tokens["brandAppName"] = app_name_from_config

    # Write the modified theme data back to payload
    if "common" not in payload:
        payload["common"] = {}
    payload["common"]["theme"] = theme_data

    # Extract theme tokens for template access (after fallback applied)
    # Use the direct reference to ensure we get the modified token dict
    theme_tokens = default_theme.get("token", {}) if default_theme else {}

    # Determine spinner content with precedence: theme SVG > theme URL > default SVG
    spinner_svg = None
    if theme_tokens.get("brandSpinnerSvg"):
        # Use custom SVG from theme
        spinner_svg = theme_tokens["brandSpinnerSvg"]
    elif not theme_tokens.get("brandSpinnerUrl"):
        # No custom URL either, use default SVG
        spinner_svg = get_default_spinner_svg()

    # Determine default title using the (potentially updated) brandAppName
    default_title = theme_tokens.get("brandAppName", "Superset")

    return {
        "entry": entry,
        "bootstrap_data": json.dumps(
            payload, default=json.pessimistic_json_iso_dttm_ser
        ),
        "theme_tokens": theme_tokens,
        "spinner_svg": spinner_svg,
        "default_title": default_title,
        **template_kwargs,
    }


class SupersetModelView(ModelView):
    page_size = 100

    def render_app_template(self) -> FlaskResponse:
        context = get_spa_template_context()
        return self.render_template("superset/spa.html", **context)


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
            logger.error("Pre-delete error: %s", str(ex))
        else:
            view_menu = security_manager.find_view_menu(item.get_perm())
            pvs = (
                db.session.query(security_manager.permissionview_model)
                .filter_by(view_menu=view_menu)
                .all()
            )

            if self.datamodel.delete(item):
                self.post_delete(item)

                for pv in pvs:
                    db.session.delete(pv)

                if view_menu:
                    db.session.delete(view_menu)

                db.session.commit()  # pylint: disable=consider-using-transaction

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
                logger.error("Pre-delete error: %s", str(ex))
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

    charset = app.config["CSV_EXPORT"].get("encoding", "utf-8")
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
