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
from collections.abc import Iterable, Mapping
from typing import Any, Callable

from flask import current_app as app, g, has_request_context
from flask_babel import get_locale

from superset.extensions import feature_flag_manager

logger = logging.getLogger(__name__)

#: Feature flag gating asset-metadata translation.
FEATURE_FLAG = "ENABLE_I18N_ASSET_TRANSLATIONS"

#: Attribute on ``flask.g`` holding the per-request resolution memo.
_CACHE_ATTR = "_asset_translation_cache"

#: Key identifying one resolution: locale + source text + hook context. The
#: context is part of the key because the same string may resolve differently
#: per field (a chart named "Sales" and a dashboard titled "Sales").
_CacheKey = tuple[str, str, tuple[tuple[str, str], ...]]


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


def _target_locale() -> str | None:
    """The locale to translate into, or ``None`` when there is nothing to do.

    ``None`` means the active locale is unresolved or already the default the
    canonical text is authored in, so the stored text is the correct answer.
    """
    locale = get_locale()
    if locale is None:
        return None

    locale_str = str(locale)
    if locale_str == app.config.get("BABEL_DEFAULT_LOCALE", "en"):
        return None

    return locale_str


def _cache() -> dict[_CacheKey, str | None] | None:
    """Per-request resolution memo, or ``None`` outside a request context.

    Scoping to the request is what makes prefetching worthwhile: a batch
    resolved up front stays visible to the per-item lookups that follow it
    during serialization, while staleness is bounded to a single response.
    Background jobs (thumbnails, reports) have no request and simply resolve
    directly.
    """
    if not has_request_context():
        return None

    cache: dict[_CacheKey, str | None] | None = getattr(g, _CACHE_ATTR, None)
    if cache is None:
        cache = {}
        setattr(g, _CACHE_ATTR, cache)
    return cache


def _cache_key(locale: str, text: str, context: dict[str, Any]) -> _CacheKey:
    return (locale, text, tuple(sorted((k, str(v)) for k, v in context.items())))


def _call_hook(
    hook: Callable[..., str | None],
    text: str,
    locale: str,
    context: dict[str, Any],
) -> str | None:
    """Invoke the single-text hook, swallowing failures."""
    try:
        return hook(text, locale, **context)
    except Exception:  # pylint: disable=broad-except
        # A failing hook must never break asset rendering -- log and fall back.
        logger.exception(
            "TRANSLATION_HOOK raised while translating %r to %s", text, locale
        )
        return None


def _call_batch_hook(
    hook: Callable[..., Mapping[str, str | None] | None],
    texts: list[str],
    locale: str,
    context: dict[str, Any],
) -> dict[str, str | None]:
    """Invoke the batch hook, swallowing failures and bad return types."""
    try:
        resolved = hook(list(texts), locale, **context)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "TRANSLATION_BATCH_HOOK raised while translating %d strings to %s",
            len(texts),
            locale,
        )
        return {}

    if resolved is None:
        return {}

    if not isinstance(resolved, Mapping):
        logger.warning(
            "TRANSLATION_BATCH_HOOK returned %s, expected a mapping of "
            "source text to translation; falling back to the canonical text",
            type(resolved).__name__,
        )
        return {}

    return dict(resolved)


def translate(default_text: str | None, **context: object) -> str | None:
    """Resolve ``default_text`` for the active locale, or return it unchanged.

    Returns ``default_text`` verbatim when the feature is disabled, the active
    locale is the default locale, no hook is configured, or the hook fails or
    declines to translate. The original text is *always* a safe fallback so a
    missing or broken translation never blanks out a chart or dashboard name.

    Extra ``context`` (e.g. ``model_name``, ``field_name``) is forwarded to the
    hook so an implementation can disambiguate identical strings across fields.

    Resolutions are memoized for the request, so repeated strings -- and any
    value already fetched by :func:`translate_many` -- cost no extra hook call.
    """
    if not default_text or not is_asset_translation_enabled():
        return default_text

    locale_str = _target_locale()
    if locale_str is None:
        return default_text

    cache = _cache()
    key = _cache_key(locale_str, default_text, context)
    if cache is not None and key in cache:
        return cache[key] or default_text

    hook = app.config.get("TRANSLATION_HOOK")
    if hook is None:
        # A deployment may configure only the batch hook; route through it so
        # it is a complete replacement rather than an add-on.
        if app.config.get("TRANSLATION_BATCH_HOOK") is None:
            return default_text
        return translate_many([default_text], **context).get(default_text, default_text)

    translated = _call_hook(hook, default_text, locale_str, context)
    if cache is not None:
        cache[key] = translated

    return translated or default_text


def _split_already_resolved(
    texts: list[str],
    locale: str,
    context: dict[str, Any],
    cache: dict[_CacheKey, str | None] | None,
) -> tuple[dict[str, str | None], list[str]]:
    """Partition ``texts`` into values already memoized and ones still to fetch."""
    if cache is None:
        return {}, list(texts)

    resolved: dict[str, str | None] = {}
    pending: list[str] = []
    for text in texts:
        key = _cache_key(locale, text, context)
        if key in cache:
            resolved[text] = cache[key]
        else:
            pending.append(text)
    return resolved, pending


def _resolve_uncached(
    pending: list[str], locale: str, context: dict[str, Any]
) -> dict[str, str | None]:
    """Resolve strings through the batch hook, or the per-string hook."""
    if (batch_hook := app.config.get("TRANSLATION_BATCH_HOOK")) is not None:
        return _call_batch_hook(batch_hook, pending, locale, context)

    hook = app.config.get("TRANSLATION_HOOK")
    if hook is None:
        return {}

    return {text: _call_hook(hook, text, locale, context) for text in pending}


def translate_many(
    default_texts: Iterable[str | None], **context: object
) -> dict[str, str | None]:
    """Resolve many strings at once, priming the per-request memo.

    Returns a ``{default_text: resolved_text}`` mapping, falling back to the
    canonical text for anything the hook declines or fails to translate.

    Call this wherever a whole collection is in hand -- a dashboard's charts, a
    page of activity -- *before* the individual values are read. Results are
    memoized for the request, so the later per-item :func:`translate` calls,
    including the ones made while serializing, are free.

    Uses ``TRANSLATION_BATCH_HOOK`` when configured and otherwise falls back to
    ``TRANSLATION_HOOK`` per string, so priming is always safe to call: with no
    batch hook it costs exactly what the per-item lookups would have.
    """
    # Deduplicate while preserving order, and drop empties -- there is nothing
    # to look up for those and the caller maps them back to themselves.
    texts = [text for text in dict.fromkeys(default_texts) if text]
    if not texts or not is_asset_translation_enabled():
        return {text: text for text in texts}

    locale_str = _target_locale()
    if locale_str is None:
        return {text: text for text in texts}

    cache = _cache()
    resolved, pending = _split_already_resolved(texts, locale_str, context, cache)

    if pending:
        resolved.update(_resolve_uncached(pending, locale_str, context))
        if cache is not None:
            for text in pending:
                cache[_cache_key(locale_str, text, context)] = resolved.get(text)

    return {text: resolved.get(text) or text for text in texts}
