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
"""Standard-library IANA time-zone validation.

Deliberately depends only on ``zoneinfo`` from the standard library and no
``superset`` modules, so it is safe to import from schemas, commands, and
engine specs without risking import cycles. The allowlist this module exposes
is the load-bearing control that lets generated SQL interpolate a zone name as
a string literal safely.
"""

from functools import lru_cache
from zoneinfo import available_timezones


@lru_cache(maxsize=1)
def iana_timezones() -> frozenset[str]:
    """Return the set of valid IANA zone names known to this interpreter.

    Cached because :func:`zoneinfo.available_timezones` scans the tz database
    on every call. The contents are fixed for the life of the process.
    """

    return frozenset(available_timezones())


def is_valid_timezone(name: str) -> bool:
    """Whether ``name`` is an exact IANA zone name (e.g. ``America/New_York``).

    Matching is case-sensitive and exact: only canonical names from the tz
    database are accepted. This is the allowlist that callers must pass before
    a zone is ever placed into generated SQL.
    """

    return name in iana_timezones()


def validate_timezones(*names: str | None) -> None:
    """Raise ``ValueError`` on any non-``None`` name that isn't an IANA zone.

    The single guard that callers place immediately before interpolating a zone
    into string-templated SQL — the load-bearing injection control. ``None``
    names (an absent zone) are skipped.
    """

    for name in names:
        if name is not None and not is_valid_timezone(name):
            raise ValueError(f"Invalid IANA time zone: {name}")
