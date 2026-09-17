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
from unittest import mock

from superset.db_engine_specs import get_engine_spec
from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec
from tests.integration_tests.db_engine_specs.base_tests import TestDbEngineSpec
from tests.integration_tests.fixtures.certificates import ssl_certificate
from tests.integration_tests.fixtures.database import default_db_extra


class TestDatabricksDbEngineSpec(TestDbEngineSpec):
    def test_get_engine_spec(self):
        """
        DB Eng Specs (databricks): Test "databricks" in engine spec
        """
        assert get_engine_spec("databricks", "connector").engine == "databricks"
        assert get_engine_spec("databricks", "pyodbc").engine == "databricks"
        assert get_engine_spec("databricks", "pyhive").engine == "databricks"

    def test_extras_without_ssl(self):
        database = mock.Mock()
        database.extra = default_db_extra
        database.server_cert = None
        extras = DatabricksNativeEngineSpec.get_extra_params(database)
        assert extras == {
            "engine_params": {
                "connect_args": {
                    "_user_agent_entry": "Apache Superset",
                    "http_headers": [("User-Agent", "Apache Superset")],
                },
            },
            "metadata_cache_timeout": {},
            "metadata_params": {},
            "schemas_allowed_for_file_upload": [],
        }

    def test_extras_with_ssl_custom(self):
        database = mock.Mock()
        database.extra = default_db_extra.replace(
            '"engine_params": {}',
            '"engine_params": {"connect_args": {"ssl": "1"}}',
        )
        database.server_cert = ssl_certificate
        extras = DatabricksNativeEngineSpec.get_extra_params(database)
        connect_args = extras["engine_params"]["connect_args"]
        assert connect_args["ssl"] == "1"
