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
import hashlib
import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Global caching for JSON language packs
ALL_LANGUAGE_PACKS: dict[str, dict[str, Any]] = {"en": {}}

# Global caching for language pack content hashes, used to build
# content-addressed (cache-busting) asset URLs
ALL_LANGUAGE_PACK_VERSIONS: dict[str, str] = {}

DIR = os.path.dirname(os.path.abspath(__file__))


def get_language_pack_filename(locale: str) -> str:
    """Resolve the on-disk JSON pack for a locale (empty pack for English)"""
    if not locale or locale == "en":
        # Forcing a dummy, quasi-empty language pack for English since the file
        # in the en directory contains data with empty mappings
        return DIR + "/empty_language_pack.json"
    return DIR + f"/{locale}/LC_MESSAGES/messages.json"


def get_language_pack_version(locale: str) -> Optional[str]:
    """Get/cache a short content hash of the language pack file

    The hash is embedded in the pack's asset URL so browsers can cache it
    as immutable and pick up a fresh copy whenever translations change.
    Returns None when the pack file cannot be read.
    """
    version = ALL_LANGUAGE_PACK_VERSIONS.get(locale)
    if not version:
        try:
            with open(get_language_pack_filename(locale), "rb") as f:
                version = hashlib.sha256(f.read()).hexdigest()[:12]
            ALL_LANGUAGE_PACK_VERSIONS[locale] = version
        except OSError:
            logger.warning("No language pack file to version for locale %s", locale)
            return None
    return version


def get_language_pack(locale: str) -> Optional[dict[str, Any]]:
    """Get/cache a language pack

    Returns the language pack from cache if it exists, caches otherwise

    >>> get_language_pack('fr')['Dashboards']
    "Tableaux de bords"
    """
    pack = ALL_LANGUAGE_PACKS.get(locale)
    if not pack:
        filename = get_language_pack_filename(locale)
        try:
            with open(filename, encoding="utf8") as f:
                pack = json.load(f)
                ALL_LANGUAGE_PACKS[locale] = pack or {}
        except Exception:  # pylint: disable=broad-except
            logger.error(
                "Error loading language pack for, falling back on en %s", locale
            )
            pack = get_language_pack("en")
    return pack
