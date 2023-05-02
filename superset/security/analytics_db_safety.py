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

from flask_babel import lazy_gettext as _
from sqlalchemy.engine.url import URL
from sqlalchemy.exc import NoSuchModuleError

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException

# list of unsafe SQLAlchemy dialects
BLOCKLIST = {
    # sqlite creates a local DB, which allows mapping server's filesystem
    re.compile(r"sqlite(?:\+[^\s]*)?$"),
    # shillelagh allows opening local files (eg, 'SELECT * FROM "csv:///etc/passwd"')
    re.compile(r"shillelagh$"),
    re.compile(r"shillelagh\+apsw$"),
}


def check_sqlalchemy_uri(uri: URL) -> None:
    for blocklist_regex in BLOCKLIST:
        if not re.match(blocklist_regex, uri.drivername):
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
