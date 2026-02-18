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
Marshmallow mixin for translations field.

Provides translations field with feature flag validation and XSS sanitization.
Used by all schemas that accept user-provided translations (Post, Put, Copy).
"""

from __future__ import annotations

from typing import Any

from marshmallow import ValidationError, fields, post_load, validates_schema

from superset import is_feature_enabled
from superset.localization.sanitization import sanitize_translations
from superset.localization.validation import validate_translations


class TranslatableSchemaMixin:
    """
    Mixin for Marshmallow schemas that accept a ``translations`` field.

    Adds:
    - ``translations`` dict field (optional, nullable)
    - ``@validates_schema``: feature flag check + structure validation
    - ``@post_load``: XSS sanitization of translation values

    Usage::

        class MySchema(TranslatableSchemaMixin, Schema):
            name = fields.String()
    """

    translations = fields.Dict(
        metadata={"description": "Translations dict for content localization"},
        allow_none=True,
    )

    @validates_schema
    def validate_translations_data(
        self, data: dict[str, Any], **kwargs: Any
    ) -> None:
        """
        Validate translations field: feature flag and structure.

        Checks:
        1. Feature flag ENABLE_CONTENT_LOCALIZATION must be enabled
        2. Structure must be valid: {field: {locale: value}}

        Raises:
            ValidationError: If feature disabled or structure invalid.
        """
        if "translations" not in data or data["translations"] is None:
            return

        if not is_feature_enabled("ENABLE_CONTENT_LOCALIZATION"):
            raise ValidationError(
                "Content localization is not enabled. "
                "Set ENABLE_CONTENT_LOCALIZATION=True to use translations.",
                field_name="translations",
            )

        validate_translations(data["translations"])

    @post_load
    def sanitize_translations_xss(
        self, data: dict[str, Any], **kwargs: Any
    ) -> dict[str, Any]:
        """
        Strip HTML from translation values to prevent XSS.

        Sanitization runs after validation. All HTML tags are removed,
        storing plain text that React will escape when rendering.
        """
        if "translations" in data:
            data["translations"] = sanitize_translations(data["translations"])
        return data
