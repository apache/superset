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

from unittest.mock import patch

import yaml
from freezegun import freeze_time

from superset import security_manager
from superset.databases.commands.export import ExportDatabasesCommand
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase


class TestExportModelsCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    def test_export_models_command(self, mock_g):
        """Make sure metadata.yaml has the correct content."""
        mock_g.user = security_manager.find_user("admin")

        example_db = get_example_database()

        with freeze_time("2020-01-01T00:00:00Z"):
            command = ExportDatabasesCommand([example_db.id])
            contents = dict(command.run())

        metadata = yaml.safe_load(contents["metadata.yaml"])
        assert metadata == (
            {
                "version": "1.0.0",
                "type": "Database",
                "timestamp": "2020-01-01T00:00:00+00:00",
            }
        )
