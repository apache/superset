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
"""Reference ``TRANSLATION_HOOK`` backed by the ``AssetTranslation`` table.

NOT part of Superset core -- see this directory's README. Assign ``translation_hook``
to ``TRANSLATION_HOOK`` in ``superset_config.py``.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def translation_hook(
    default_text: str,
    locale: str,
    **kwargs: object,
) -> str | None:
    """Look up a stored translation for the active locale.

    Matches on the source text plus the ``model_name``/``field_name`` context
    Superset passes, so the same string can be translated differently per field.
    Returns ``None`` when there is no match (Superset falls back to the canonical
    text). Any failure is swallowed so rendering never breaks on a lookup error.
    """
    # Local imports: these are only importable inside the running app context.
    from superset import db

    from .model import AssetTranslation

    try:
        row = (
            db.session.query(AssetTranslation.translated_text)
            .filter(
                AssetTranslation.language_code == locale,
                AssetTranslation.default_text == default_text,
                AssetTranslation.model_name == kwargs.get("model_name", ""),
                AssetTranslation.field_name == kwargs.get("field_name", ""),
            )
            .first()
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception("asset translation lookup failed for %r", default_text)
        return None

    return row[0] if row else None
