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
from typing import Optional

import pytest
from sqlalchemy.engine.url import make_url

from superset.exceptions import SupersetSecurityException
from superset.security.analytics_db_safety import check_sqlalchemy_uri


@pytest.mark.parametrize(
    "sqlalchemy_uri, error, error_message",
    [
        ("postgres://user:password@test.com", False, None),
        (
            "sqlite:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",
        ),
        (
            "sqlite+pysqlite:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",
        ),
        (
            "sqlite+aiosqlite:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",
        ),
        (
            "sqlite+pysqlcipher:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",
        ),
        (
            "sqlite+:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",
        ),
        (
            "sqlite+new+driver:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",
        ),
        (
            "sqlite+new+:///home/superset/bad.db",
            True,
            "SQLiteDialect_pysqlite cannot be used as a data source for security reasons.",
        ),
        (
            "shillelagh:///home/superset/bad.db",
            True,
            "shillelagh cannot be used as a data source for security reasons.",
        ),
        (
            "shillelagh+apsw:///home/superset/bad.db",
            True,
            "shillelagh cannot be used as a data source for security reasons.",
        ),
        ("shillelagh+:///home/superset/bad.db", False, None),
        (
            "shillelagh+something:///home/superset/bad.db",
            False,
            None,
        ),
    ],
)
def test_check_sqlalchemy_uri(
    sqlalchemy_uri: str, error: bool, error_message: Optional[str]
):
    if error:
        with pytest.raises(SupersetSecurityException) as excinfo:
            check_sqlalchemy_uri(make_url(sqlalchemy_uri))
            assert str(excinfo.value) == error_message
    else:
        check_sqlalchemy_uri(make_url(sqlalchemy_uri))
