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
"""Localization of user-defined asset metadata (chart names, dashboard titles).

This is distinct from UI-chrome translation (Flask-Babel / gettext), which
covers static strings baked into the application. Here we resolve *data* that
users author -- a chart called "Sales" should be able to display as "Ventes"
for a French viewer -- by delegating to a deployment-provided ``TRANSLATION_HOOK``.

Superset core intentionally does not store these translations itself; the hook
abstracts where they live (a database table, an external translation service,
a static mapping, ...), keeping core minimal and the feature pluggable.
"""

from __future__ import annotations

import logging

from flask import current_app as app
from flask_babel import get_locale

from superset.extensions import feature_flag_manager

logger = logging.getLogger(__name__)

#: Feature flag gating asset-metadata translation.
FEATURE_FLAG = "ENABLE_I18N_ASSET_TRANSLATIONS"


def is_asset_translation_enabled() -> bool:
    """Whether asset-metadata translation should be attempted at all.

    Gated on *both* conditions, mirroring the SIP-161 design:
      1. the ``ENABLE_I18N_ASSET_TRANSLATIONS`` feature flag is on, and
      2. more than one language is configured in ``LANGUAGES``.

    The second condition means single-language deployments (the default) pay
    zero cost: ``translate`` short-circuits before resolving the locale or
    invoking the hook.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG):
        return False
    return len(app.config.get("LANGUAGES") or {}) > 1


def translate(default_text: str | None, **context: object) -> str | None:
    """Resolve ``default_text`` for the active locale, or return it unchanged.

    Returns ``default_text`` verbatim when the feature is disabled, the active
    locale is the default locale, no hook is configured, or the hook fails or
    declines to translate. The original text is *always* a safe fallback so a
    missing or broken translation never blanks out a chart or dashboard name.

    Extra ``context`` (e.g. ``model_name``, ``field_name``) is forwarded to the
    hook so an implementation can disambiguate identical strings across fields.
    """
    if not default_text or not is_asset_translation_enabled():
        return default_text

    locale = get_locale()
    if locale is None:
        return default_text

    locale_str = str(locale)
    if locale_str == app.config.get("BABEL_DEFAULT_LOCALE", "en"):
        return default_text

    hook = app.config.get("TRANSLATION_HOOK")
    if hook is None:
        return default_text

    try:
        translated = hook(default_text, locale_str, **context)
    except Exception:  # pylint: disable=broad-except
        # A failing hook must never break asset rendering -- log and fall back.
        logger.exception(
            "TRANSLATION_HOOK raised while translating %r to %s",
            default_text,
            locale_str,
        )
        return default_text

    return translated or default_text
