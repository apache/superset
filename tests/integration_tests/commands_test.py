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
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.v1.utils import is_valid_config
from tests.integration_tests.base_tests import SupersetTestCase


class TestCommandsExceptions(SupersetTestCase):
    def test_command_invalid_error(self):
        exception = CommandInvalidError("A test")
        assert str(exception) == "A test"


class TestImportersV1Utils(SupersetTestCase):
    def test_is_valid_config(self):
        assert is_valid_config("metadata.yaml")
        assert is_valid_config("databases/examples.yaml")
        assert not is_valid_config(".DS_Store")
        assert not is_valid_config(
            "__MACOSX/chart_export_20210111T145253/databases/._examples.yaml"
        )
