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
import re

from flask import current_app
from flask_babel import lazy_gettext as _
from sqlalchemy.engine.url import URL
from sqlalchemy.exc import NoSuchModuleError

from superset import feature_flag_manager
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException

# list of unsafe SQLAlchemy dialects
BLOCKLIST = {
    # sqlite creates a local DB, which allows mapping server's filesystem
    re.compile(r"sqlite(?:\+[^\s]*)?$"),
    # shillelagh allows opening local files (eg, 'SELECT * FROM "csv:///etc/passwd"')
    re.compile(r"shillelagh(?:\+[^\s]*)?$"),
    # duckdb exposes filesystem table-valued functions (read_csv_auto, read_text,
    # read_parquet, glob, etc.) that grant arbitrary local file access. The
    # motherduck cloud variant rides on the same dialect and is covered too.
    re.compile(r"duckdb(?:\+[^\s]*)?$"),
}

# Base dialects an operator may re-enable via ALLOWED_UNSAFE_DB_DIALECTS. These
# are the filesystem-access dialects above; the setting exists to relax exactly
# these. The ``superset`` meta-database block is deliberately NOT allowlistable:
# it is governed by the ENABLE_SUPERSET_META_DB feature flag, and must stay
# independent of this setting. A new entry added to BLOCKLIST is not
# allowlistable unless it is also added here on purpose.
ALLOWLISTABLE_DIALECTS = frozenset({"sqlite", "shillelagh", "duckdb"})


def check_sqlalchemy_uri(uri: URL) -> None:
    if not feature_flag_manager.is_feature_enabled("ENABLE_SUPERSET_META_DB"):
        BLOCKLIST.add(re.compile(r"superset$"))

    # Normalize the operator's entries to the base dialect, lowercased, so one
    # matches regardless of case or a "+driver" suffix (eg "DuckDB" or
    # "duckdb+duckdb_engine" both opt in the "duckdb" dialect). Intersecting with
    # ALLOWLISTABLE_DIALECTS means an unrelated entry (eg "superset") can never
    # relax a block it was not meant to.
    allowed_dialects = {
        dialect.split("+", 1)[0].strip().lower()
        for dialect in (current_app.config.get("ALLOWED_UNSAFE_DB_DIALECTS") or set())
    } & ALLOWLISTABLE_DIALECTS
    base_dialect = uri.drivername.split("+", 1)[0].lower()

    for blocklist_regex in BLOCKLIST:
        if not re.match(blocklist_regex, uri.drivername):
            continue
        # The operator has explicitly opted this dialect in for this deployment.
        if base_dialect in allowed_dialects:
            continue
        try:
            dialect = uri.get_dialect().__name__
        except (NoSuchModuleError, ValueError):
            dialect = uri.drivername

        raise SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.DATABASE_SECURITY_ACCESS_ERROR,
                message=_(
                    "%(dialect)s cannot be used as a data source for security reasons.",
                    dialect=dialect,
                ),
                level=ErrorLevel.ERROR,
            )
        )
