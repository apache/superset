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
from superset import data
from superset.cli import load_test_users_run
from .base_tests import SupersetTestCase


class SupersetDataFrameTestCase(SupersetTestCase):
    def test_load_css_templates(self):
        data.load_css_templates()

    def test_load_energy(self):
        data.load_energy()

    def test_load_world_bank_health_n_pop(self):
        data.load_world_bank_health_n_pop()

    def test_load_birth_names(self):
        data.load_birth_names()

    def test_load_test_users_run(self):
        load_test_users_run()
