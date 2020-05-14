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
# from superset import db
# from superset.models.dashboard import Dashboard
import glob
import json
import os

from tests.base_tests import SupersetTestCase


class TranslationTests(SupersetTestCase):
    def test_translations_valid_json(self):
        path = os.path.join(
            os.getcwd(), "superset", "translations", "**", "LC_MESSAGES", "*.json"
        )
        for file_path in glob.glob(path):
            with open(file_path, "r") as json_file:
                try:
                    json_str = json_file.read()
                    json.loads(json_str)
                except ValueError:
                    self.fail(f"Invalid JSON in translation: {file_path}")
