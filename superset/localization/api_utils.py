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
API utilities for content localization.

Provides functions for localizing REST API list responses. List endpoints
use FAB's auto-generated schemas which lack @post_dump localization hooks.
These utilities post-process serialized response items using a lightweight
DB query for translations.
"""

from __future__ import annotations

from typing import Any

from superset import db, is_feature_enabled
from superset.localization.locale_utils import get_translation, get_user_locale


def localize_list_response(
    items: list[dict[str, Any]],
    model_class: type,
    fields: list[str],
) -> None:
    """
    Localize text fields in list API response items in-place.

    Fetches the translations JSON column for listed items and replaces
    field values with their localized version for the user's locale.
    Uses the same locale fallback chain (exact → base language) as
    GET detail endpoints.

    No-op when ENABLE_CONTENT_LOCALIZATION is disabled or items is empty.

    Args:
        items: Serialized response dicts (modified in-place).
        model_class: SQLAlchemy model with id and translations columns.
        fields: Field names to localize (e.g., ["dashboard_title"]).
    """
    if not is_feature_enabled("ENABLE_CONTENT_LOCALIZATION"):
        return

    if not items:
        return

    locale = get_user_locale()
    ids = [item["id"] for item in items if "id" in item]
    if not ids:
        return

    rows = (
        db.session.query(model_class.id, model_class.translations)
        .filter(model_class.id.in_(ids))
        .all()
    )
    translations_map: dict[int, dict[str, dict[str, str]] | None] = {
        row.id: row.translations for row in rows
    }

    for item in items:
        item_translations = translations_map.get(item.get("id"))
        if not item_translations:
            continue
        for field in fields:
            if field not in item:
                continue
            field_translations = item_translations.get(field)
            if not field_translations:
                continue
            localized = get_translation(field_translations, locale)
            if localized:
                item[field] = localized
