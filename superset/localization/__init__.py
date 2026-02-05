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
"""Localization module for user-generated content."""

from superset.localization.locale_utils import get_user_locale, parse_accept_language
from superset.localization.localizable_mixin import LocalizableMixin
from superset.localization.native_filter_utils import localize_native_filters
from superset.localization.sanitization import (
    sanitize_translation_value,
    sanitize_translations,
)
from superset.localization.validation import validate_translations

__all__ = [
    "LocalizableMixin",
    "get_user_locale",
    "localize_native_filters",
    "parse_accept_language",
    "sanitize_translation_value",
    "sanitize_translations",
    "validate_translations",
]
