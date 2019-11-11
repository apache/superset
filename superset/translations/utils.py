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
# pylint: disable=C,R,W
import json
import os
from typing import Any, Dict

# Global caching for JSON language packs
ALL_LANGUAGE_PACKS: Dict[str, Dict[Any, Any]] = {"en": {}}

DIR = os.path.dirname(os.path.abspath(__file__))


def get_language_pack(locale):
    """Get/cache a language pack

    Returns the langugage pack from cache if it exists, caches otherwise

    >>> get_language_pack('fr')['Dashboards']
    "Tableaux de bords"
    """
    pack = ALL_LANGUAGE_PACKS.get(locale)
    if not pack:
        filename = DIR + "/{}/LC_MESSAGES/messages.json".format(locale)
        try:
            with open(filename) as f:
                pack = json.load(f)
                ALL_LANGUAGE_PACKS[locale] = pack
        except Exception:
            # Assuming english, client side falls back on english
            pass
    return pack
