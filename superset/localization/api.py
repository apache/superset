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
"""REST API for content localization configuration."""

import logging

from flask import current_app, Response
from flask_appbuilder.api import expose, protect, safe

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.extensions import event_logger
from superset.localization.schemas import AvailableLocalesResponseSchema
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)

DEFAULT_LOCALE = "en"


def get_available_locales_data() -> dict[str, list[dict[str, str]] | str]:
    """
    Build available locales response data from Flask config.

    Reads LANGUAGES and BABEL_DEFAULT_LOCALE from current_app.config
    and transforms to response format.

    Returns:
        Dict with 'locales' list and 'default_locale' string.
    """
    languages: dict[str, dict[str, str]] = current_app.config.get("LANGUAGES", {})
    default_locale = current_app.config.get("BABEL_DEFAULT_LOCALE", DEFAULT_LOCALE)

    # Transform dict to sorted list
    locales = [
        {"code": code, "name": meta["name"], "flag": meta["flag"]}
        for code, meta in sorted(languages.items())
    ]

    return {"locales": locales, "default_locale": default_locale}


class LocalizationRestApi(BaseSupersetApi):
    """
    REST API for content localization.

    Provides endpoints for TranslationEditor UI to query
    available locales and localization configuration.
    """

    available_locales_schema = AvailableLocalesResponseSchema()

    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True
    class_permission_name = "Localization"
    resource_name = "localization"
    openapi_spec_tag = "Localization"
    openapi_spec_component_schemas = (AvailableLocalesResponseSchema,)

    @expose("/available_locales", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        ".get_available_locales",
        log_to_statsd=True,
    )
    def get_available_locales(self) -> Response:
        """
        Get available locales for content localization.

        Returns configured locales from LANGUAGES config for
        TranslationEditor UI language selection.
        ---
        get:
          summary: Get available locales for content localization
          responses:
            200:
              description: List of available locales
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/AvailableLocalesResponseSchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        data = get_available_locales_data()
        result = self.available_locales_schema.dump(data)
        return self.response(200, result=result)
