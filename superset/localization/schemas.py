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
"""Marshmallow schemas for localization API endpoints."""

from marshmallow import fields, Schema


class LocaleSchema(Schema):
    """
    Single locale metadata.

    Represents a language/locale available for content localization.
    """

    code = fields.String(
        required=True,
        metadata={"description": "BCP 47 locale code (e.g., 'en', 'de', 'pt_BR')"},
    )
    name = fields.String(
        required=True,
        metadata={"description": "Display name in English (e.g., 'German')"},
    )
    flag = fields.String(
        required=True,
        metadata={"description": "Country flag code for UI display (e.g., 'de')"},
    )


class AvailableLocalesResponseSchema(Schema):
    """
    Response schema for GET /api/v1/localization/available-locales.

    Returns list of configured locales from LANGUAGES config
    and the default locale from BABEL_DEFAULT_LOCALE.
    """

    locales = fields.List(
        fields.Nested(LocaleSchema),
        required=True,
        metadata={"description": "Available locales for content localization"},
    )
    default_locale = fields.String(
        required=True,
        metadata={"description": "Default locale code from BABEL_DEFAULT_LOCALE"},
    )
