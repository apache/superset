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
"""
Locale detection utilities for content localization.

Provides functions to detect and resolve user's preferred locale
for displaying localized content (dashboard titles, chart names, etc.).

Locale detection priority:
1. Explicit locale parameter (API override)
2. Flask session locale (user preference)
3. Accept-Language HTTP header (browser preference)
4. Default locale from BABEL_DEFAULT_LOCALE config
"""

from flask import current_app, has_request_context, request, session

DEFAULT_LOCALE = "en"


def parse_accept_language(header: str) -> list[str]:
    """
    Parse Accept-Language HTTP header into sorted locale list.

    Parses RFC 7231 Accept-Language header format and returns locales
    sorted by quality value (q) in descending order.

    Args:
        header: Accept-Language header value (e.g., "de-DE, de;q=0.9, en;q=0.8")

    Returns:
        List of locale codes sorted by quality descending.
        Empty list if header is empty.

    Examples:
        >>> parse_accept_language("de-DE, de;q=0.9, en;q=0.8")
        ["de-DE", "de", "en"]
        >>> parse_accept_language("fr;q=0.7, de;q=0.9")
        ["de", "fr"]
    """
    if not header or not header.strip():
        return []

    locales_with_quality: list[tuple[str, float]] = []

    for part in header.split(","):
        part = part.strip()
        if not part:
            continue

        # Parse locale and quality
        if ";" in part:
            locale_part, quality_part = part.split(";", 1)
            locale = locale_part.strip()
            quality = _parse_quality(quality_part)
        else:
            locale = part.strip()
            quality = 1.0  # Default quality per RFC 7231

        # Skip wildcard
        if locale == "*":
            continue

        locales_with_quality.append((locale, quality))

    # Sort by quality descending, preserve order for equal quality
    locales_with_quality.sort(key=lambda x: x[1], reverse=True)

    return [locale for locale, _ in locales_with_quality]


def _parse_quality(quality_part: str) -> float:
    """
    Parse quality value from Accept-Language quality parameter.

    Args:
        quality_part: Quality parameter (e.g., "q=0.9")

    Returns:
        Quality value as float. Returns 0.0 for invalid values.
    """
    quality_part = quality_part.strip()
    if not quality_part.startswith("q="):
        return 0.0

    try:
        return float(quality_part[2:])
    except ValueError:
        return 0.0


def get_translation(translations: dict[str, str], locale: str) -> str | None:
    """
    Get translation for locale with base language fallback.

    Tries exact locale match first, then base language
    (splitting on hyphen or underscore: de-DE -> de, pt_BR -> pt).

    Args:
        translations: Dict mapping locale codes to translated values.
        locale: Target locale code.

    Returns:
        Translated value if found, None otherwise.
    """
    if locale in translations:
        return translations[locale]

    for sep in ("-", "_"):
        if sep in locale:
            base_locale = locale.split(sep)[0]
            if base_locale in translations:
                return translations[base_locale]

    return None


def get_user_locale(locale: str | None = None, validate: bool = False) -> str:
    """
    Get user's locale for content localization.

    Resolves locale using priority chain:
    1. Explicit locale parameter (if provided)
    2. Flask session["locale"] (user preference)
    3. Accept-Language header best match
    4. BABEL_DEFAULT_LOCALE config value

    Args:
        locale: Explicit locale override. If provided, takes priority.
        validate: If True, validates locale against LANGUAGES config.
                  Invalid locales fall back to default.

    Returns:
        Locale code string (e.g., "de", "fr-FR", "en").
    """
    resolved_locale: str | None = None

    # Priority 1: Explicit parameter
    if locale:
        resolved_locale = locale

    # Priority 2: Session locale (only if in request context)
    if not resolved_locale and has_request_context():
        resolved_locale = session.get("locale")

    # Priority 3: Accept-Language header (only if in request context)
    if not resolved_locale and has_request_context():
        resolved_locale = request.accept_languages.best

    # Priority 4: Default locale
    if not resolved_locale:
        resolved_locale = current_app.config.get("BABEL_DEFAULT_LOCALE", DEFAULT_LOCALE)

    # Validation against LANGUAGES config
    if validate and resolved_locale:
        languages = current_app.config.get("LANGUAGES", {})
        if languages and resolved_locale not in languages:
            resolved_locale = current_app.config.get(
                "BABEL_DEFAULT_LOCALE", DEFAULT_LOCALE
            )

    return resolved_locale or DEFAULT_LOCALE
