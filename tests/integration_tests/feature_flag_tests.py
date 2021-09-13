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

from parameterized import parameterized

from superset import get_feature_flags, is_feature_enabled
from tests.integration_tests.base_tests import SupersetTestCase


def dummy_is_feature_enabled(feature_flag_name: str, default: bool = True) -> bool:
    return True if feature_flag_name.startswith("True_") else default


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


@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    {"True_Flag1": False, "True_Flag2": True, "Flag3": False, "Flag4": True},
    clear=True,
)
class TestFeatureFlagBackend(SupersetTestCase):
    @parameterized.expand(
        [
            ("True_Flag1", True),
            ("True_Flag2", True),
            ("Flag3", False),
            ("Flag4", True),
            ("True_DoesNotExist", False),
        ]
    )
    @patch(
        "superset.extensions.feature_flag_manager._is_feature_enabled_func",
        dummy_is_feature_enabled,
    )
    def test_feature_flags_override(self, feature_flag_name, expected):
        self.assertEqual(is_feature_enabled(feature_flag_name), expected)

    @patch(
        "superset.extensions.feature_flag_manager._is_feature_enabled_func",
        dummy_is_feature_enabled,
    )
    @patch(
        "superset.extensions.feature_flag_manager._get_feature_flags_func", None,
    )
    def test_get_feature_flags(self):
        feature_flags = get_feature_flags()
        self.assertEqual(
            feature_flags,
            {"True_Flag1": True, "True_Flag2": True, "Flag3": False, "Flag4": True},
        )
