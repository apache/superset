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
import os
from typing import Any, Union

from babel import Locale
from flask import current_app as app, g, get_flashed_messages, session
from flask_appbuilder.security.sqla.models import User
from flask_babel import get_locale

from superset.db_engine_specs import get_available_dialects
from superset.extensions import appbuilder, cache_manager, feature_flag_manager
from superset.reports.models import ReportRecipientType
from superset.translations.utils import get_language_pack
from superset.utils import core as utils

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
)


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

    return {
        "menu": appbuilder.menu.get_data(),
        "brand": {
            "path": app.config["LOGO_TARGET_PATH"] or "/superset/welcome/",
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
            "version_string": app.config["VERSION_STRING"],
            "version_sha": app.config["VERSION_SHA"],
            "build_number": app.config["BUILD_NUMBER"],
            "languages": languages,
            "show_language_picker": len(languages) > 1,
            "user_is_anonymous": user.is_anonymous,
            "user_info_url": (
                None
                if feature_flag_manager.is_feature_enabled("MENU_HIDE_USER_INFO")
                else appbuilder.get_url_for_userinfo
            ),
            "user_logout_url": appbuilder.get_url_for_logout,
            "user_login_url": appbuilder.get_url_for_login,
            "locale": session.get("locale", "en"),
        },
    }


@cache_manager.cache.memoize(timeout=60)
def cached_common_bootstrap_data(  # pylint: disable=unused-argument
    user_id: Union[int, None], locale: Locale | None
) -> dict[str, Any]:
    """Common data always sent to the client

    The function is memoized as the return value only changes when user permissions
    or configuration values change.
    """
    conf = app.config

    # should not expose API TOKEN to frontend
    frontend_config = {
        k: (list(conf.get(k)) if isinstance(conf.get(k), set) else conf.get(k))
        for k in FRONTEND_CONF_KEYS
    }

    if conf.get("SLACK_API_TOKEN"):
        frontend_config["ALERT_REPORTS_NOTIFICATION_METHODS"] = [
            ReportRecipientType.EMAIL,
            ReportRecipientType.SLACK,
        ]
    else:
        frontend_config["ALERT_REPORTS_NOTIFICATION_METHODS"] = [
            ReportRecipientType.EMAIL,
        ]

    # TODO maybe we should pass all dialects to define what's visible in the UI (?)

    # verify client has google sheets installed
    available_dialects = get_available_dialects()
    frontend_config["HAS_GSHEETS_INSTALLED"] = bool("gsheets" in available_dialects)

    language = locale.language if locale else "en"

    bootstrap_data = {
        "conf": frontend_config,
        "locale": language,
        "language_pack": get_language_pack(language),
        "d3_format": conf.get("D3_FORMAT"),
        "currencies": conf.get("CURRENCIES"),
        "feature_flags": feature_flag_manager.get_feature_flags(),
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
