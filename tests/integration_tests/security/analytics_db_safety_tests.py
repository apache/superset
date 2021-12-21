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

import pytest
from sqlalchemy.engine.url import make_url

from superset.exceptions import SupersetSecurityException
from superset.security.analytics_db_safety import check_sqlalchemy_uri
from tests.integration_tests.base_tests import SupersetTestCase


class TestDBConnections(SupersetTestCase):
    def test_check_sqlalchemy_uri_ok(self):
        check_sqlalchemy_uri(make_url("postgres://user:password@test.com"))

    def test_check_sqlalchemy_url_sqlite(self):
        with pytest.raises(SupersetSecurityException) as excinfo:
            check_sqlalchemy_uri(make_url("sqlite:///home/superset/bad.db"))
        assert (
            str(excinfo.value)
            == "SQLiteDialect_pysqlite cannot be used as a data source for security reasons."
        )

        with pytest.raises(SupersetSecurityException) as excinfo:
            check_sqlalchemy_uri(make_url("shillelagh:///home/superset/bad.db"))
        assert (
            str(excinfo.value)
            == "shillelagh cannot be used as a data source for security reasons."
        )
