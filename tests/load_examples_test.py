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
from .base_tests import SupersetTestCase


class TestSupersetDataFrame(SupersetTestCase):
    def setUp(self) -> None:
        # Late importing here as we need an app context to be pushed...
        from superset import examples

        self.examples = examples

    def test_load_css_templates(self):
        self.examples.load_css_templates()

    def test_load_energy(self):
        self.examples.load_energy(sample=True)

    def test_load_world_bank_health_n_pop(self):
        self.examples.load_world_bank_health_n_pop(sample=True)

    def test_load_birth_names(self):
        self.examples.load_birth_names(sample=True)

    def test_load_test_users_run(self):
        from superset.cli import load_test_users_run

        load_test_users_run()

    def test_load_unicode_test_data(self):
        self.examples.load_unicode_test_data(sample=True)
