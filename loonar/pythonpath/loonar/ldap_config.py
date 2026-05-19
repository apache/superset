# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with this
# work for additional information regarding copyright ownership.  The ASF
# licenses this file to You under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
from __future__ import annotations

import json
import logging
import os
from typing import Optional


logger = logging.getLogger(__name__)


def get_ldap_mode(default: str = "real") -> str:
    """Return the desired LDAP mode (e.g. "real" or "mock")."""

    return os.getenv("LOONAR_LDAP_MODE", default).strip().lower() or default


def get_ldap_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    """Fetch a LDAP-related setting considering the current mode."""

    candidates = []
    if mode := get_ldap_mode():
        mode_upper = mode.upper()
        candidates.append(f"{key}_{mode_upper}_INTERNAL")
        candidates.append(f"{key}_{mode_upper}")
    candidates.append(key)
    for candidate in candidates:
        value = os.getenv(candidate)
        if value:
            return value
    return default


def parse_ldap_user_base_aliases(raw_value: Optional[str]) -> dict[str, str]:
    """Parse LDAP user base from env supporting legacy string and JSON map."""

    value = (raw_value or "").strip()
    if not value:
        return {}

    if value.startswith("{"):
        try:
            parsed = json.loads(value)
            if not isinstance(parsed, dict):
                logger.warning(
                    "LOONAR_LDAP_USER_BASE_* deve ser um objeto JSON. "
                    "Usando fallback para formato legado."
                )
                return {"Padrão": value}

            aliases: dict[str, str] = {}
            for alias, dn in parsed.items():
                alias_text = str(alias).strip()
                dn_text = str(dn).strip()
                if alias_text and dn_text:
                    aliases[alias_text] = dn_text
            return aliases
        except json.JSONDecodeError:
            logger.warning(
                "JSON inválido em LOONAR_LDAP_USER_BASE_*. "
                "Usando fallback para formato legado.",
                exc_info=True,
            )
            return {"Padrão": value}

    # Compatibilidade com formato antigo (valor único)
    return {"Padrão": value}


def get_ldap_user_base_aliases(default: Optional[str] = None) -> dict[str, str]:
    """Return LDAP user base aliases for current mode."""

    raw_value = get_ldap_setting("LOONAR_LDAP_USER_BASE", default)
    return parse_ldap_user_base_aliases(raw_value)
