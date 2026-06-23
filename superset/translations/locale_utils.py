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
from __future__ import annotations

import re

from flask import session
from flask_babel import refresh

SUPPORTED_LOCALE_RE = re.compile(r"^[a-z]{2,3}(_[A-Z]{2})?$")


def normalize_locale(locale: str) -> str | None:
    """Normalize host-app locale codes to Superset language codes."""
    if not locale:
        return None

    normalized = locale.strip().replace("-", "_")
    parts = normalized.split("_")
    language = parts[0].lower()

    if len(parts) > 1 and len(parts[1]) == 2:
        with_region = f"{language}_{parts[1].upper()}"
        if with_region in {"pt_BR", "zh_TW"}:
            return with_region

    return language if SUPPORTED_LOCALE_RE.match(language) else None


def apply_request_locale(locale: str | None, languages: dict[str, object]) -> None:
    """Persist a request locale in the session when it is supported."""
    if not locale:
        return

    normalized_locale = normalize_locale(locale)
    if normalized_locale and normalized_locale in languages:
        session["locale"] = normalized_locale
        refresh()
