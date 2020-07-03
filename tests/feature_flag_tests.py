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

from superset import is_feature_enabled
from tests.base_tests import SupersetTestCase


class TestFeatureFlag(SupersetTestCase):
    @patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"FOO": True},
        clear=True,
    )
    def test_existing_feature_flags(self):
        self.assertTrue(is_feature_enabled("FOO"))

    @patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags", {}, clear=True
    )
    def test_nonexistent_feature_flags(self):
        self.assertFalse(is_feature_enabled("FOO"))

    def test_feature_flags(self):
        self.assertEqual(is_feature_enabled("foo"), "bar")
        self.assertEqual(is_feature_enabled("super"), "set")
